import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setImmediate as waitImmediate } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { Linter } from 'eslint';

export const MANIFEST_SCHEMA_VERSION = '1.0.0';
export const EVIDENCE_SCHEMA_VERSION = '1.1.0';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = 'qa/manifests/apps-script-globals.json';
const EVIDENCE = '.qa-output/globals-evidence.json';
export const IPC_SCHEMA_VERSION = '1.0.0';
const IGNORE_DIRECTORIES = new Set(['.git', '.qa-output', 'node_modules']);
const MANIFEST_KEYS = new Set([
  'schemaVersion',
  'canonicalNodeVersion',
  'includedFiles',
  'excludedFiles',
  'publicEntrypoints',
  'policy',
  'exceptions'
]);
const INCLUDED_KEYS = new Set(['path', 'role', 'classification', 'justification']);
const EXCLUDED_KEYS = new Set(['path', 'reason']);
const EXCEPTION_KEYS = new Set(['symbol', 'type', 'paths', 'justification']);
const POLICY_KEYS = new Set([
  'exactCollision',
  'equivalentDuplicate',
  'incompatiblePublicEntrypoint',
  'unicodeNormalizationCollision',
  'casefoldPublic',
  'casefoldPrivate',
  'dynamicGlobal',
  'parseError',
  'nodeRuntimePattern'
]);
const EVIDENCE_KEYS = new Set([
  'schemaVersion',
  'runId',
  'startedAt',
  'finishedAt',
  'runtime',
  'repository',
  'manifestSha256',
  'inventory',
  'counts',
  'occurrences',
  'collisions',
  'dynamicConstructions',
  'exceptionsUsed',
  'obsoleteExceptions',
  'result',
  'exitCode',
  'failureCode',
  'persistence',
  'aggregateSha256'
]);
const OCCURRENCE_KEYS = new Set([
  'symbol',
  'originalSymbol',
  'path',
  'line',
  'column',
  'astType',
  'ownerClass',
  'structuralSignature',
  'nodeSha256',
  'publicEntrypoint',
  'fileRole',
  'selfExport'
]);
const DYNAMIC_KEYS = new Set(['type', 'file', 'line', 'column', 'code']);
const COLLISION_KEYS = new Set(['symbol', 'type', 'severity', 'owners']);
const FILE_HASH_KEYS = new Set(['path', 'sha256', 'disposition', 'role']);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

export class GlobalsGateError extends Error {
  constructor(code, exitCode = 2, details = {}) {
    super(code);
    this.code = code;
    this.exitCode = exitCode;
    Object.assign(this, details);
  }
}

export function validateIpcInterruptMessage(message, ready = true) {
  if (!ready) throw new GlobalsGateError('IPC_MESSAGE_BEFORE_READY', 2);
  if (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(message))
  )
    throw new GlobalsGateError('IPC_MESSAGE_INVALID_OBJECT', 2);
  const descriptors = Object.getOwnPropertyDescriptors(message);
  const expectedKeys = ['schemaVersion', 'signal', 'type'];
  const actualKeys = Object.keys(descriptors).sort(byteCompare);
  if (
    JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys) ||
    Object.values(descriptors).some(
      descriptor =>
        !Object.hasOwn(descriptor, 'value') ||
        descriptor.get ||
        descriptor.set ||
        descriptor.enumerable !== true
    )
  )
    throw new GlobalsGateError('IPC_MESSAGE_INVALID_KEYS', 2);
  if (
    message.type !== 'AERP_QA_GLOBALS_INTERRUPT' ||
    message.schemaVersion !== IPC_SCHEMA_VERSION ||
    !['SIGINT', 'SIGTERM'].includes(message.signal)
  )
    throw new GlobalsGateError('IPC_MESSAGE_INVALID_VALUE', 2);
  return { signal: message.signal };
}

