import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';

import {
  GlobalsGateError,
  IPC_SCHEMA_VERSION,
  analyzeSource,
  applyExceptions,
  assertInventory,
  classifyCollisions,
  discoverJavaScript,
  loadGlobalsManifest,
  requestControlledInterruption,
  runGlobalsGate,
  validateIpcInterruptMessage,
  validateGlobalsEvidence,
  writeEvidenceAtomic
} from '../audit-globals.mjs';

const POLICY = {
  exactCollision: 'error',
  equivalentDuplicate: 'error',
  incompatiblePublicEntrypoint: 'critical',
  unicodeNormalizationCollision: 'error',
  casefoldPublic: 'error',
  casefoldPrivate: 'warning',
  dynamicGlobal: 'error',
  parseError: 'error',
  nodeRuntimePattern: 'error'
};

async function fixture(files, options = {}) {
  const root = await mkdir(path.join(os.tmpdir(), 'aerp-globals-'), { recursive: true }).then(
    async () => {
      const { mkdtemp } = await import('node:fs/promises');
      return mkdtemp(path.join(os.tmpdir(), 'aerp-globals-'));
    }
  );
  for (const [name, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), source);
  }
  const includedFiles = Object.keys(files)
    .filter(name => name.endsWith('.js'))
    .map(name => ({
      path: name,
      role: options.role || 'production',
      classification: 'productive',
      justification: 'Fixture runtime.'
    }));
  const manifest = {
    schemaVersion: '1.0.0',
    canonicalNodeVersion: process.version.slice(1),
    includedFiles,
    excludedFiles: [],
    publicEntrypoints: options.publicEntrypoints || [],
    policy: POLICY,
    exceptions: []
  };
  await mkdir(path.join(root, 'qa/manifests'), { recursive: true });
  await writeFile(
    path.join(root, 'qa/manifests/apps-script-globals.json'),
    JSON.stringify(manifest)
  );
  return { root, manifest, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function analyze(source, role = 'production', publicNames = []) {
  return analyzeSource(source, 'fixture.js', role, new Set(publicNames));
}

function processIsAbsent(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}

async function runControlledIpcChild(
  onReady,
  timeoutMs = 15_000,
  completionEvent = 'close',
  beforeReady = null
) {
  const script = path.resolve('scripts/qa/audit-globals.mjs');
  const child = fork(script, [], {
    cwd: path.resolve('.'),
    silent: true,
    windowsHide: true
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.on('message', message => {
      if (
        message?.type === 'AERP_QA_GLOBALS_READY' &&
        message?.schemaVersion === IPC_SCHEMA_VERSION
      )
        resolve(message);
    });
  });
  const completed = once(child, completionEvent);
  let timeoutHandle;
  const timeout = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('CONTROLLED_IPC_CHILD_TIMEOUT')), timeoutMs);
  });
  try {
    if (beforeReady) await beforeReady(child);
    await Promise.race([ready, timeout]);
    await onReady(child);
    const [code, signal] = await Promise.race([completed, timeout]);
    return {
      code,
      signal,
      pid: child.pid,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8')
    };
  } finally {
    clearTimeout(timeoutHandle);
    child.removeAllListeners();
    child.stdout?.removeAllListeners();
    child.stderr?.removeAllListeners();
    if (!processIsAbsent(child.pid)) child.kill('SIGKILL');
  }
}

test('declarations, destructuring and outer var are globals; locals and properties are not', () => {
  const result = analyze(
    'function top() { const local = 1; obj.key = local; } class C {} const {a, b: [c]} = x; { var d = 1; let e = 2; }'
  );
  assert.deepEqual(
    new Set(result.occurrences.map(item => item.symbol)),
    new Set(['top', 'C', 'a', 'c', 'd'])
  );
});

test('equivalent duplicate remains a high error', () => {
  const left = analyze('function same(a) { return a; }').occurrences[0];
  const right = { ...analyze('function same(a) { return a; }').occurrences[0], path: 'other.js' };
  assert.equal(classifyCollisions([left, right])[0].type, 'equivalent-duplicate');
});

