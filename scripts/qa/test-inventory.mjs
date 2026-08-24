import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const TEST_MANIFEST_SCHEMA_VERSION = '1.0.0';
export const EVIDENCE_SCHEMA_VERSION = '1.1.0';
export const FAILURE_STAGES = Object.freeze([
  'initialization',
  'inventory',
  'metadata',
  'node-version',
  'suite-execution',
  'aggregation',
  'evidence-write',
  'interruption'
]);

const DISCOVERY_IGNORES = new Set(['.git', '.qa-output', 'node_modules']);
const MANIFEST_KEYS = new Set([
  'schemaVersion',
  'canonicalNodeVersion',
  'informativeBaseline',
  'reconciledBaseline',
  'suites'
]);
const INFORMATIVE_BASELINE_KEYS = new Set(['commit', 'date', 'total', 'enforced']);
const RECONCILED_BASELINE_KEYS = new Set(['total', 'contractualThreshold', 'perSuite']);
const EVIDENCE_KEYS = new Set([
  'schemaVersion',
  'runId',
  'startedAt',
  'finishedAt',
  'commit',
  'workingTree',
  'commitDateUtc',
  'runtime',
  'packageLockSha256',
  'inventory',
  'effectiveArguments',
  'perSuite',
  'counts',
  'exitCode',
  'outputSha256',
  'result',
  'failureStage',
  'failureCode',
  'suiteTimeoutMs',
  'maxReporterBytes'
]);
const COUNT_KEYS = ['pass', 'fail', 'skipped', 'todo', 'cancelled', 'total'];
const PER_SUITE_KEYS = new Set([
  'path',
  ...COUNT_KEYS,
  'completed',
  'exitCode',
  'timedOut',
  'interrupted',
  'terminationContext',
  'eventStreamSha256',
  'stderrSha256',
  'stderrBytes',
  'outputBytes'
]);

function assertExactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const missing = [...allowed].filter(key => !Object.hasOwn(value, key));
  const additional = keys.filter(key => !allowed.has(key));
  if (missing.length || additional.length) {
    throw new Error(
      `${label} keys mismatch: missing=${missing.join(',') || 'none'}; additional=${additional.join(',') || 'none'}`
    );
  }
}