export function requestControlledInterruption(control, signal, source) {
  if (!['SIGINT', 'SIGTERM'].includes(signal))
    throw new GlobalsGateError('INTERRUPTION_SIGNAL_INVALID', 2);
  if (control.finished) return { accepted: false, code: 'INTERRUPTION_AFTER_FINISH' };
  if (control.signal)
    return { accepted: false, code: 'INTERRUPTION_ALREADY_REQUESTED', signal: control.signal };
  control.signal = signal;
  control.interruptionSource = source;
  return { accepted: true, code: 'INTERRUPTION_ACCEPTED', signal };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function byteCompare(left, right) {
  return Buffer.compare(Buffer.from(left.normalize('NFC')), Buffer.from(right.normalize('NFC')));
}

function stableEvidencePayload(value) {
  const stable = { ...value };
  delete stable.schemaVersion;
  delete stable.runId;
  delete stable.startedAt;
  delete stable.finishedAt;
  delete stable.aggregateSha256;
  return stable;
}

function refreshAggregateHash(value) {
  value.aggregateSha256 = sha256(JSON.stringify(stableEvidencePayload(value)));
  return value;
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new GlobalsGateError(`INVALID_${label.toUpperCase()}`);
  const own = Object.keys(value);
  if (own.some(key => !keys.has(key)) || [...keys].some(key => !Object.hasOwn(value, key))) {
    throw new GlobalsGateError(`INVALID_${label.toUpperCase()}_KEYS`);
  }
}

function safeRelative(root, value, label) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\0') ||
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  ) {
    throw new GlobalsGateError(`INVALID_${label}`);
  }
  const normalized = value.replaceAll('\\', '/').normalize('NFC');
  if (normalized !== value || normalized.split('/').includes('..'))
    throw new GlobalsGateError(`INVALID_${label}`);
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(path.resolve(root), absolute);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`))
    throw new GlobalsGateError(`INVALID_${label}`);
  return normalized;
}

async function assertPhysical(rootReal, absolute, label) {
  const stat = await lstat(absolute);
  if (stat.isSymbolicLink()) throw new GlobalsGateError(`UNSAFE_REPARSE_POINT_${label}`, 1);
  const physical = await realpath(absolute);
  const relative = path.relative(rootReal, physical);
  if (relative === '..' || relative.startsWith(`..${path.sep}`))
    throw new GlobalsGateError(`PHYSICAL_PATH_ESCAPE_${label}`, 1);
  if (
    (process.platform === 'win32' ? physical.toLowerCase() : physical) !==
    (process.platform === 'win32' ? absolute.toLowerCase() : absolute)
  ) {
    throw new GlobalsGateError(`UNSAFE_REPARSE_POINT_${label}`, 1);
  }
  return stat;
}

export async function loadGlobalsManifest(root, manifestPath = MANIFEST) {
  const relative = safeRelative(root, manifestPath, 'MANIFEST_PATH');
  let raw;
  try {
    raw = await readFile(path.join(root, relative), 'utf8');
  } catch {
    throw new GlobalsGateError('MANIFEST_READ_FAILED');
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new GlobalsGateError('MANIFEST_JSON_INVALID');
  }
  exactKeys(manifest, MANIFEST_KEYS, 'MANIFEST');
  if (
    manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
    !/^\d+\.\d+\.\d+$/.test(manifest.canonicalNodeVersion)
  )
    throw new GlobalsGateError('MANIFEST_VERSION_INVALID');
  if (
    !Array.isArray(manifest.includedFiles) ||
    !Array.isArray(manifest.excludedFiles) ||
    !Array.isArray(manifest.publicEntrypoints) ||
    !Array.isArray(manifest.exceptions)
  )
    throw new GlobalsGateError('MANIFEST_ARRAY_INVALID');
  exactKeys(manifest.policy, POLICY_KEYS, 'POLICY');
  const expectedPolicy = [
    'error',
    'error',
    'critical',
    'error',
    'error',
    'warning',
    'error',
    'error',
    'error'
  ];
  if ([...POLICY_KEYS].some((key, index) => manifest.policy[key] !== expectedPolicy[index]))
    throw new GlobalsGateError('POLICY_INVALID');
  const normalizeEntries = (entries, keys, label) =>
    entries.map((entry, index) => {
      exactKeys(entry, keys, label);
      const normalized = {
        ...entry,
        path: safeRelative(root, entry.path, `${label}_${index}_PATH`)
      };
      for (const [key, value] of Object.entries(normalized))
        if (typeof value !== 'string' || !value.trim())
          throw new GlobalsGateError(`INVALID_${label}_${key.toUpperCase()}`);
      return normalized;
    });
  const includedFiles = normalizeEntries(manifest.includedFiles, INCLUDED_KEYS, 'INCLUDED');
  const excludedFiles = normalizeEntries(manifest.excludedFiles, EXCLUDED_KEYS, 'EXCLUDED');
  const roles = new Set(['production', 'legacy-adapter', 'ambiguous-embedded-tests']);
  const classifications = new Set(['productive', 'non-productive', 'ambiguous']);
  if (
    includedFiles.some(item => !roles.has(item.role) || !classifications.has(item.classification))
  )
    throw new GlobalsGateError('INCLUDED_CLASSIFICATION_INVALID');
  if (
    includedFiles.some(item => item.path.endsWith('.test.js') || item.path === 'eslint.config.js')
  )
    throw new GlobalsGateError('NODE_FILE_INCLUDED_AS_RUNTIME', 1);
  if (
    manifest.publicEntrypoints.some(
      name => typeof name !== 'string' || !IDENTIFIER.test(name) || name !== name.normalize('NFC')
    )
  )
    throw new GlobalsGateError('PUBLIC_ENTRYPOINT_INVALID');
  const exceptions = manifest.exceptions.map((item, index) => {
    exactKeys(item, EXCEPTION_KEYS, 'EXCEPTION');
    if (
      typeof item.symbol !== 'string' ||
      typeof item.type !== 'string' ||
      typeof item.justification !== 'string' ||
      !item.justification.trim() ||
      !Array.isArray(item.paths) ||
      item.paths.length < 2
    )
      throw new GlobalsGateError(`INVALID_EXCEPTION_${index}`);
    const paths = item.paths
      .map((entry, pathIndex) => safeRelative(root, entry, `EXCEPTION_${index}_PATH_${pathIndex}`))
      .sort(byteCompare);
    if (new Set(paths).size !== paths.length)
      throw new GlobalsGateError('EXCEPTION_PATH_DUPLICATE');
    return { ...item, symbol: item.symbol.normalize('NFC'), paths };
  });
  const all = [...includedFiles, ...excludedFiles];
  const exact = new Set();
  const folded = new Set();
  for (const item of all) {
    if (exact.has(item.path)) throw new GlobalsGateError('DUPLICATE_OR_OVERLAPPING_PATH', 1);
    exact.add(item.path);
    const key = item.path.toLowerCase();
    if (folded.has(key)) throw new GlobalsGateError('CASEFOLD_PATH_COLLISION', 1);
    folded.add(key);
  }
  return { ...manifest, includedFiles, excludedFiles, exceptions, raw };
}

export function applyExceptions(collisions, exceptions) {
  const used = [];
  const remaining = [];
  for (const collision of collisions) {
    const paths = [...new Set(collision.owners.map(item => item.path))].sort(byteCompare);
    const match = exceptions.find(
      item =>
        item.symbol === collision.symbol &&
        item.type === collision.type &&
        item.paths.length === paths.length &&
        item.paths.every((entry, index) => entry === paths[index])
    );
    if (match) used.push(match);
    else remaining.push(collision);
  }
  return {
    collisions: remaining,
    used,
    obsolete: exceptions.filter(item => !used.includes(item))
  };
}

export async function discoverJavaScript(root) {
  const absoluteRoot = path.resolve(root);
  const rootReal = await realpath(absoluteRoot);
  if (
    (process.platform === 'win32' ? rootReal.toLowerCase() : rootReal) !==
    (process.platform === 'win32' ? absoluteRoot.toLowerCase() : absoluteRoot)
  )
    throw new GlobalsGateError('UNSAFE_REPOSITORY_ROOT', 1);
  const files = [];
  async function walk(directory, relative = '') {
    await assertPhysical(rootReal, directory, 'DIRECTORY');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORE_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      const rel = path.join(relative, entry.name).split(path.sep).join('/').normalize('NFC');
      const stat = await assertPhysical(rootReal, absolute, 'ENTRY');
      if (stat.isDirectory()) await walk(absolute, rel);
      else if (stat.isFile() && entry.name.endsWith('.js')) files.push(rel);
    }
  }
  await walk(absoluteRoot);
  return files.sort(byteCompare);
}

export function assertInventory(manifest, discovered) {
  const included = manifest.includedFiles.map(item => item.path).sort(byteCompare);
  const excluded = manifest.excludedFiles.map(item => item.path).sort(byteCompare);
  const declared = [...included, ...excluded].sort(byteCompare);
  const actual = [...discovered].sort(byteCompare);
  if (declared.length !== actual.length || declared.some((item, index) => item !== actual[index]))
    throw new GlobalsGateError('JAVASCRIPT_INVENTORY_MISMATCH', 1);
  return { included, excluded, discovered: actual };
}

function canonicalNode(node) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(canonicalNode);
  const ignored = new Set(['loc', 'range', 'start', 'end', 'raw', 'parent']);
  return Object.fromEntries(
    Object.keys(node)
      .filter(key => !ignored.has(key))
      .sort(byteCompare)
      .map(key => [key, canonicalNode(node[key])])
  );
}

function boundNames(pattern, output = []) {
  if (!pattern) return output;
  if (pattern.type === 'Identifier') output.push(pattern);
  else if (pattern.type === 'RestElement') boundNames(pattern.argument, output);
  else if (pattern.type === 'AssignmentPattern') boundNames(pattern.left, output);
  else if (pattern.type === 'ArrayPattern')
    pattern.elements.forEach(item => boundNames(item, output));
  else if (pattern.type === 'ObjectPattern')
    pattern.properties.forEach(item =>
      boundNames(item.type === 'RestElement' ? item.argument : item.value, output)
    );
  return output;
}

function staticProperty(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (
    member.computed &&
    member.property.type === 'Literal' &&
    typeof member.property.value === 'string'
  )
    return member.property.value;
  return null;
}

function signature(node) {
  if (node.type === 'FunctionDeclaration')
    return `function(${node.params.map(parameter => JSON.stringify(canonicalNode(parameter))).join(',')})`;
  if (node.type === 'ClassDeclaration') return 'class';
  if (node.type === 'VariableDeclarator') return `variable:${node.init?.type || 'undefined'}`;
  return node.type;
}

export function analyzeSource(source, file, role, publicEntrypoints) {
  const captured = { ast: null, sourceCode: null };
  const captureRule = {
    create(context) {
      return {
        Program(node) {
          captured.ast = node;
          captured.sourceCode = context.sourceCode;
        }
      };
    }
  };
  const linter = new Linter();
  const messages = linter.verify(
    source,
    [
      {
        languageOptions: { ecmaVersion: 'latest', sourceType: 'script' },
        plugins: { local: { rules: { capture: captureRule } } },
        rules: { 'local/capture': 'error' }
      }
    ],
    { filename: file }
  );
  if (!captured.ast || messages.some(item => item.fatal))
    return {
      occurrences: [],
      dynamic: [
        {
          type: 'parse-error',
          file,
          line: messages[0]?.line || 1,
          column: messages[0]?.column || 1,
          code: 'PARSE_ERROR'
        }
      ]
    };
  if (!captured.sourceCode.scopeManager || !captured.sourceCode.visitorKeys)
    return {
      occurrences: [],
      dynamic: [{ type: 'parse-error', file, line: 1, column: 1, code: 'AST_SCOPE_INCOMPLETE' }]
    };
  const occurrences = [];
  const dynamic = [];
  const scopeManager = captured.sourceCode.scopeManager;
  const referenceByIdentifier = new WeakMap();
  for (const scope of scopeManager.scopes)
    for (const reference of [...scope.references, ...(scope.through || [])])
      referenceByIdentifier.set(reference.identifier, reference);

  const referenceFor = identifier => referenceByIdentifier.get(identifier) || null;
  const builtinState = (identifier, name) => {
    if (identifier?.type !== 'Identifier' || identifier.name !== name) return 'different';
    const reference = referenceFor(identifier);
    if (!reference) return 'ambiguous';
    return !reference.resolved || reference.resolved.defs.length === 0 ? 'builtin' : 'shadowed';
  };
  const isExpectedBuiltin = (identifier, name) => {
    return builtinState(identifier, name) === 'builtin';
  };
  const globalScope = scopeManager.globalScope || scopeManager.scopes[0];
  const globalVariables = new Set(globalScope?.variables || []);
  const variableForIdentifier = identifier => referenceFor(identifier)?.resolved || null;
  const variableForDefinition = (name, definitionNode) =>
    [...globalVariables].find(
      variable =>
        variable.name === name &&
        variable.defs.some(definition =>
          [definition.node, definition.name, definition.parent].includes(definitionNode)
        )
    ) || null;

  const unwrapExpression = node => {
    let current = node;
    while (current && ['ChainExpression', 'ParenthesizedExpression'].includes(current.type))
      current = current.expression;
    return current;
  };

  const aliasWrites = new Map();
  const recordAliasWrite = (identifier, expression, node) => {
    const variable =
      variableForIdentifier(identifier) || variableForDefinition(identifier.name, identifier);
    if (!variable || !globalVariables.has(variable)) return;
    if (!aliasWrites.has(variable)) aliasWrites.set(variable, []);
    aliasWrites.get(variable).push({ expression, node });
  };

  const preliminaryVisitors = captured.sourceCode.visitorKeys;
  const preliminaryAncestors = [];
  const collectAliasWrites = node => {
    const inFunction = preliminaryAncestors.some(item => /Function/.test(item.type));
    if (!inFunction && node.type === 'VariableDeclarator' && node.id.type === 'Identifier')
      recordAliasWrite(node.id, node.init, node);
    if (
      !inFunction &&
      node.type === 'AssignmentExpression' &&
      node.operator === '=' &&
      node.left.type === 'Identifier'
    )
      recordAliasWrite(node.left, node.right, node);
    preliminaryAncestors.push(node);
    for (const key of preliminaryVisitors[node.type] || []) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(item => item && collectAliasWrites(item));
      else if (child) collectAliasWrites(child);
    }
    preliminaryAncestors.pop();
  };
  collectAliasWrites(captured.ast);

  const aliasKinds = new Map();
  const expressionContainsBuiltin = (expression, name) => {
    let found = false;
    const visitExpression = node => {
      if (!node || found) return;
      if (node.type === 'Identifier' && isExpectedBuiltin(node, name)) {
        found = true;
        return;
      }
      for (const key of preliminaryVisitors[node.type] || []) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach(visitExpression);
        else visitExpression(child);
      }
    };
    visitExpression(expression);
    return found;
  };
  const classifyAliasExpression = expression => {
    const node = unwrapExpression(expression);
    if (!node) return 'uninitialized';
    if (node.type === 'AssignmentExpression' && node.operator === '=')
      return classifyAliasExpression(node.right);
    if (node.type === 'Identifier') {
      for (const name of ['globalThis', 'eval', 'Function'])
        if (isExpectedBuiltin(node, name)) return name;
      const variable = variableForIdentifier(node);
      return aliasKinds.get(variable) || 'other';
    }
    if (expressionContainsBuiltin(node, 'globalThis')) return 'ambiguous';
    if (expressionContainsBuiltin(node, 'eval')) return 'ambiguous';
    if (expressionContainsBuiltin(node, 'Function')) return 'ambiguous';
    return 'other';
  };
  for (let pass = 0; pass < aliasWrites.size + 1; pass += 1) {
    let changed = false;
    for (const [variable, writes] of aliasWrites) {
      const kinds = writes
        .map(write => classifyAliasExpression(write.expression))
        .filter(kind => kind !== 'uninitialized');
      const next =
        kinds.length && new Set(kinds).size === 1 && !['other', 'ambiguous'].includes(kinds[0])
          ? kinds[0]
          : kinds.some(kind => ['globalThis', 'eval', 'Function', 'ambiguous'].includes(kind))
            ? 'ambiguous'
            : null;
      if (next && aliasKinds.get(variable) !== next) {
        aliasKinds.set(variable, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const [variable, kind] of aliasKinds)
    if (kind === 'ambiguous') {
      const write = aliasWrites.get(variable).at(-1);
      dynamic.push({
        type: 'dynamic-global-unverifiable',
        file,
        line: write.node.loc.start.line,
        column: write.node.loc.start.column + 1,
        code: 'GLOBAL_ALIAS_UNVERIFIABLE'
      });
    }

  const targetKind = identifier => {
    if (isExpectedBuiltin(identifier, 'globalThis')) return 'globalThis';
    if (builtinState(identifier, 'globalThis') === 'ambiguous') return 'ambiguous';
    const variable = variableForIdentifier(identifier);
    return aliasKinds.get(variable) || null;
  };
  const declarations = new Map();
  const declarationVariables = new Map();
  const add = (symbol, node, ownerClass, extra = {}) => {
    const normalized = symbol.normalize('NFC');
    occurrences.push({
      symbol: normalized,
      originalSymbol: symbol,
      path: file,
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
      astType: node.type,
      ownerClass,
      structuralSignature: signature(node),
      nodeSha256: sha256(JSON.stringify(canonicalNode(node))),
      publicEntrypoint: publicEntrypoints.has(normalized),
      fileRole: role,
      selfExport: ownerClass === 'selfExport',
      ...extra
    });
  };
  for (const statement of captured.ast.body) {
    if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
      if (statement.id) {
        add(statement.id.name, statement, 'declaration');
        declarations.set(statement.id.name, statement);
        declarationVariables.set(
          statement.id.name,
          variableForDefinition(statement.id.name, statement)
        );
      }
    }
    if (statement.type === 'VariableDeclaration')
      for (const declarator of statement.declarations)
        for (const id of boundNames(declarator.id)) {
          add(id.name, declarator, 'declaration');
          declarations.set(id.name, declarator);
          declarationVariables.set(id.name, variableForDefinition(id.name, declarator));
        }
    if (statement.type === 'ImportDeclaration' || statement.type.startsWith('Export'))
      dynamic.push({
        type: 'node-runtime-pattern',
        file,
        line: statement.loc.start.line,
        column: statement.loc.start.column + 1,
        code: 'MODULE_SYNTAX'
      });
  }
  const visitors = captured.sourceCode.visitorKeys;
  const ancestors = [];
  const visit = node => {
    const inFunction = ancestors.some(item => /Function/.test(item.type));
    if (
      node.type === 'VariableDeclaration' &&
      node.kind === 'var' &&
      !inFunction &&
      !captured.ast.body.includes(node)
    )
      for (const declarator of node.declarations)
        for (const id of boundNames(declarator.id)) {
          add(id.name, declarator, 'declaration');
          declarations.set(id.name, declarator);
        }
    const reportDynamic = (target, code = 'DYNAMIC_CODE') =>
      dynamic.push({
        type: 'dynamic-global-unverifiable',
        file,
        line: target.loc.start.line,
        column: target.loc.start.column + 1,
        code
      });
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const callee = unwrapExpression(node.callee);
      let dynamicKind = null;
      if (callee?.type === 'Identifier') {
        if (
          isExpectedBuiltin(callee, 'eval') ||
          aliasKinds.get(variableForIdentifier(callee)) === 'eval'
        )
          dynamicKind = 'eval';
        if (
          isExpectedBuiltin(callee, 'Function') ||
          aliasKinds.get(variableForIdentifier(callee)) === 'Function'
        )
          dynamicKind = 'Function';
        if (aliasKinds.get(variableForIdentifier(callee)) === 'ambiguous')
          reportDynamic(node, 'DYNAMIC_ALIAS_UNVERIFIABLE');
        if (
          ['eval', 'Function'].includes(callee.name) &&
          builtinState(callee, callee.name) === 'ambiguous'
        )
          reportDynamic(node, 'DYNAMIC_BINDING_UNVERIFIABLE');
      } else if (callee?.type === 'SequenceExpression') {
        const last = unwrapExpression(callee.expressions.at(-1));
        if (isExpectedBuiltin(last, 'eval')) dynamicKind = 'eval';
        else if (isExpectedBuiltin(last, 'Function')) dynamicKind = 'Function';
        else if (aliasKinds.get(variableForIdentifier(last)) === 'eval') dynamicKind = 'eval';
        else if (aliasKinds.get(variableForIdentifier(last)) === 'Function')
          dynamicKind = 'Function';
        else if (aliasKinds.get(variableForIdentifier(last)) === 'ambiguous')
          reportDynamic(node, 'DYNAMIC_ALIAS_UNVERIFIABLE');
        else if (!variableForIdentifier(last)) reportDynamic(node, 'INDIRECT_CALL_UNVERIFIABLE');
      } else if (callee?.type === 'MemberExpression') {
        const object = unwrapExpression(callee.object);
        const property = staticProperty(callee);
        const kind = object?.type === 'Identifier' ? targetKind(object) : null;
        if (kind === 'globalThis' && ['eval', 'Function'].includes(property))
          dynamicKind = property;
        else if (kind === 'ambiguous') reportDynamic(node, 'DYNAMIC_ALIAS_UNVERIFIABLE');
      }
      if (dynamicKind) reportDynamic(node);
    }
    const calleeName =
      node.type === 'CallExpression' && node.callee.type === 'Identifier' ? node.callee.name : null;
    if (
      calleeName === 'require' ||
      (node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        ['module', 'exports'].includes(node.object.name))
    )
      dynamic.push({
        type: 'node-runtime-pattern',
        file,
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
        code: 'NODE_RUNTIME_PATTERN'
      });
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') {
      const object = node.left.object;
      const topThis = object.type === 'ThisExpression' && !inFunction;
      const kind = object.type === 'Identifier' ? targetKind(object) : null;
      const actualGlobalThis = kind === 'globalThis';
      if (kind === 'ambiguous') reportDynamic(node, 'GLOBAL_ALIAS_UNVERIFIABLE');
      if (topThis || actualGlobalThis) {
        const name = staticProperty(node.left);
        if (!name)
          dynamic.push({
            type: 'dynamic-global-unverifiable',
            file,
            line: node.loc.start.line,
            column: node.loc.start.column + 1,
            code: 'COMPUTED_GLOBAL'
          });
        else if (
          actualGlobalThis &&
          node.right.type === 'Identifier' &&
          node.right.name === name &&
          declarations.has(name) &&
          variableForIdentifier(node.right) === declarationVariables.get(name)
        )
          add(name, node, 'selfExport', { selfExport: true });
        else add(name, node, 'assignment');
      }
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const objectIdentifier = node.callee.object;
      const objectName = objectIdentifier.type === 'Identifier' ? objectIdentifier.name : null;
      const method = staticProperty(node.callee);
      if (
        (isExpectedBuiltin(objectIdentifier, 'Object') &&
          ['defineProperty', 'defineProperties'].includes(method)) ||
        (isExpectedBuiltin(objectIdentifier, 'Reflect') && method === 'set')
      ) {
        const target = node.arguments[0];
        const kind = target?.type === 'Identifier' ? targetKind(target) : null;
        if (kind === 'ambiguous') reportDynamic(node, 'GLOBAL_ALIAS_UNVERIFIABLE');
        if (kind === 'globalThis') {
          const descriptorIsStatic = descriptor => {
            if (descriptor?.type !== 'ObjectExpression') return false;
            const allowed = new Set(['value', 'writable', 'enumerable', 'configurable']);
            return descriptor.properties.every(property => {
              if (property.type !== 'Property' || property.computed || property.kind !== 'init')
                return false;
              const key = property.key.name || property.key.value;
              if (!allowed.has(key)) return false;
              if (key === 'value')
                return [
                  'Literal',
                  'Identifier',
                  'FunctionExpression',
                  'ArrowFunctionExpression'
                ].includes(property.value.type);
              return property.value.type === 'Literal' && typeof property.value.value === 'boolean';
            });
          };
          if (method === 'defineProperties' && node.arguments[1]?.type === 'ObjectExpression')
            for (const property of node.arguments[1].properties) {
              const name =
                property.type !== 'Property'
                  ? null
                  : property.computed
                    ? property.key.type === 'Literal'
                      ? property.key.value
                      : null
                    : property.key.name || property.key.value;
              if (
                typeof name === 'string' &&
                property.type === 'Property' &&
                !property.computed &&
                descriptorIsStatic(property.value)
              )
                add(name, property, 'assignment');
              else reportDynamic(node, 'GLOBAL_DESCRIPTOR_UNVERIFIABLE');
            }
          else {
            const key = node.arguments[1];
            const name =
              key?.type === 'Literal' && typeof key.value === 'string' ? key.value : null;
            const descriptor = method === 'defineProperty' ? node.arguments[2] : null;
            if (method === 'Reflect' || (method === 'set' && objectName === 'Reflect')) {
              if (name) add(name, node, 'assignment');
              else reportDynamic(node, 'COMPUTED_GLOBAL');
            } else if (name && descriptorIsStatic(descriptor)) add(name, node, 'assignment');
            else reportDynamic(node, name ? 'GLOBAL_DESCRIPTOR_UNVERIFIABLE' : 'COMPUTED_GLOBAL');
          }
        }
      } else if (
        ['Object', 'Reflect'].includes(objectName) &&
        builtinState(objectIdentifier, objectName) === 'ambiguous'
      ) {
        reportDynamic(node, 'BUILTIN_BINDING_UNVERIFIABLE');
      }
    }
    ancestors.push(node);
    for (const key of visitors[node.type] || []) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(item => item && visit(item));
      else if (child) visit(child);
    }
    ancestors.pop();
  };
  visit(captured.ast);
  return { occurrences, dynamic };
}

export function classifyCollisions(occurrences) {
  const byNfc = new Map();
  for (const occurrence of occurrences) {
    const key = occurrence.symbol.normalize('NFC');
    if (!byNfc.has(key)) byNfc.set(key, []);
    byNfc.get(key).push(occurrence);
  }
  const collisions = [];
  for (const [symbol, all] of byNfc) {
    const owners = all
      .filter(item => item.ownerClass !== 'selfExport')
      .sort((left, right) =>
        byteCompare(
          `${left.path}\0${String(left.line).padStart(8, '0')}\0${left.symbol}`,
          `${right.path}\0${String(right.line).padStart(8, '0')}\0${right.symbol}`
        )
      );
    if (owners.length > 1) {
      const hashes = new Set(owners.map(item => item.nodeSha256));
      const roles = new Set(owners.map(item => item.fileRole));
      let type = hashes.size === 1 ? 'equivalent-duplicate' : 'duplicate-declaration';
      if (new Set(owners.map(item => item.originalSymbol)).size > 1)
        type = 'unicode-normalization-collision';
      if (
        owners.some(item => item.ownerClass === 'assignment') &&
        owners.some(item => item.ownerClass === 'declaration')
      )
        type = 'declaration-assignment-collision';
      if (roles.has('ambiguous-embedded-tests') && roles.size > 1)
        type = 'test-production-collision';
      if (
        owners.some(item => item.publicEntrypoint) &&
        new Set(owners.map(item => item.structuralSignature)).size > 1
      )
        type = 'incompatible-public-entrypoint';
      collisions.push({
        symbol,
        type,
        severity: type === 'incompatible-public-entrypoint' ? 'critical' : 'high',
        owners
      });
    }
  }
  const folded = new Map();
  for (const symbol of byNfc.keys()) {
    const key = symbol.toLowerCase();
    if (!folded.has(key)) folded.set(key, []);
    folded.get(key).push(symbol);
  }
  for (const symbols of folded.values())
    if (new Set(symbols).size > 1) {
      const owners = symbols
        .flatMap(symbol => byNfc.get(symbol))
        .sort((left, right) =>
          byteCompare(`${left.path}\0${left.symbol}`, `${right.path}\0${right.symbol}`)
        );
      collisions.push({
        symbol: symbols.sort(byteCompare).join('|'),
        type: 'casefold-confusable',
        severity: owners.some(item => item.publicEntrypoint) ? 'high' : 'warning',
        owners
      });
    }
  return collisions.sort((a, b) => byteCompare(a.symbol, b.symbol));
}

function gitMetadata(root) {
  const run = args => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  const commit = run(['rev-parse', 'HEAD']);
  const status = run(['status', '--porcelain=v1', '--untracked-files=all']);
  return {
    commit: commit.status === 0 ? commit.stdout.trim() : null,
    workingTree: status.status === 0 ? (status.stdout.trim() ? 'dirty' : 'clean') : 'unknown'
  };
}

function assertEvidenceRelativePath(value, label) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.normalize('NFC') ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    value.split('/').includes('..')
  )
    throw new GlobalsGateError(`INVALID_${label}`, 3);
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new GlobalsGateError(`INVALID_${label}`, 3);
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw new GlobalsGateError(`INVALID_${label}`, 3);
}

function assertDeterministicOrder(items, selector, label) {
  for (let index = 1; index < items.length; index += 1)
    if (byteCompare(selector(items[index - 1]), selector(items[index])) > 0)
      throw new GlobalsGateError(`INVALID_${label}_ORDER`, 3);
}

export async function validateGlobalsEvidence(
  value,
  { root = null, manifestPath = MANIFEST, verifyArtifacts = false } = {}
) {
  exactKeys(value, EVIDENCE_KEYS, 'EVIDENCE');
  if (
    value.schemaVersion !== EVIDENCE_SCHEMA_VERSION ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.runId) ||
    !Number.isFinite(Date.parse(value.startedAt)) ||
    !Number.isFinite(Date.parse(value.finishedAt)) ||
    Date.parse(value.finishedAt) < Date.parse(value.startedAt)
  )
    throw new GlobalsGateError('EVIDENCE_SCHEMA_INVALID', 3);
  exactKeys(value.runtime, new Set(['node', 'eslint', 'parser']), 'EVIDENCE_RUNTIME');
  if (
    !/^\d+\.\d+\.\d+$/.test(value.runtime.node) ||
    !/^\d+\.\d+\.\d+$/.test(value.runtime.eslint) ||
    typeof value.runtime.parser !== 'string' ||
    !value.runtime.parser
  )
    throw new GlobalsGateError('INVALID_EVIDENCE_RUNTIME', 3);
  exactKeys(value.repository, new Set(['commit', 'workingTree']), 'EVIDENCE_REPOSITORY');
  if (
    (value.repository.commit !== null && !/^[0-9a-f]{40}$/.test(value.repository.commit)) ||
    !['clean', 'dirty', 'unknown'].includes(value.repository.workingTree)
  )
    throw new GlobalsGateError('INVALID_EVIDENCE_REPOSITORY', 3);
  if (value.manifestSha256 !== null) assertSha256(value.manifestSha256, 'MANIFEST_SHA256');
  exactKeys(
    value.inventory,
    new Set(['included', 'excluded', 'discovered', 'fileHashes']),
    'EVIDENCE_INVENTORY'
  );
  for (const key of ['included', 'excluded', 'discovered']) {
    if (!Array.isArray(value.inventory[key]))
      throw new GlobalsGateError(`INVALID_INVENTORY_${key.toUpperCase()}`, 3);
    for (const filePath of value.inventory[key])
      assertEvidenceRelativePath(filePath, 'INVENTORY_PATH');
    assertDeterministicOrder(value.inventory[key], item => item, `INVENTORY_${key.toUpperCase()}`);
    if (new Set(value.inventory[key]).size !== value.inventory[key].length)
      throw new GlobalsGateError(`DUPLICATE_INVENTORY_${key.toUpperCase()}`, 3);
  }
  if (!Array.isArray(value.inventory.fileHashes))
    throw new GlobalsGateError('INVALID_EVIDENCE_FILE_HASHES', 3);
  for (const item of value.inventory.fileHashes) {
    exactKeys(item, FILE_HASH_KEYS, 'EVIDENCE_FILE_HASH');
    assertEvidenceRelativePath(item.path, 'FILE_HASH_PATH');
    assertSha256(item.sha256, 'FILE_SHA256');
    if (
      !['included', 'excluded'].includes(item.disposition) ||
      !['production', 'legacy-adapter', 'ambiguous-embedded-tests', 'excluded'].includes(
        item.role
      ) ||
      (item.disposition === 'excluded') !== (item.role === 'excluded')
    )
      throw new GlobalsGateError('INVALID_EVIDENCE_FILE_HASH', 3);
  }
  assertDeterministicOrder(value.inventory.fileHashes, item => item.path, 'FILE_HASH');
  const union = [...value.inventory.included, ...value.inventory.excluded].sort(byteCompare);
  if (
    JSON.stringify(union) !== JSON.stringify(value.inventory.discovered) ||
    JSON.stringify(value.inventory.fileHashes.map(item => item.path)) !==
      JSON.stringify(value.inventory.discovered)
  )
    throw new GlobalsGateError('EVIDENCE_INVENTORY_INCONSISTENT', 3);
  exactKeys(
    value.counts,
    new Set([
      'includedFiles',
      'excludedFiles',
      'uniqueSymbols',
      'occurrences',
      'duplicateSymbols',
      'dynamicConstructions'
    ]),
    'EVIDENCE_COUNTS'
  );
  for (const count of Object.values(value.counts)) assertNonNegativeInteger(count, 'COUNT');
  if (!Array.isArray(value.occurrences) || !Array.isArray(value.dynamicConstructions))
    throw new GlobalsGateError('INVALID_EVIDENCE_ARRAYS', 3);
  for (const occurrence of value.occurrences) {
    exactKeys(occurrence, OCCURRENCE_KEYS, 'OCCURRENCE');
    assertEvidenceRelativePath(occurrence.path, 'OCCURRENCE_PATH');
    assertNonNegativeInteger(occurrence.line, 'OCCURRENCE_LINE');
    assertNonNegativeInteger(occurrence.column, 'OCCURRENCE_COLUMN');
    assertSha256(occurrence.nodeSha256, 'NODE_SHA256');
    if (
      typeof occurrence.symbol !== 'string' ||
      typeof occurrence.originalSymbol !== 'string' ||
      typeof occurrence.astType !== 'string' ||
      !['declaration', 'assignment', 'selfExport'].includes(occurrence.ownerClass) ||
      typeof occurrence.structuralSignature !== 'string' ||
      typeof occurrence.publicEntrypoint !== 'boolean' ||
      !['production', 'legacy-adapter', 'ambiguous-embedded-tests'].includes(occurrence.fileRole) ||
      typeof occurrence.selfExport !== 'boolean' ||
      occurrence.selfExport !== (occurrence.ownerClass === 'selfExport')
    )
      throw new GlobalsGateError('INVALID_OCCURRENCE', 3);
  }
  assertDeterministicOrder(
    value.occurrences,
    item => `${item.path}\0${String(item.line).padStart(8, '0')}\0${item.symbol}`,
    'OCCURRENCE'
  );
  for (const construction of value.dynamicConstructions) {
    exactKeys(construction, DYNAMIC_KEYS, 'DYNAMIC_CONSTRUCTION');
    assertEvidenceRelativePath(construction.file, 'DYNAMIC_PATH');
    assertNonNegativeInteger(construction.line, 'DYNAMIC_LINE');
    assertNonNegativeInteger(construction.column, 'DYNAMIC_COLUMN');
    if (
      !['dynamic-global-unverifiable', 'node-runtime-pattern', 'parse-error'].includes(
        construction.type
      ) ||
      !/^[A-Z0-9_]+$/.test(construction.code)
    )
      throw new GlobalsGateError('INVALID_DYNAMIC_CONSTRUCTION', 3);
  }
  assertDeterministicOrder(
    value.dynamicConstructions,
    item => `${item.file}\0${item.line}\0${item.code}`,
    'DYNAMIC_CONSTRUCTION'
  );
  if (!Array.isArray(value.collisions)) throw new GlobalsGateError('INVALID_COLLISIONS', 3);
  for (const collision of value.collisions) {
    exactKeys(collision, COLLISION_KEYS, 'COLLISION');
    if (
      typeof collision.symbol !== 'string' ||
      ![
        'duplicate-declaration',
        'declaration-assignment-collision',
        'incompatible-public-entrypoint',
        'equivalent-duplicate',
        'test-production-collision',
        'unicode-normalization-collision',
        'casefold-confusable'
      ].includes(collision.type) ||
      !['critical', 'high', 'warning'].includes(collision.severity) ||
      !Array.isArray(collision.owners) ||
      collision.owners.length < 2
    )
      throw new GlobalsGateError('INVALID_COLLISION', 3);
    for (const owner of collision.owners) exactKeys(owner, OCCURRENCE_KEYS, 'COLLISION_OWNER');
    assertDeterministicOrder(
      collision.owners,
      owner => `${owner.path}\0${String(owner.line).padStart(8, '0')}\0${owner.symbol}`,
      'COLLISION_OWNER'
    );
  }
  assertDeterministicOrder(value.collisions, item => item.symbol, 'COLLISION');
  if (!Array.isArray(value.exceptionsUsed) || !Array.isArray(value.obsoleteExceptions))
    throw new GlobalsGateError('INVALID_EXCEPTIONS', 3);
  for (const exception of [...value.exceptionsUsed, ...value.obsoleteExceptions]) {
    exactKeys(exception, EXCEPTION_KEYS, 'EVIDENCE_EXCEPTION');
    if (!Array.isArray(exception.paths)) throw new GlobalsGateError('INVALID_EXCEPTION_PATHS', 3);
    exception.paths.forEach(item => assertEvidenceRelativePath(item, 'EXCEPTION_PATH'));
    assertDeterministicOrder(exception.paths, item => item, 'EXCEPTION_PATH');
  }
  assertDeterministicOrder(
    value.exceptionsUsed,
    item => `${item.symbol}\0${item.type}`,
    'USED_EXCEPTION'
  );
  assertDeterministicOrder(
    value.obsoleteExceptions,
    item => `${item.symbol}\0${item.type}`,
    'OBSOLETE_EXCEPTION'
  );
  exactKeys(value.persistence, new Set(['status', 'path']), 'EVIDENCE_PERSISTENCE');
  if (!['canonical', 'recovery', 'none', 'not-requested'].includes(value.persistence.status))
    throw new GlobalsGateError('INVALID_EVIDENCE_PERSISTENCE', 3);
  if (value.persistence.path !== null)
    assertEvidenceRelativePath(value.persistence.path, 'PERSISTENCE_PATH');
  if (
    (value.persistence.status === 'none' || value.persistence.status === 'not-requested') !==
    (value.persistence.path === null)
  )
    throw new GlobalsGateError('INCONSISTENT_EVIDENCE_PERSISTENCE', 3);
  const derivedCounts = {
    includedFiles: value.inventory.included.length,
    excludedFiles: value.inventory.excluded.length,
    uniqueSymbols: new Set(value.occurrences.map(item => item.symbol.normalize('NFC'))).size,
    occurrences: value.occurrences.length,
    duplicateSymbols: value.collisions.filter(item => item.severity !== 'warning').length,
    dynamicConstructions: value.dynamicConstructions.length
  };
  if (JSON.stringify(value.counts) !== JSON.stringify(derivedCounts))
    throw new GlobalsGateError('EVIDENCE_COUNT_MISMATCH', 3);
  if (
    ![0, 1, 2, 3, 130, 143].includes(value.exitCode) ||
    !['passed', 'failed'].includes(value.result) ||
    value.result !== (value.exitCode === 0 ? 'passed' : 'failed') ||
    !/^[A-Z0-9_]+$/.test(value.failureCode) ||
    (value.exitCode === 0 && value.failureCode !== 'NONE')
  )
    throw new GlobalsGateError('EVIDENCE_RESULT_INCONSISTENT', 3);
  const structuralBlockers =
    value.collisions.some(item => item.severity !== 'warning') ||
    value.dynamicConstructions.length > 0 ||
    value.obsoleteExceptions.length > 0;
  if (
    (value.exitCode === 0 && structuralBlockers) ||
    (value.exitCode === 1 &&
      (!structuralBlockers || value.failureCode !== 'STRUCTURAL_BLOCKERS')) ||
    (value.exitCode === 130 && value.failureCode !== 'INTERRUPTED_SIGINT') ||
    (value.exitCode === 143 && value.failureCode !== 'INTERRUPTED_SIGTERM') ||
    (value.exitCode === 3 && !value.failureCode.startsWith('EVIDENCE_'))
  )
    throw new GlobalsGateError('EVIDENCE_EXIT_SEMANTICS_MISMATCH', 3);
  assertSha256(value.aggregateSha256, 'AGGREGATE_SHA256');
  if (sha256(JSON.stringify(stableEvidencePayload(value))) !== value.aggregateSha256)
    throw new GlobalsGateError('EVIDENCE_AGGREGATE_MISMATCH', 3);
  if (verifyArtifacts) {
    if (!root) throw new GlobalsGateError('EVIDENCE_ROOT_REQUIRED', 3);
    const manifestRelative = safeRelative(root, manifestPath, 'MANIFEST_PATH');
    const manifestBytes = await readFile(path.join(root, manifestRelative));
    if (sha256(manifestBytes) !== value.manifestSha256)
      throw new GlobalsGateError('EVIDENCE_MANIFEST_HASH_MISMATCH', 3);
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const manifestIncluded = manifest.includedFiles.map(item => item.path).sort(byteCompare);
    const manifestExcluded = manifest.excludedFiles.map(item => item.path).sort(byteCompare);
    const exceptionKey = item =>
      JSON.stringify({
        ...item,
        symbol: item.symbol.normalize('NFC'),
        paths: [...item.paths].sort(byteCompare)
      });
    const manifestExceptions = manifest.exceptions.map(exceptionKey).sort(byteCompare);
    const evidenceExceptions = [...value.exceptionsUsed, ...value.obsoleteExceptions]
      .map(exceptionKey)
      .sort(byteCompare);
    if (
      JSON.stringify(manifestIncluded) !== JSON.stringify(value.inventory.included) ||
      JSON.stringify(manifestExcluded) !== JSON.stringify(value.inventory.excluded) ||
      JSON.stringify(evidenceExceptions) !== JSON.stringify(manifestExceptions)
    )
      throw new GlobalsGateError('EVIDENCE_MANIFEST_CONTENT_MISMATCH', 3);
    for (const item of value.inventory.fileHashes)
      if (sha256(await readFile(path.join(root, item.path))) !== item.sha256)
        throw new GlobalsGateError('EVIDENCE_FILE_HASH_MISMATCH', 3);
  }
  const serialized = JSON.stringify(value);
  if (/(?:[A-Z]:\\|\/Users\/|credential|password|secret|token=)/i.test(serialized))
    throw new GlobalsGateError('EVIDENCE_NOT_SANITIZED', 3);
  return value;
}

export async function writeEvidenceAtomic(
  root,
  relativePath,
  evidence,
  dependencies = { mkdir, writeFile, rename, rm }
) {
  await validateGlobalsEvidence(evidence, { root, verifyArtifacts: true });
  const normalizedPath = safeRelative(root, relativePath, 'EVIDENCE_PATH');
  const target = path.join(root, normalizedPath);
  const directory = path.dirname(target);
  const temporary = `${target}.${evidence.runId}.tmp`;
  const recovery = `${target}.${evidence.runId}.recovery.json`;
  const failureEvidence = code => {
    const recoveryPath = path.relative(root, recovery).split(path.sep).join('/');
    return refreshAggregateHash({
      ...evidence,
      result: 'failed',
      exitCode: 3,
      failureCode: code,
      persistence: { status: 'recovery', path: recoveryPath }
    });
  };
  try {
    await dependencies.mkdir(directory, { recursive: true });
  } catch (cause) {
    throw new GlobalsGateError('EVIDENCE_DIRECTORY_FAILED', 3, {
      primaryCode: 'EVIDENCE_DIRECTORY_FAILED',
      causeCode: cause?.code || 'UNKNOWN'
    });
  }
  const cleanupTemporary = async primaryCode => {
    try {
      await dependencies.rm(temporary, { force: true });
    } catch (cause) {
      throw new GlobalsGateError('EVIDENCE_CLEANUP_FAILED', 3, {
        primaryCode,
        secondaryCode: cause?.code || 'UNKNOWN'
      });
    }
  };
  const persistRecovery = async primaryCode => {
    const recovered = failureEvidence(primaryCode);
    await validateGlobalsEvidence(recovered, { root, verifyArtifacts: true });
    try {
      await dependencies.writeFile(recovery, `${JSON.stringify(recovered, null, 2)}\n`, {
        flag: 'wx'
      });
      const persistedRecovery = JSON.parse(await readFile(recovery, 'utf8'));
      await validateGlobalsEvidence(persistedRecovery, { root, verifyArtifacts: true });
      return { recovered: persistedRecovery, recoveryPath: persistedRecovery.persistence.path };
    } catch (cause) {
      throw new GlobalsGateError('EVIDENCE_RECOVERY_FAILED', 3, {
        primaryCode,
        secondaryCode: cause?.code || 'UNKNOWN'
      });
    }
  };
  try {
    await dependencies.writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, {
      flag: 'wx'
    });
  } catch (cause) {
    let result;
    try {
      result = await persistRecovery('EVIDENCE_TEMP_WRITE_FAILED');
    } catch (recoveryError) {
      try {
        await cleanupTemporary('EVIDENCE_TEMP_WRITE_FAILED');
      } catch (cleanupError) {
        recoveryError.cleanupCode = cleanupError.secondaryCode || cleanupError.code;
      }
      throw recoveryError;
    }
    try {
      await cleanupTemporary('EVIDENCE_TEMP_WRITE_FAILED');
    } catch (cleanupError) {
      cleanupError.recoveryPath = result.recoveryPath;
      cleanupError.recoveryEvidence = result.recovered;
      throw cleanupError;
    }
    throw new GlobalsGateError('EVIDENCE_TEMP_WRITE_FAILED', 3, {
      primaryCode: 'EVIDENCE_TEMP_WRITE_FAILED',
      secondaryCode: cause?.code || 'UNKNOWN',
      recoveryPath: result.recoveryPath,
      recoveryEvidence: result.recovered
    });
  }
  try {
    await dependencies.rm(target, { force: true });
    await dependencies.rename(temporary, target);
  } catch (cause) {
    let result;
    try {
      result = await persistRecovery('EVIDENCE_RENAME_FAILED');
    } catch (recoveryError) {
      try {
        await cleanupTemporary('EVIDENCE_RENAME_FAILED');
      } catch (cleanupError) {
        recoveryError.cleanupCode = cleanupError.secondaryCode || cleanupError.code;
      }
      throw recoveryError;
    }
    try {
      await cleanupTemporary('EVIDENCE_RENAME_FAILED');
    } catch (cleanupError) {
      cleanupError.recoveryPath = result.recoveryPath;
      cleanupError.recoveryEvidence = result.recovered;
      throw cleanupError;
    }
    throw new GlobalsGateError('EVIDENCE_RENAME_FAILED', 3, {
      primaryCode: 'EVIDENCE_RENAME_FAILED',
      secondaryCode: cause?.code || 'UNKNOWN',
      recoveryPath: result.recoveryPath,
      recoveryEvidence: result.recovered
    });
  }
  const persisted = JSON.parse(await readFile(target, 'utf8'));
  await validateGlobalsEvidence(persisted, { root, verifyArtifacts: true });
  return { path: normalizedPath, evidence: persisted };
}

export async function runGlobalsGate({
  root = ROOT,
  manifestPath = MANIFEST,
  evidencePath = EVIDENCE,
  persist = true,
  control = { signal: null },
  dependencies = { analyze: analyzeSource }
} = {}) {
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  let exitCode;
  let failureCode;
  let manifest = null;
  let inventory = { included: [], excluded: [], discovered: [], fileHashes: [] };
  let occurrences = [];
  let dynamicConstructions = [];
  let collisions = [];
  let exceptionsUsed = [];
  let obsoleteExceptions = [];
  const assertControlState = () => {
    if (control.signal)
      throw new GlobalsGateError(
        `INTERRUPTED_${control.signal}`,
        control.signal === 'SIGINT' ? 130 : 143
      );
    if (control.ipcFailure) throw new GlobalsGateError(control.ipcFailure, 2);
  };
  try {
    if (persist) {
      const previousTarget = path.join(root, safeRelative(root, evidencePath, 'EVIDENCE_PATH'));
      try {
        await rm(previousTarget, { force: true });
      } catch (cause) {
        throw new GlobalsGateError('EVIDENCE_INVALIDATION_FAILED', 3, {
          causeCode: cause?.code || 'UNKNOWN'
        });
      }
    }
    manifest = await loadGlobalsManifest(root, manifestPath);
    const discovered = await discoverJavaScript(root);
    inventory = assertInventory(manifest, discovered);
    const includedByPath = new Map(manifest.includedFiles.map(item => [item.path, item]));
    inventory.fileHashes = [];
    for (const filePath of inventory.discovered) {
      const includedItem = includedByPath.get(filePath);
      inventory.fileHashes.push({
        path: filePath,
        sha256: sha256(await readFile(path.join(root, filePath))),
        disposition: includedItem ? 'included' : 'excluded',
        role: includedItem?.role || 'excluded'
      });
    }
    assertControlState();
    if (process.version.replace(/^v/, '') !== manifest.canonicalNodeVersion)
      throw new GlobalsGateError('NODE_VERSION_MISMATCH');
    const publicEntrypoints = new Set(manifest.publicEntrypoints);
    for (const item of [...manifest.includedFiles].sort((a, b) => byteCompare(a.path, b.path))) {
      assertControlState();
      const source = await readFile(path.join(root, item.path), 'utf8');
      assertControlState();
      const result = dependencies.analyze(source, item.path, item.role, publicEntrypoints);
      occurrences.push(...result.occurrences);
      dynamicConstructions.push(...result.dynamic);
    }
    collisions = classifyCollisions(occurrences);
    const exceptionResult = applyExceptions(collisions, manifest.exceptions);
    collisions = exceptionResult.collisions;
    exceptionsUsed = exceptionResult.used;
    obsoleteExceptions = exceptionResult.obsolete;
    const parse = dynamicConstructions.some(item => item.type === 'parse-error');
    const blocking =
      collisions.some(item => item.severity !== 'warning') ||
      dynamicConstructions.length ||
      obsoleteExceptions.length;
    exitCode = parse ? 2 : blocking ? 1 : 0;
    failureCode = parse ? 'PARSE_ERROR' : blocking ? 'STRUCTURAL_BLOCKERS' : 'NONE';
  } catch (error) {
    exitCode = error instanceof GlobalsGateError ? error.exitCode : 2;
    failureCode = error instanceof GlobalsGateError ? error.code : 'INTERNAL_FAILURE';
  }
  occurrences.sort((a, b) =>
    byteCompare(
      `${a.path}\0${String(a.line).padStart(8, '0')}\0${a.symbol}`,
      `${b.path}\0${String(b.line).padStart(8, '0')}\0${b.symbol}`
    )
  );
  dynamicConstructions.sort((a, b) =>
    byteCompare(`${a.file}\0${a.line}\0${a.code}`, `${b.file}\0${b.line}\0${b.code}`)
  );
  const metadata = gitMetadata(root);
  const manifestHash = manifest ? sha256(manifest.raw) : null;
  const stable = {
    runtime: {
      node: process.version.replace(/^v/, ''),
      eslint: Linter.version || '10.7.0',
      parser: 'ESLint default parser via public Linter API'
    },
    repository: metadata,
    manifestSha256: manifestHash,
    inventory,
    counts: {
      includedFiles: inventory.included.length,
      excludedFiles: inventory.excluded.length,
      uniqueSymbols: new Set(occurrences.map(item => item.symbol)).size,
      occurrences: occurrences.length,
      duplicateSymbols: collisions.filter(item => item.severity !== 'warning').length,
      dynamicConstructions: dynamicConstructions.length
    },
    occurrences,
    collisions,
    dynamicConstructions,
    exceptionsUsed,
    obsoleteExceptions,
    result: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    failureCode,
    persistence: persist
      ? { status: 'canonical', path: evidencePath }
      : { status: 'not-requested', path: null }
  };
  const evidence = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...stable,
    aggregateSha256: sha256(JSON.stringify(stable))
  };
  if (persist)
    try {
      const persisted = await writeEvidenceAtomic(root, evidencePath, evidence);
      return persisted.evidence;
    } catch (error) {
      if (error.recoveryEvidence) return error.recoveryEvidence;
      return refreshAggregateHash({
        ...evidence,
        exitCode: 3,
        result: 'failed',
        failureCode: error instanceof GlobalsGateError ? error.code : 'EVIDENCE_NOT_PERSISTIBLE',
        persistence: { status: 'none', path: null }
      });
    }
  return evidence;
}

async function main() {
  const control = {
    signal: null,
    interruptionSource: null,
    ipcFailure: null,
    ipcReady: false,
    finished: false
  };
  const requestInterruption = (signal, source) => {
    const result = requestControlledInterruption(control, signal, source);
    if (!result.accepted && !control.finished && result.code !== 'INTERRUPTION_AFTER_FINISH')
      control.ipcFailure = 'IPC_DUPLICATE_INTERRUPT';
  };
  const onSigint = () => requestInterruption('SIGINT', 'operating-system');
  const onSigterm = () => requestInterruption('SIGTERM', 'operating-system');
  const onIpcMessage = message => {
    try {
      const request = validateIpcInterruptMessage(message, control.ipcReady);
      requestInterruption(request.signal, 'ipc');
    } catch (error) {
      control.ipcFailure =
        error instanceof GlobalsGateError ? error.code : 'IPC_PROTOCOL_VIOLATION';
    }
  };
  const onIpcDisconnect = () => {
    if (!control.finished && !control.signal) control.ipcFailure = 'IPC_PARENT_DISCONNECTED';
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  const ipcEnabled = Boolean(process.channel && typeof process.send === 'function');
  if (ipcEnabled) {
    process.on('message', onIpcMessage);
    process.once('disconnect', onIpcDisconnect);
    await new Promise(resolve => {
      process.send({ type: 'AERP_QA_GLOBALS_READY', schemaVersion: IPC_SCHEMA_VERSION }, error => {
        if (error) control.ipcFailure = 'IPC_READY_SEND_FAILED';
        else control.ipcReady = true;
        resolve();
      });
    });
    await waitImmediate();
  }
  let evidence = await runGlobalsGate({ control });
  if (control.signal && evidence.exitCode === 3) {
    process.stderr.write(
      `AERP-QA-001 INTERRUPTION_EVIDENCE_NOT_PERSISTED ${control.signal} ${evidence.failureCode}\n`
    );
    evidence = refreshAggregateHash({
      ...evidence,
      result: 'failed',
      exitCode: control.signal === 'SIGINT' ? 130 : 143,
      failureCode: `INTERRUPTED_${control.signal}`,
      persistence: { status: 'none', path: null }
    });
  }
  control.finished = true;
  process.removeListener('SIGINT', onSigint);
  process.removeListener('SIGTERM', onSigterm);
  if (ipcEnabled) {
    process.removeListener('message', onIpcMessage);
    process.removeListener('disconnect', onIpcDisconnect);
    if (process.connected) process.disconnect();
  }
  process.stdout.write(
    `AERP-QA-001 globals: ${evidence.counts.uniqueSymbols} symbols; ${evidence.counts.duplicateSymbols} duplicate symbols; ${evidence.counts.dynamicConstructions} dynamic violations; evidence=${evidence.persistence.path || 'NONE'}\n`
  );
  process.exitCode = evidence.exitCode;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) await main();