test('incompatible public function is critical', () => {
  const left = analyzeSource('function api(a) {}', 'a.js', 'production', new Set(['api']))
    .occurrences[0];
  const right = analyzeSource('function api(a,b) {}', 'b.js', 'production', new Set(['api']))
    .occurrences[0];
  const collision = classifyCollisions([left, right])[0];
  assert.equal(collision.type, 'incompatible-public-entrypoint');
  assert.equal(collision.severity, 'critical');
});

test('const duplicate is detected', () => {
  const one = analyzeSource('const VALUE = 1;', 'a.js', 'production', new Set()).occurrences[0];
  const two = analyzeSource('const VALUE = 2;', 'b.js', 'production', new Set()).occurrences[0];
  assert.equal(classifyCollisions([one, two]).length, 1);
});

test('test/production collision is explicit and permutation-independent', () => {
  const production = analyzeSource('const x=1;', 'a.js', 'production', new Set()).occurrences[0];
  const embedded = analyzeSource('const x=1;', 'tests.js', 'ambiguous-embedded-tests', new Set())
    .occurrences[0];
  const forward = classifyCollisions([production, embedded]);
  const reverse = classifyCollisions([embedded, production]);
  assert.equal(forward[0].type, 'test-production-collision');
  assert.deepEqual(forward, reverse);
});

test('valid self-export is not another owner', () => {
  const result = analyze('function api() {} globalThis.api = api;');
  assert.equal(result.occurrences.length, 2);
  assert.equal(result.occurrences[1].ownerClass, 'selfExport');
  assert.equal(classifyCollisions(result.occurrences).length, 0);
});

test('incompatible global assignment collides', () => {
  const result = analyze('function api() {} globalThis.api = () => 1;');
  assert.equal(classifyCollisions(result.occurrences)[0].type, 'declaration-assignment-collision');
});

test('static computed assignment is detected and dynamic computed fails closed', () => {
  assert.equal(analyze('globalThis["fixed"] = 1;').occurrences[0].symbol, 'fixed');
  assert.equal(analyze('globalThis[name] = 1;').dynamic[0].code, 'COMPUTED_GLOBAL');
});

test('defineProperty, defineProperties and Reflect.set are detected', () => {
  const result = analyze(
    "Object.defineProperty(globalThis, 'a', {get(){return 1}}); Object.defineProperties(globalThis,{b:{value:2}}); Reflect.set(globalThis,'c',3);"
  );
  assert.deepEqual(
    result.occurrences.map(item => item.symbol),
    ['b', 'c']
  );
  assert.equal(result.dynamic[0].code, 'GLOBAL_DESCRIPTOR_UNVERIFIABLE');
});

test('builtin resolution covers indirect dynamic code and respects local shadowing', () => {
  for (const source of [
    "eval('x')",
    "(0, eval)('x')",
    "globalThis.eval('x')",
    "globalThis['eval']('x')",
    "eval?.('x')",
    "Function('x')",
    "new Function('x')",
    "globalThis.Function('x')"
  ])
    assert.equal(analyze(source).dynamic[0].code, 'DYNAMIC_CODE', source);
  assert.equal(analyze("function f(eval){ eval('local'); }").dynamic.length, 0);
  assert.equal(
    analyze("const Object={defineProperty(){}}; Object.defineProperty(globalThis,'x',{});")
      .occurrences.length,
    1
  );
  assert.equal(
    analyze("const Reflect={set(){}}; Reflect.set(globalThis,'x',1);").occurrences.length,
    1
  );
  assert.equal(analyze("function f(Function){ Function('local'); }").dynamic.length, 0);
  assert.equal(analyze('function f(globalThis){ globalThis.x=1; }').dynamic.length, 0);
  assert.equal(analyze("const e=eval; (0,e)('x');").dynamic[0].code, 'DYNAMIC_CODE');
});