function caseFold(value) {
  return value.normalize('NFC').toLowerCase();
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function normalizedPhysicalPath(value) {
  const normalized = path.normalize(value).normalize('NFC');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function normalizeRelativePath(repoRoot, candidate, label) {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  if (candidate.includes('\0')) throw new Error(`${label} contains a null byte`);
  if (path.isAbsolute(candidate) || path.win32.isAbsolute(candidate)) {
    throw new Error(`${label} must be relative to the repository`);
  }

  const resolved = path.resolve(repoRoot, candidate);
  if (!isContained(path.resolve(repoRoot), resolved) || resolved === path.resolve(repoRoot)) {
    throw new Error(`${label} resolves outside the repository`);
  }
  return path.relative(repoRoot, resolved).split(path.sep).join('/');
}

function validateSuiteList(repoRoot, suites, label) {
  if (!Array.isArray(suites)) throw new Error(`${label} must be an array`);
  const normalized = suites.map((suite, index) => {
    const item = normalizeRelativePath(repoRoot, suite, `${label}[${index}]`);
    if (!item.endsWith('.test.js')) throw new Error(`${label}[${index}] must end with .test.js`);
    return item;
  });

  const exact = new Set();
  const folded = new Map();
  for (const item of normalized) {
    if (exact.has(item)) throw new Error(`${label} contains a duplicate suite`);
    exact.add(item);
    const key = caseFold(item);
    if (folded.has(key)) {
      throw new Error(`${label} contains a case-folded collision`);
    }
    folded.set(key, item);
  }
  return normalized;
}

function compareSets(left, right, leftLabel, rightLabel) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const missing = [...leftSet].filter(item => !rightSet.has(item)).sort();
  const additional = [...rightSet].filter(item => !leftSet.has(item)).sort();
  if (missing.length || additional.length) {
    throw new Error(
      `${leftLabel}/${rightLabel} mismatch: missing=${missing.join(',') || 'none'}; additional=${additional.join(',') || 'none'}`
    );
  }
}

export async function loadTestManifest(repoRoot, manifestPath) {
  const relativeManifest = normalizeRelativePath(repoRoot, manifestPath, 'manifestPath');
  const manifest = JSON.parse(await readFile(path.join(repoRoot, relativeManifest), 'utf8'));
  assertExactKeys(manifest, MANIFEST_KEYS, 'test manifest');
  if (manifest.schemaVersion !== TEST_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported test manifest schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.canonicalNodeVersion)) {
    throw new Error('canonicalNodeVersion must be an exact semantic version');
  }
  assertExactKeys(manifest.informativeBaseline, INFORMATIVE_BASELINE_KEYS, 'informativeBaseline');
  if (!/^[0-9a-f]{40}$/.test(manifest.informativeBaseline.commit)) {
    throw new Error('informativeBaseline.commit must be a full lowercase Git hash');
  }
  const baselineDate = new Date(`${manifest.informativeBaseline.date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(manifest.informativeBaseline.date) ||
    Number.isNaN(baselineDate.valueOf()) ||
    baselineDate.toISOString().slice(0, 10) !== manifest.informativeBaseline.date
  ) {
    throw new Error('informativeBaseline.date must be a valid ISO calendar date');
  }
  if (
    !Number.isInteger(manifest.informativeBaseline.total) ||
    manifest.informativeBaseline.total < 0 ||
    manifest.informativeBaseline.enforced !== false
  ) {
    throw new Error('informativeBaseline must be non-negative and non-enforcing');
  }
  assertExactKeys(manifest.reconciledBaseline, RECONCILED_BASELINE_KEYS, 'reconciledBaseline');
  if (
    !Number.isInteger(manifest.reconciledBaseline.total) ||
    manifest.reconciledBaseline.total < 0 ||
    manifest.reconciledBaseline.contractualThreshold !== false
  ) {
    throw new Error('reconciledBaseline must be non-negative and non-contractual');
  }
  const suites = validateSuiteList(repoRoot, manifest.suites, 'declared suites');
  if (suites.length !== 6) throw new Error('exactly six declared suites are required');
  if (
    !manifest.reconciledBaseline.perSuite ||
    typeof manifest.reconciledBaseline.perSuite !== 'object' ||
    Array.isArray(manifest.reconciledBaseline.perSuite)
  ) {
    throw new Error('reconciledBaseline.perSuite must be an object');
  }
  const baselinePaths = Object.keys(manifest.reconciledBaseline.perSuite).sort();
  compareSets([...suites].sort(), baselinePaths, 'declared', 'baseline');
  assertExactKeys(
    manifest.reconciledBaseline.perSuite,
    new Set(suites),
    'reconciledBaseline.perSuite'
  );
  for (const [suitePath, count] of Object.entries(manifest.reconciledBaseline.perSuite)) {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`reconciledBaseline.perSuite.${suitePath} must be a non-negative integer`);
    }
  }
  const baselineTotal = Object.values(manifest.reconciledBaseline.perSuite).reduce(
    (total, count) => total + count,
    0
  );
  if (baselineTotal !== manifest.reconciledBaseline.total) {
    throw new Error('reconciledBaseline per-suite sum is inconsistent');
  }
  return { ...manifest, suites };
}

async function assertSafePhysicalEntry(rootReal, absolutePath, label) {
  const stats = await lstat(absolutePath);
  if (stats.isSymbolicLink()) throw new Error(`${label} is a symbolic link or junction`);
  const physical = await realpath(absolutePath);
  if (!isContained(rootReal, physical)) throw new Error(`${label} realpath escapes the repository`);
  if (normalizedPhysicalPath(physical) !== normalizedPhysicalPath(absolutePath)) {
    throw new Error(`${label} resolves through a reparse point`);
  }
  return { stats, physical };
}

export async function discoverTestSuites(repoRoot) {
  const rootAbsolute = path.resolve(repoRoot);
  const rootStats = await lstat(rootAbsolute);
  if (rootStats.isSymbolicLink()) throw new Error('Repository root is a symbolic link or junction');
  const rootReal = await realpath(rootAbsolute);
  if (normalizedPhysicalPath(rootReal) !== normalizedPhysicalPath(rootAbsolute)) {
    throw new Error('Repository root resolves through a reparse point');
  }
  const discovered = [];

  async function walk(absoluteDirectory, relativeDirectory) {
    await assertSafePhysicalEntry(
      rootReal,
      absoluteDirectory,
      relativeDirectory || 'repository root'
    );
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && DISCOVERY_IGNORES.has(entry.name)) continue;
      const absoluteEntry = path.join(absoluteDirectory, entry.name);
      const relativeEntry = path.join(relativeDirectory, entry.name);
      const { stats } = await assertSafePhysicalEntry(rootReal, absoluteEntry, relativeEntry);
      if (stats.isDirectory()) {
        await walk(absoluteEntry, relativeEntry);
      } else if (stats.isFile() && entry.name.endsWith('.test.js')) {
        discovered.push(relativeEntry.split(path.sep).join('/'));
      }
    }
  }

  await walk(rootAbsolute, '');
  return validateSuiteList(repoRoot, discovered.sort(), 'discovered suites');
}

export function assertExactTestInventory(repoRoot, { declared, discovered, executed }) {
  const normalizedDeclared = validateSuiteList(repoRoot, declared, 'declared suites');
  const normalizedDiscovered = validateSuiteList(repoRoot, discovered, 'discovered suites');
  const normalizedExecuted = validateSuiteList(repoRoot, executed, 'executed suites');
  compareSets(normalizedDeclared, normalizedDiscovered, 'declared', 'discovered');
  compareSets(normalizedDeclared, normalizedExecuted, 'declared', 'executed');
  return {
    declared: normalizedDeclared,
    discovered: [...normalizedDiscovered].sort(),
    executed: normalizedExecuted
  };
}

export function assertCanonicalNodeVersion(actualVersion, expectedVersion) {
  const actual = String(actualVersion).replace(/^v/, '');
  if (actual !== expectedVersion) {
    throw new Error(`Node version mismatch: expected ${expectedVersion}, received ${actual}`);
  }
}

function assertSafeRelativeString(value, field) {
  if (
    typeof value === 'string' &&
    (path.isAbsolute(value) ||
      path.win32.isAbsolute(value) ||
      /(?:^|[\\/])Users[\\/]/i.test(value) ||
      /(?:credential|password|secret|token)=/i.test(value))
  ) {
    throw new Error(`${field} contains sensitive or absolute data`);
  }
}

function validateCounts(counts, label) {
  assertExactKeys(counts, new Set(COUNT_KEYS), label);
  for (const key of COUNT_KEYS) {
    if (!Number.isInteger(counts[key]) || counts[key] < 0) {
      throw new Error(`${label}.${key} is invalid`);
    }
  }
}

export function validateEvidence(evidence) {
  assertExactKeys(evidence, EVIDENCE_KEYS, 'evidence');
  if (evidence.schemaVersion !== EVIDENCE_SCHEMA_VERSION)
    throw new Error('Invalid evidence schema');
  if (!/^[0-9a-f-]{36}$/.test(evidence.runId)) throw new Error('Invalid runId');
  if (!Number.isFinite(Date.parse(evidence.startedAt))) throw new Error('Invalid startedAt');
  if (!Number.isFinite(Date.parse(evidence.finishedAt))) throw new Error('Invalid finishedAt');
  if (Date.parse(evidence.finishedAt) < Date.parse(evidence.startedAt)) {
    throw new Error('finishedAt precedes startedAt');
  }
  if (evidence.commit !== null && !/^[0-9a-f]{40}$/.test(evidence.commit)) {
    throw new Error('Invalid evidence commit');
  }
  if (!['clean', 'dirty', 'unknown'].includes(evidence.workingTree)) {
    throw new Error('Invalid workingTree');
  }
  if (evidence.commitDateUtc !== null && !Number.isFinite(Date.parse(evidence.commitDateUtc))) {
    throw new Error('Invalid commitDateUtc');
  }
  assertExactKeys(evidence.runtime, new Set(['node', 'npm']), 'runtime');
  if (typeof evidence.runtime.node !== 'string') throw new Error('Invalid Node version');
  if (evidence.runtime.npm !== null && typeof evidence.runtime.npm !== 'string') {
    throw new Error('Invalid npm version');
  }
  if (evidence.packageLockSha256 !== null && !/^[0-9a-f]{64}$/.test(evidence.packageLockSha256)) {
    throw new Error('Invalid package-lock hash');
  }
  assertExactKeys(evidence.inventory, new Set(['declared', 'discovered', 'executed']), 'inventory');
  for (const key of ['declared', 'discovered', 'executed']) {
    if (!Array.isArray(evidence.inventory[key])) throw new Error(`Invalid inventory.${key}`);
    for (const item of evidence.inventory[key]) assertSafeRelativeString(item, `inventory.${key}`);
  }
  if (!Array.isArray(evidence.effectiveArguments)) throw new Error('Invalid effectiveArguments');
  for (const execution of evidence.effectiveArguments) {
    assertExactKeys(execution, new Set(['path', 'arguments']), 'effectiveArguments entry');
    assertSafeRelativeString(execution.path, 'effectiveArguments.path');
    if (!Array.isArray(execution.arguments)) throw new Error('Invalid execution arguments');
    for (const argument of execution.arguments) assertSafeRelativeString(argument, 'argument');
  }
  if (!Array.isArray(evidence.perSuite)) throw new Error('Invalid perSuite');
  for (const suite of evidence.perSuite) {
    assertExactKeys(suite, PER_SUITE_KEYS, 'perSuite entry');
    assertSafeRelativeString(suite.path, 'perSuite.path');
    for (const key of COUNT_KEYS) {
      if (!Number.isInteger(suite[key]) || suite[key] < 0) {
        throw new Error(`Invalid perSuite.${key}`);
      }
    }
    for (const flag of ['completed', 'timedOut', 'interrupted']) {
      if (typeof suite[flag] !== 'boolean') throw new Error(`Invalid perSuite.${flag}`);
    }
    if (
      suite.terminationContext !== null &&
      !['timeout', 'reporter-output-limit', 'process-error', 'SIGINT', 'SIGTERM'].includes(
        suite.terminationContext
      )
    ) {
      throw new Error('Invalid perSuite.terminationContext');
    }
    if (!Number.isInteger(suite.exitCode)) throw new Error('Invalid perSuite.exitCode');
    for (const hash of ['eventStreamSha256', 'stderrSha256']) {
      if (!/^[0-9a-f]{64}$/.test(suite[hash])) throw new Error(`Invalid ${hash}`);
    }
    for (const bytes of ['stderrBytes', 'outputBytes']) {
      if (!Number.isSafeInteger(suite[bytes]) || suite[bytes] < 0)
        throw new Error(`Invalid ${bytes}`);
    }
  }
  validateCounts(evidence.counts, 'aggregate counts');
  if (!Number.isInteger(evidence.exitCode) || evidence.exitCode < 0)
    throw new Error('Invalid exitCode');
  if (!/^[0-9a-f]{64}$/.test(evidence.outputSha256)) throw new Error('Invalid outputSha256');
  if (!['passed', 'failed'].includes(evidence.result)) throw new Error('Invalid result');
  if (evidence.failureStage !== null && !FAILURE_STAGES.includes(evidence.failureStage)) {
    throw new Error('Invalid failureStage');
  }
  if (!/^[A-Z0-9_]+$/.test(evidence.failureCode)) throw new Error('Invalid failureCode');
  for (const key of ['suiteTimeoutMs', 'maxReporterBytes']) {
    if (!Number.isSafeInteger(evidence[key]) || evidence[key] <= 0)
      throw new Error(`Invalid ${key}`);
  }
  return evidence;
}