test('globalThis aliases have a closed, fail-safe transition model', () => {
  const staticAlias = analyze("let g; g=globalThis; g.x=1; Reflect.set(g,'y',2);");
  assert.deepEqual(
    staticAlias.occurrences.map(item => item.symbol),
    ['g', 'x', 'y']
  );
  assert.equal(staticAlias.dynamic.length, 0);
  const declarationAlias = analyze('const g=globalThis; g.x=1;');
  assert.equal(declarationAlias.occurrences.at(-1).symbol, 'x');
  const chainedAlias = analyze('let g,h; g=h=globalThis; g.x=1; h.y=1;');
  assert.deepEqual(
    chainedAlias.occurrences.map(item => item.symbol),
    ['g', 'h', 'x', 'y']
  );
  const reassigned = analyze('let g=globalThis; g={}; g.x=1;');
  assert.ok(reassigned.dynamic.every(item => item.code === 'GLOBAL_ALIAS_UNVERIFIABLE'));
  assert.equal(
    reassigned.occurrences.some(item => item.symbol === 'x'),
    false
  );
  const local = analyze('function f(){ const g={}; g.x=1; }');
  assert.deepEqual(
    local.occurrences.map(item => item.symbol),
    ['f']
  );
  assert.ok(analyze('let g; g=(condition?globalThis:{}); g.x=1;').dynamic.length > 0);
});

test('selfExport requires the exact global binding', () => {
  const valid = analyze('function x(){} globalThis.x=x;');
  assert.equal(valid.occurrences.at(-1).ownerClass, 'selfExport');
  const shadowed = analyze('function x(){} { let x=other; globalThis.x=x; }');
  assert.equal(shadowed.occurrences.at(-1).ownerClass, 'assignment');
  assert.equal(
    classifyCollisions(shadowed.occurrences)[0].type,
    'declaration-assignment-collision'
  );
  assert.equal(analyze('function x(){} globalThis.x=()=>x;').occurrences.at(-1).selfExport, false);
  const owner = analyzeSource(
    'function cross(){}',
    'owner.js',
    'production',
    new Set()
  ).occurrences;
  const foreignExport = analyzeSource(
    'globalThis.cross=cross;',
    'foreign.js',
    'production',
    new Set()
  ).occurrences;
  assert.equal(
    classifyCollisions([...owner, ...foreignExport])[0].type,
    'declaration-assignment-collision'
  );
});

test('property descriptors accept only the documented static subset', () => {
  assert.equal(
    analyze("Object.defineProperty(globalThis,'x',{value:1,writable:true});").occurrences[0].symbol,
    'x'
  );
  for (const source of [
    "Object.defineProperty(globalThis,'x',descriptor);",
    "Object.defineProperty(globalThis,'x',{get(){return 1}});",
    "Object.defineProperty(globalThis,'x',{...descriptor});",
    "Object.defineProperty(globalThis,'x',{unknown:true});",
    'Object.defineProperties(globalThis,{x:descriptor});'
  ]) {
    const result = analyze(source);
    assert.equal(result.occurrences.length, 0, source);
    assert.equal(result.dynamic[0].code, 'GLOBAL_DESCRIPTOR_UNVERIFIABLE', source);
  }
});

test('dynamic code, modules and Node runtime patterns fail closed', () => {
  assert.ok(
    analyze(
      "eval('x'); Function('x'); new Function('x'); require('x'); module.exports = 1; exports.x = 1;"
    ).dynamic.length >= 6
  );
  assert.equal(analyze('export const x = 1;').dynamic[0].type, 'parse-error');
});

test('parse errors are reported without source disclosure', () => {
  const result = analyze('function { privatePayload }');
  assert.equal(result.dynamic[0].type, 'parse-error');
  assert.equal(JSON.stringify(result).includes('privatePayload'), false);
});

test('casefold confusable is warning privately and error publicly', () => {
  const privateItems = [...analyze('const Name=1; const name=2;').occurrences];
  assert.equal(
    classifyCollisions(privateItems).find(item => item.type === 'casefold-confusable').severity,
    'warning'
  );
  const publicItems = analyzeSource(
    'const Name=1; const name=2;',
    'x.js',
    'production',
    new Set(['Name'])
  ).occurrences;
  assert.equal(
    classifyCollisions(publicItems).find(item => item.type === 'casefold-confusable').severity,
    'high'
  );
});

test('Unicode NFC/NFD owners collide and local globalThis shadowing is excluded', () => {
  const composed = analyzeSource('const café=1;', 'a.js', 'production', new Set()).occurrences[0];
  const decomposed = analyzeSource('const café=1;', 'b.js', 'production', new Set()).occurrences[0];
  assert.equal(
    classifyCollisions([composed, decomposed])[0].type,
    'unicode-normalization-collision'
  );
  const shadowed = analyze('function f(){ const globalThis={}; globalThis.x=1; }');
  assert.equal(
    shadowed.occurrences.some(item => item.symbol === 'x'),
    false
  );
});

test('exact exceptions apply; obsolete and excessive exceptions remain unused', () => {
  const left = analyzeSource('const x=1;', 'a.js', 'production', new Set()).occurrences[0];
  const right = analyzeSource('const x=2;', 'b.js', 'production', new Set()).occurrences[0];
  const collision = classifyCollisions([left, right]);
  const exact = {
    symbol: 'x',
    type: collision[0].type,
    paths: ['a.js', 'b.js'],
    justification: 'Controlled fixture.'
  };
  assert.equal(applyExceptions(collision, [exact]).used.length, 1);
  assert.equal(applyExceptions(collision, [{ ...exact, symbol: 'old' }]).obsolete.length, 1);
  assert.equal(
    applyExceptions(collision, [{ ...exact, paths: ['a.js', 'b.js', 'c.js'] }]).used.length,
    0
  );
});

test('manifest is closed and exceptions must remain empty', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const loaded = await loadGlobalsManifest(item.root);
  assert.equal(loaded.includedFiles.length, 1);
  for (const mutation of [
    m => {
      m.extra = true;
    },
    m => {
      m.exceptions = [{ symbol: 'a' }];
    },
    m => {
      m.policy.extra = 'error';
    },
    m => {
      m.includedFiles[0].extra = true;
    }
  ]) {
    const raw = JSON.parse(
      await readFile(path.join(item.root, 'qa/manifests/apps-script-globals.json'))
    );
    mutation(raw);
    await writeFile(
      path.join(item.root, 'qa/manifests/apps-script-globals.json'),
      JSON.stringify(raw)
    );
    await assert.rejects(loadGlobalsManifest(item.root), GlobalsGateError);
    await writeFile(
      path.join(item.root, 'qa/manifests/apps-script-globals.json'),
      JSON.stringify(item.manifest)
    );
  }
});

test('inventory is exact, recursive and order independent', async t => {
  const item = await fixture({ 'z.js': 'const z=1;', 'sub/a.js': 'const a=1;' });
  t.after(item.cleanup);
  const manifest = await loadGlobalsManifest(item.root);
  const discovered = await discoverJavaScript(item.root);
  assert.deepEqual(assertInventory(manifest, discovered).discovered, ['sub/a.js', 'z.js']);
  await writeFile(path.join(item.root, 'unexpected.js'), 'const x=1;');
  assert.throws(
    () => assertInventory(manifest, [...discovered, 'unexpected.js']),
    GlobalsGateError
  );
});

test('included/excluded overlap and paths outside repository are rejected', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const overlap = { ...item.manifest, excludedFiles: [{ path: 'a.js', reason: 'No.' }] };
  await writeFile(
    path.join(item.root, 'qa/manifests/apps-script-globals.json'),
    JSON.stringify(overlap)
  );
  await assert.rejects(loadGlobalsManifest(item.root), GlobalsGateError);
  overlap.excludedFiles = [];
  overlap.includedFiles[0].path = '../a.js';
  await writeFile(
    path.join(item.root, 'qa/manifests/apps-script-globals.json'),
    JSON.stringify(overlap)
  );
  await assert.rejects(loadGlobalsManifest(item.root), GlobalsGateError);
});

test('a Node test cannot be included as Apps Script runtime', async t => {
  const item = await fixture({ 'accidental.test.js': 'const nodeOnly=1;' });
  t.after(item.cleanup);
  await assert.rejects(
    loadGlobalsManifest(item.root),
    error => error.code === 'NODE_FILE_INCLUDED_AS_RUNTIME'
  );
});

test('symlink or junction is rejected when supported', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const link = path.join(item.root, 'linked.js');
  try {
    await symlink(path.join(item.root, 'a.js'), link, 'file');
  } catch {
    const target = path.join(item.root, 'junction-target');
    await mkdir(target);
    try {
      await symlink(target, path.join(item.root, 'junction-link'), 'junction');
    } catch {
      t.skip('Symlink and junction creation are not available');
      return;
    }
  }
  await assert.rejects(discoverJavaScript(item.root), GlobalsGateError);
});

test('evidence is closed, sanitized, current and atomically persisted', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const evidence = await runGlobalsGate({ root: item.root, persist: true });
  await validateGlobalsEvidence(evidence, { root: item.root, verifyArtifacts: true });
  assert.equal(evidence.inventory.fileHashes.length, 1);
  assert.match(evidence.inventory.fileHashes[0].sha256, /^[0-9a-f]{64}$/);
  const stored = JSON.parse(
    await readFile(path.join(item.root, '.qa-output/globals-evidence.json'))
  );
  assert.equal(stored.runId, evidence.runId);
  assert.equal(JSON.stringify(stored).includes(item.root), false);
  const previousRunId = stored.runId;
  const replacement = await runGlobalsGate({ root: item.root, persist: true });
  assert.notEqual(replacement.runId, previousRunId);
  assert.equal(
    JSON.parse(await readFile(path.join(item.root, '.qa-output/globals-evidence.json'))).runId,
    replacement.runId
  );
});

test('evidence integrity rejects tampering and nondeterministic order', async t => {
  const item = await fixture({ 'a.js': 'const duplicated=1;', 'b.js': 'const duplicated=2;' });
  t.after(item.cleanup);
  const evidence = await runGlobalsGate({ root: item.root, persist: false });
  const mutations = [
    value => {
      value.aggregateSha256 = '0'.repeat(64);
    },
    value => {
      value.counts.uniqueSymbols = -99;
    },
    value => {
      value.inventory.fileHashes[0].sha256 = 'not-a-hash';
    },
    value => {
      value.counts.occurrences += 1;
    },
    value => {
      value.inventory.included[0] = 'C:/personal/file.js';
    },
    value => {
      value.collisions = [];
    },
    value => {
      value.inventory.discovered.reverse();
    },
    value => {
      value.extra = true;
    },
    value => {
      delete value.result;
    }
  ];
  for (const mutate of mutations) {
    const changed = JSON.parse(JSON.stringify(evidence));
    mutate(changed);
    await assert.rejects(validateGlobalsEvidence(changed, { root: item.root }));
  }
});

test('aggregate hashing is deterministic apart from run identity and timestamps', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const first = await runGlobalsGate({ root: item.root, persist: false });
  const second = await runGlobalsGate({ root: item.root, persist: false });
  assert.notEqual(first.runId, second.runId);
  assert.equal(first.aggregateSha256, second.aggregateSha256);
});

test('SIGINT and SIGTERM produce their contractual exit codes', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  assert.equal(
    (await runGlobalsGate({ root: item.root, persist: false, control: { signal: 'SIGINT' } }))
      .exitCode,
    130
  );
  assert.equal(
    (await runGlobalsGate({ root: item.root, persist: false, control: { signal: 'SIGTERM' } }))
      .exitCode,
    143
  );
});

test('Windows controlled IPC interruption returns numeric contractual exits', async () => {
  const evidencePath = path.resolve('.qa-output/globals-evidence.json');
  for (const [signal, expected] of [
    ['SIGINT', 130],
    ['SIGTERM', 143]
  ]) {
    const result = await runControlledIpcChild(child => {
      child.send({
        type: 'AERP_QA_GLOBALS_INTERRUPT',
        schemaVersion: IPC_SCHEMA_VERSION,
        signal
      });
    });
    assert.equal(result.code, expected);
    assert.equal(result.signal, null);
    assert.equal(processIsAbsent(result.pid), true);
    const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
    assert.equal(evidence.exitCode, expected);
    assert.equal(evidence.failureCode, `INTERRUPTED_${signal}`);
    assert.equal(evidence.result, 'failed');
    assert.match(evidence.runId, /^[0-9a-f-]{36}$/);
    assert.ok(Date.parse(evidence.startedAt) <= Date.parse(evidence.finishedAt));
    assert.ok(evidence.counts.occurrences < 781);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /evidence=.qa-output\/globals-evidence\.json/);
    assert.equal(
      (await readdir(path.resolve('.qa-output'))).some(
        name => name.endsWith('.tmp') || name.endsWith('.recovery.json')
      ),
      false
    );
  }
});

test('IPC interruption messages and state transitions are closed and fail-safe', () => {
  const valid = {
    type: 'AERP_QA_GLOBALS_INTERRUPT',
    schemaVersion: IPC_SCHEMA_VERSION,
    signal: 'SIGINT'
  };
  assert.throws(() => validateIpcInterruptMessage(valid, false), /IPC_MESSAGE_BEFORE_READY/);
  for (const invalid of [
    null,
    'SIGINT',
    { ...valid, type: 'UNKNOWN' },
    { ...valid, schemaVersion: '2.0.0' },
    { ...valid, signal: 'SIGUSR1' },
    { ...valid, extra: true }
  ])
    assert.throws(() => validateIpcInterruptMessage(invalid, true));
  const accessor = { ...valid };
  Object.defineProperty(accessor, 'signal', { enumerable: true, get: () => 'SIGINT' });
  assert.throws(() => validateIpcInterruptMessage(accessor, true), /IPC_MESSAGE_INVALID_KEYS/);
  assert.deepEqual(validateIpcInterruptMessage(valid, true), { signal: 'SIGINT' });

  const control = { signal: null, finished: false };
  assert.equal(requestControlledInterruption(control, 'SIGINT', 'ipc').accepted, true);
  assert.deepEqual(requestControlledInterruption(control, 'SIGTERM', 'ipc'), {
    accepted: false,
    code: 'INTERRUPTION_ALREADY_REQUESTED',
    signal: 'SIGINT'
  });
  control.finished = true;
  assert.equal(
    requestControlledInterruption(control, 'SIGTERM', 'ipc').code,
    'INTERRUPTION_AFTER_FINISH'
  );
});

test('invalid IPC and parent disconnect terminate bounded and fail closed', async () => {
  const invalid = await runControlledIpcChild(child => child.send({ type: 'UNKNOWN' }));
  assert.equal(invalid.code, 2);
  assert.equal(invalid.signal, null);
  assert.equal(processIsAbsent(invalid.pid), true);
  let evidence = JSON.parse(await readFile(path.resolve('.qa-output/globals-evidence.json')));
  assert.equal(evidence.failureCode, 'IPC_MESSAGE_INVALID_KEYS');
  assert.equal(evidence.result, 'failed');

  const disconnected = await runControlledIpcChild(child => child.disconnect(), 15_000, 'exit');
  assert.equal(disconnected.code, 2);
  assert.equal(disconnected.signal, null);
  assert.equal(processIsAbsent(disconnected.pid), true);
  evidence = JSON.parse(await readFile(path.resolve('.qa-output/globals-evidence.json')));
  assert.equal(evidence.failureCode, 'IPC_PARENT_DISCONNECTED');
  assert.equal(evidence.result, 'failed');
});

test('IPC message before READY is rejected by the real child', async () => {
  const request = {
    type: 'AERP_QA_GLOBALS_INTERRUPT',
    schemaVersion: IPC_SCHEMA_VERSION,
    signal: 'SIGINT'
  };
  const result = await runControlledIpcChild(
    () => {},
    15_000,
    'close',
    child => child.send(request)
  );
  assert.equal(result.code, 2);
  assert.equal(result.signal, null);
  const evidence = JSON.parse(await readFile(path.resolve('.qa-output/globals-evidence.json')));
  assert.equal(evidence.failureCode, 'IPC_MESSAGE_BEFORE_READY');
  assert.equal(evidence.result, 'failed');
});

test('interruption preserves its exit when persistence is unavailable', async t => {
  const evidencePath = path.resolve('.qa-output/globals-evidence.json');
  await rm(evidencePath, { recursive: true, force: true });
  await mkdir(evidencePath, { recursive: true });
  t.after(() => rm(evidencePath, { recursive: true, force: true }));
  const result = await runControlledIpcChild(child => {
    child.send({
      type: 'AERP_QA_GLOBALS_INTERRUPT',
      schemaVersion: IPC_SCHEMA_VERSION,
      signal: 'SIGTERM'
    });
  });
  assert.equal(result.code, 143);
  assert.equal(result.signal, null);
  assert.match(
    result.stderr,
    /^AERP-QA-001 INTERRUPTION_EVIDENCE_NOT_PERSISTED SIGTERM [A-Z0-9_]+\n$/
  );
  assert.match(result.stdout, /evidence=NONE/);
  assert.equal(processIsAbsent(result.pid), true);
});

test('concurrent IPC interruption keeps the first request and exits fail closed', async () => {
  const result = await runControlledIpcChild(child => {
    child.send({
      type: 'AERP_QA_GLOBALS_INTERRUPT',
      schemaVersion: IPC_SCHEMA_VERSION,
      signal: 'SIGINT'
    });
    child.send({
      type: 'AERP_QA_GLOBALS_INTERRUPT',
      schemaVersion: IPC_SCHEMA_VERSION,
      signal: 'SIGTERM'
    });
  });
  assert.equal(result.code, 130);
  assert.equal(result.signal, null);
  const evidence = JSON.parse(await readFile(path.resolve('.qa-output/globals-evidence.json')));
  assert.equal(evidence.failureCode, 'INTERRUPTED_SIGINT');
});

test(
  'POSIX operating-system signal handlers return numeric exits without IPC',
  { skip: process.platform === 'win32' },
  async () => {
    const script = path.resolve('scripts/qa/audit-globals.mjs');
    for (const [signal, expected] of [
      ['SIGINT', 130],
      ['SIGTERM', 143]
    ]) {
      const child = spawn(process.execPath, [script], {
        cwd: path.resolve('.'),
        stdio: ['ignore', 'pipe', 'pipe']
      });
      await delay(100);
      assert.equal(child.kill(signal), true);
      const [code, closedSignal] = await once(child, 'close');
      assert.equal(code, expected);
      assert.equal(closedSignal, null);
    }
  }
);

test('controlled analyzer adapter produces a real internal-failure result', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const evidence = await runGlobalsGate({
    root: item.root,
    persist: false,
    dependencies: {
      analyze() {
        throw new Error('controlled internal fixture');
      }
    }
  });
  assert.equal(evidence.exitCode, 2);
  assert.equal(evidence.failureCode, 'INTERNAL_FAILURE');
});

test('write and rename failures attempt bounded recovery', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const evidence = await runGlobalsGate({ root: item.root, persist: true });
  const base = { mkdir, rm, writeFile, rename };
  const target = path.join(item.root, '.qa-output/globals-evidence.json');
  await rm(target, { force: true });
  await assert.rejects(
    writeEvidenceAtomic(item.root, '.qa-output/globals-evidence.json', evidence, {
      ...base,
      writeFile: async (filePath, ...args) => {
        if (String(filePath).endsWith('.tmp'))
          throw Object.assign(new Error('controlled'), { code: 'EIO' });
        return writeFile(filePath, ...args);
      }
    }),
    error => error.code === 'EVIDENCE_TEMP_WRITE_FAILED' && Boolean(error.recoveryPath)
  );
  let residuals = (await readdir(path.join(item.root, '.qa-output'))).filter(name =>
    name.endsWith('.tmp')
  );
  assert.deepEqual(residuals, []);
  for (const name of await readdir(path.join(item.root, '.qa-output')))
    await rm(path.join(item.root, '.qa-output', name), { force: true });
  await assert.rejects(
    writeEvidenceAtomic(item.root, '.qa-output/globals-evidence.json', evidence, {
      ...base,
      rename: async () => {
        throw Object.assign(new Error('controlled'), { code: 'EACCES' });
      }
    }),
    error => error.code === 'EVIDENCE_RENAME_FAILED' && Boolean(error.recoveryPath)
  );
  const recovery = path.join(
    item.root,
    `.qa-output/globals-evidence.json.${evidence.runId}.recovery.json`
  );
  const recovered = JSON.parse(await readFile(recovery));
  assert.equal(recovered.runId, evidence.runId);
  assert.equal(recovered.exitCode, 3);
  assert.equal(recovered.failureCode, 'EVIDENCE_RENAME_FAILED');
  assert.equal(recovered.persistence.status, 'recovery');
  residuals = (await readdir(path.join(item.root, '.qa-output'))).filter(name =>
    name.endsWith('.tmp')
  );
  assert.deepEqual(residuals, []);
  for (const name of await readdir(path.join(item.root, '.qa-output')))
    await rm(path.join(item.root, '.qa-output', name), { force: true });
  assert.deepEqual(await readdir(path.join(item.root, '.qa-output')), []);
});

test('directory, recovery, cleanup and total persistence failures are classified', async t => {
  const item = await fixture({ 'a.js': 'const a=1;' });
  t.after(item.cleanup);
  const evidence = await runGlobalsGate({ root: item.root, persist: true });
  const base = { mkdir, rm, writeFile, rename };
  await assert.rejects(
    writeEvidenceAtomic(item.root, '.qa-output/dir.json', evidence, {
      ...base,
      mkdir: async () => {
        throw Object.assign(new Error('controlled'), { code: 'EACCES' });
      }
    }),
    error => error.code === 'EVIDENCE_DIRECTORY_FAILED'
  );
  await assert.rejects(
    writeEvidenceAtomic(item.root, '.qa-output/recovery.json', evidence, {
      ...base,
      writeFile: async () => {
        throw Object.assign(new Error('controlled'), { code: 'EIO' });
      }
    }),
    error =>
      error.code === 'EVIDENCE_RECOVERY_FAILED' &&
      error.primaryCode === 'EVIDENCE_TEMP_WRITE_FAILED'
  );
  const collisionRecovery = path.join(
    item.root,
    `.qa-output/collision.json.${evidence.runId}.recovery.json`
  );
  await writeFile(collisionRecovery, 'controlled collision');
  await assert.rejects(
    writeEvidenceAtomic(item.root, '.qa-output/collision.json', evidence, {
      ...base,
      rename: async () => {
        throw Object.assign(new Error('controlled'), { code: 'EACCES' });
      }
    }),
    error =>
      error.code === 'EVIDENCE_RECOVERY_FAILED' &&
      error.primaryCode === 'EVIDENCE_RENAME_FAILED' &&
      error.secondaryCode === 'EEXIST'
  );
  assert.equal(
    (await readdir(path.join(item.root, '.qa-output'))).some(name => name.endsWith('.tmp')),
    false
  );
  await rm(collisionRecovery, { force: true });
  await assert.rejects(
    writeEvidenceAtomic(item.root, '.qa-output/cleanup.json', evidence, {
      ...base,
      rename: async () => {
        throw Object.assign(new Error('controlled'), { code: 'EACCES' });
      },
      rm: async filePath => {
        if (String(filePath).endsWith('.tmp'))
          throw Object.assign(new Error('controlled'), { code: 'EPERM' });
        return rm(filePath, { force: true });
      }
    }),
    error =>
      error.code === 'EVIDENCE_CLEANUP_FAILED' && error.primaryCode === 'EVIDENCE_RENAME_FAILED'
  );
  const cleanupResidual = (await readdir(path.join(item.root, '.qa-output'))).find(name =>
    name.endsWith('.tmp')
  );
  assert.ok(cleanupResidual, 'controlled cleanup failure must be observed before fixture cleanup');
  await rm(path.join(item.root, '.qa-output', cleanupResidual), { force: true });
  assert.equal(
    (await readdir(path.join(item.root, '.qa-output'))).some(name => name.endsWith('.tmp')),
    false
  );
  const noPersistence = await runGlobalsGate({
    root: item.root,
    persist: true,
    evidencePath: 'a.js/impossible.json'
  });
  assert.equal(noPersistence.exitCode, 3);
  assert.equal(noPersistence.persistence.status, 'none');
  assert.equal(noPersistence.persistence.path, null);
  for (const name of await readdir(path.join(item.root, '.qa-output')))
    await rm(path.join(item.root, '.qa-output', name), { force: true });
  assert.deepEqual(await readdir(path.join(item.root, '.qa-output')), []);
});

test('real repository has no global collisions or dynamic-code blockers', async () => {
  const root = path.resolve(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1')),
    '../../..'
  );
  const evidence = await runGlobalsGate({ root, persist: false });
  assert.equal(evidence.exitCode, 0);
  assert.equal(evidence.counts.includedFiles, 38);
  assert.equal(evidence.counts.excludedFiles, 7);
  assert.equal(evidence.counts.uniqueSymbols, 760);
  assert.equal(evidence.counts.occurrences, 780);
  assert.equal(evidence.counts.duplicateSymbols, 0);
  assert.equal(evidence.counts.dynamicConstructions, 0);
  assert.deepEqual(evidence.collisions, []);
  assert.deepEqual(evidence.dynamicConstructions, []);
});
