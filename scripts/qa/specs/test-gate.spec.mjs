import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn as spawnProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { clearTimeout as cancelTimeout, setTimeout as scheduleTimeout } from 'node:timers';

import nodeTestEvidenceReporter, {
  REPORTER_SCHEMA_VERSION,
  SUITE_RESULT_MARKER
} from '../node-test-evidence-reporter.mjs';
import {
  DEFAULT_MAX_REPORTER_BYTES,
  DEFAULT_SUITE_TIMEOUT_MS,
  GateError,
  aggregateSuiteResults,
  buildEvidence,
  collectRepositoryMetadata,
  executeSuiteSequence,
  formatEvidenceFailureDiagnostics,
  executeSuite,
  hashAggregateOutput,
  parseCliArguments,
  parseReporterResult,
  requestInterruption,
  terminateProcessTree,
  toPerSuite,
  writeEvidenceAtomic
} from '../run-tests.mjs';
import {
  assertCanonicalNodeVersion,
  assertExactTestInventory,
  discoverTestSuites,
  loadTestManifest,
  validateEvidence
} from '../test-inventory.mjs';

const SHA_40 = 'a'.repeat(40);
const SHA_64 = 'b'.repeat(64);
const ZERO_HASH = '0'.repeat(64);
const REAL_MANIFEST = await loadTestManifest(process.cwd(), 'qa/manifests/test-suites.json');
const SUITES = REAL_MANIFEST.suites.map(suitePath => [
  suitePath,
  REAL_MANIFEST.reconciledBaseline.perSuite[suitePath]
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseline() {
  return cloneJson(REAL_MANIFEST.reconciledBaseline);
}

function suiteResult(suitePath, total, overrides = {}) {
  return {
    path: suitePath,
    pass: total,
    fail: 0,
    skipped: 0,
    todo: 0,
    cancelled: 0,
    total,
    completed: true,
    exitCode: 0,
    timedOut: false,
    interrupted: false,
    terminationContext: null,
    eventStreamSha256: SHA_64,
    stderrSha256: SHA_64,
    stderrBytes: 0,
    outputBytes: 100,
    ...overrides
  };
}

function evidenceState(overrides = {}) {
  return {
    runId: '00000000-0000-4000-8000-000000000000',
    startedAt: '2026-08-24T12:00:00.000Z',
    metadata: {
      commit: SHA_40,
      workingTree: 'clean',
      commitDateUtc: '2026-08-24T11:00:00.000Z',
      npmVersion: '11.16.0',
      packageLockSha256: SHA_64
    },
    inventory: {
      declared: ['suite-a.test.js'],
      discovered: ['suite-a.test.js'],
      executed: ['suite-a.test.js']
    },
    effectiveArguments: [{ path: 'suite-a.test.js', arguments: ['--test', 'suite-a.test.js'] }],
    perSuite: [suiteResult('suite-a.test.js', 1)],
    counts: { pass: 1, fail: 0, skipped: 0, todo: 0, cancelled: 0, total: 1 },
    exitCode: 0,
    failureStage: null,
    failureCode: 'NONE',
    options: {
      suiteTimeoutMs: DEFAULT_SUITE_TIMEOUT_MS,
      maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES
    },
    ...overrides
  };
}

function validReporterLine(
  counts = { pass: 1, fail: 0, skipped: 0, todo: 0, cancelled: 0, total: 1 }
) {
  return `${SUITE_RESULT_MARKER}${JSON.stringify({
    schemaVersion: REPORTER_SCHEMA_VERSION,
    summaryCount: 1,
    counts,
    completed: true,
    eventStreamSha256: SHA_64,
    outputBytes: 100,
    outputLimitExceeded: false
  })}\n`;
}

function manifestFixture(overrides = {}) {
  const manifest = cloneJson(REAL_MANIFEST);
  return { ...manifest, ...overrides };
}

function executionResult(suitePath, overrides = {}) {
  return {
    path: suitePath,
    arguments: ['--test', suitePath],
    exitCode: 0,
    signalCode: null,
    timedOut: false,
    interrupted: false,
    terminationReason: null,
    terminationSignal: null,
    terminationFailed: false,
    processError: false,
    reporterCode: null,
    reporterResult: {
      counts: { pass: 1, fail: 0, skipped: 0, todo: 0, cancelled: 0, total: 1 },
      completed: true,
      eventStreamSha256: SHA_64,
      outputBytes: 100
    },
    stderrSha256: SHA_64,
    stderrBytes: 0,
    ...overrides
  };
}

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.killed = false;
    this.exitCode = null;
    this.signalCode = null;
  }

  kill() {
    if (this.killed) return false;
    this.killed = true;
    process.nextTick(() => this.emit('close', 1));
    return true;
  }
}

function completedSpawner({ stdout = validReporterLine(), stderr = '', exitCode = 0 } = {}) {
  return () => {
    const child = new FakeChild();
    process.nextTick(() => {
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit('close', exitCode);
    });
    return child;
  };
}

async function reporterOutput(events) {
  async function* source() {
    for (const event of events) yield event;
  }
  let output = '';
  for await (const chunk of nodeTestEvidenceReporter(source())) output += chunk;
  return JSON.parse(output.slice(SUITE_RESULT_MARKER.length));
}

async function withTemporaryRepository(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aerp-qa-gate-'));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function captureRejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('Expected promise to reject');
}

test('accepts equal declared, discovered, and executed sets', () => {
  const inventory = assertExactTestInventory(process.cwd(), {
    declared: ['a.test.js', 'b.test.js'],
    discovered: ['b.test.js', 'a.test.js'],
    executed: ['a.test.js', 'b.test.js']
  });
  assert.deepEqual(inventory.declared, ['a.test.js', 'b.test.js']);
});

for (const [name, input, pattern] of [
  [
    'missing suite',
    {
      declared: ['a.test.js', 'b.test.js'],
      discovered: ['a.test.js'],
      executed: ['a.test.js', 'b.test.js']
    },
    /mismatch/
  ],
  [
    'additional suite',
    {
      declared: ['a.test.js'],
      discovered: ['a.test.js', 'extra.test.js'],
      executed: ['a.test.js']
    },
    /mismatch/
  ],
  [
    'duplicate suite',
    { declared: ['a.test.js', 'a.test.js'], discovered: ['a.test.js'], executed: ['a.test.js'] },
    /duplicate/
  ],
  [
    'omitted execution',
    {
      declared: ['a.test.js', 'b.test.js'],
      discovered: ['a.test.js', 'b.test.js'],
      executed: ['a.test.js']
    },
    /mismatch/
  ],
  [
    'case-folded collision',
    { declared: ['A.test.js', 'a.test.js'], discovered: ['a.test.js'], executed: ['a.test.js'] },
    /case-folded/
  ],
  [
    'repository escape',
    { declared: ['../outside.test.js'], discovered: [], executed: [] },
    /outside the repository/
  ]
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => assertExactTestInventory(process.cwd(), input), pattern);
  });
}

test('discovers additional suites in nested temporary directories', async () => {
  await withTemporaryRepository(async root => {
    await mkdir(path.join(root, 'nested'));
    await mkdir(path.join(root, '.qa-output'));
    await writeFile(path.join(root, 'root.test.js'), '');
    await writeFile(path.join(root, 'nested', 'child.test.js'), '');
    await writeFile(path.join(root, '.qa-output', 'ignored.test.js'), '');
    assert.deepEqual(await discoverTestSuites(root), ['nested/child.test.js', 'root.test.js']);
  });
});

test('rejects file symlinks and directory symlinks or junctions when supported', async t => {
  await withTemporaryRepository(async root => {
    const target = path.join(root, 'target.test.js');
    await writeFile(target, '');
    try {
      await symlink(target, path.join(root, 'link.test.js'), 'file');
      await assert.rejects(discoverTestSuites(root), /symbolic link|reparse point/);
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
      t.diagnostic('File symlink creation is not permitted on this platform');
    }
  });
  await withTemporaryRepository(async root => {
    const target = path.join(root, 'target');
    await mkdir(target);
    try {
      await symlink(target, path.join(root, 'linked-directory'), 'junction');
      await assert.rejects(discoverTestSuites(root), /symbolic link|junction|reparse point/);
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
      t.diagnostic('Directory symlink/junction creation is not permitted on this platform');
    }
  });
});

test('rejects malformed JSON and manifest key mismatches', async () => {
  await withTemporaryRepository(async root => {
    await writeFile(path.join(root, 'manifest.json'), '{invalid');
    await assert.rejects(loadTestManifest(root, 'manifest.json'), SyntaxError);
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ schemaVersion: '1.0.0' }));
    await assert.rejects(loadTestManifest(root, 'manifest.json'), /keys mismatch/);
    await writeFile(
      path.join(root, 'manifest.json'),
      JSON.stringify({
        schemaVersion: '1.0.0',
        canonicalNodeVersion: '24.18.0',
        informativeBaseline: { total: 1, enforced: false },
        reconciledBaseline: { total: 1, contractualThreshold: false, perSuite: {} },
        suites: [],
        additional: true
      })
    );
    await assert.rejects(loadTestManifest(root, 'manifest.json'), /keys mismatch/);
  });
});

test('enforces a closed manifest schema at every nested level', async () => {
  await withTemporaryRepository(async root => {
    const manifestPath = path.join(root, 'manifest.json');
    const checkRejected = async (manifest, pattern = /keys mismatch|must|required|mismatch/) => {
      await writeFile(manifestPath, JSON.stringify(manifest));
      await assert.rejects(loadTestManifest(root, 'manifest.json'), pattern);
    };

    const additionalInformative = manifestFixture();
    additionalInformative.informativeBaseline.extra = true;
    await checkRejected(additionalInformative, /informativeBaseline keys mismatch/);

    const missingInformative = manifestFixture();
    delete missingInformative.informativeBaseline.commit;
    await checkRejected(missingInformative, /informativeBaseline keys mismatch/);

    const invalidInformativeTypes = manifestFixture();
    invalidInformativeTypes.informativeBaseline.total = '299';
    await checkRejected(invalidInformativeTypes, /non-negative/);

    const invalidCommit = manifestFixture();
    invalidCommit.informativeBaseline.commit = 'ef8b0ec';
    await checkRejected(invalidCommit, /full lowercase Git hash/);

    const invalidDate = manifestFixture();
    invalidDate.informativeBaseline.date = '2026-02-31';
    await checkRejected(invalidDate, /valid ISO calendar date/);

    const additionalReconciled = manifestFixture();
    additionalReconciled.reconciledBaseline.extra = true;
    await checkRejected(additionalReconciled, /reconciledBaseline keys mismatch/);

    const missingReconciled = manifestFixture();
    delete missingReconciled.reconciledBaseline.total;
    await checkRejected(missingReconciled, /reconciledBaseline keys mismatch/);

    const invalidReconciledTypes = manifestFixture();
    invalidReconciledTypes.reconciledBaseline.contractualThreshold = 0;
    await checkRejected(invalidReconciledTypes, /non-contractual/);

    const additionalSuite = manifestFixture();
    additionalSuite.reconciledBaseline.perSuite['additional.test.js'] = 0;
    await checkRejected(additionalSuite, /mismatch/);

    const missingSuite = manifestFixture();
    delete missingSuite.reconciledBaseline.perSuite[missingSuite.suites[0]];
    await checkRejected(missingSuite, /mismatch/);

    const invalidSuiteCount = manifestFixture();
    invalidSuiteCount.reconciledBaseline.perSuite[invalidSuiteCount.suites[0]] = -1;
    await checkRejected(invalidSuiteCount, /non-negative integer/);

    const wrongSuiteIdentity = manifestFixture();
    wrongSuiteIdentity.suites[0] = 'wrong.test.js';
    await checkRejected(wrongSuiteIdentity, /mismatch/);
  });
});

test('validates CLI defaults, bounds, and canonical Node', () => {
  assert.deepEqual(parseCliArguments([]), {
    suiteTimeoutMs: DEFAULT_SUITE_TIMEOUT_MS,
    maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES
  });
  assert.throws(() => parseCliArguments(['--suite-timeout-ms=0']), GateError);
  assert.throws(() => parseCliArguments(['--unknown=1']), GateError);
  assert.doesNotThrow(() => assertCanonicalNodeVersion('v24.18.0', '24.18.0'));
  assert.throws(() => assertCanonicalNodeVersion('v23.0.0', '24.18.0'), /mismatch/);
});

test('reports metadata failures deterministically', async () => {
  await assert.rejects(
    collectRepositoryMetadata({
      readFile: async () => Buffer.from('lock'),
      commandOutput: () => {
        throw new Error('failure');
      }
    }),
    error => error instanceof GateError && error.stage === 'metadata'
  );
});

test('handles SIGINT and SIGTERM through the isolated interruption controller', () => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const reasons = [];
    const control = {
      activeChild: {},
      terminateActive: reason => reasons.push(reason),
      interrupted: false
    };
    requestInterruption(control, signal);
    assert.equal(control.interrupted, true);
    assert.equal(control.signal, signal);
    assert.deepEqual(reasons, ['interruption']);
  }
});

test('times out and terminates the active child without fragile delays', async () => {
  let timeoutCallback;
  const child = new FakeChild();
  const promise = executeSuite(
    'suite.test.js',
    { suiteTimeoutMs: 10, maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES },
    { activeChild: null, interrupted: false },
    {
      spawn: () => child,
      setTimeout: callback => {
        timeoutCallback = callback;
        return 1;
      },
      clearTimeout: () => {},
      terminateTree: async () => {
        process.nextTick(() => child.emit('close', null, 'SIGTERM'));
        return { requested: true, confirmed: true };
      }
    }
  );
  timeoutCallback();
  const result = await promise;
  assert.equal(result.timedOut, true);
  assert.equal(result.directChildClosed, true);
  assert.equal(result.treeTerminationConfirmed, true);
});

test('stops immediately after a failed suite and records it first', async () => {
  const failures = [
    [{ exitCode: 1 }, 'SUITE_EXIT_NONZERO'],
    [
      {
        reporterResult: {
          ...executionResult('first.test.js').reporterResult,
          counts: { pass: 0, fail: 1, skipped: 0, todo: 0, cancelled: 0, total: 1 }
        },
        exitCode: 1
      },
      'SUITE_TEST_FAILURE'
    ],
    [
      {
        reporterResult: {
          ...executionResult('first.test.js').reporterResult,
          counts: { pass: 0, fail: 0, skipped: 0, todo: 0, cancelled: 1, total: 1 }
        },
        exitCode: 1
      },
      'SUITE_TEST_CANCELLED'
    ],
    [
      {
        reporterResult: {
          ...executionResult('first.test.js').reporterResult,
          completed: false
        }
      },
      'SUITE_INCOMPLETE'
    ],
    [
      { timedOut: true, terminationFailed: true, terminationReason: 'timeout' },
      'PROCESS_TERMINATION_FAILED'
    ],
    [
      { interrupted: true, terminationFailed: true, terminationSignal: 'SIGINT' },
      'PROCESS_TERMINATION_FAILED'
    ],
    [
      { interrupted: true, terminationFailed: true, terminationSignal: 'SIGTERM' },
      'PROCESS_TERMINATION_FAILED'
    ],
    [
      {
        terminationFailed: true,
        reporterCode: 'PROCESS_TERMINATION_UNCONFIRMED',
        terminationReason: 'process-error'
      },
      'PROCESS_TERMINATION_UNCONFIRMED'
    ],
    [
      {
        terminationFailed: true,
        reporterCode: 'PROCESS_TREE_TERMINATOR_TIMEOUT',
        terminationReason: 'timeout',
        timedOut: true
      },
      'PROCESS_TREE_TERMINATOR_TIMEOUT'
    ],
    [
      {
        terminationFailed: true,
        reporterCode: 'PROCESS_TREE_TERMINATOR_RESIDUAL',
        terminationReason: 'timeout',
        timedOut: true
      },
      'PROCESS_TREE_TERMINATOR_RESIDUAL'
    ]
  ];
  for (const [overrides, expectedCode] of failures) {
    const started = [];
    const recorded = [];
    await assert.rejects(
      executeSuiteSequence(
        ['first.test.js', 'never-started.test.js'],
        { suiteTimeoutMs: 100, maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES },
        { activeChild: null, interrupted: false },
        {
          executor: async suitePath => {
            started.push(suitePath);
            return executionResult(suitePath, overrides);
          },
          onResult: (execution, suite) => recorded.push(suite)
        }
      ),
      error =>
        error instanceof GateError &&
        error.stage === 'suite-execution' &&
        error.code === expectedCode
    );
    assert.deepEqual(started, ['first.test.js']);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].path, 'first.test.js');
    await withTemporaryRepository(async root => {
      const finalEvidence = buildEvidence(
        evidenceState({
          inventory: {
            declared: ['first.test.js', 'never-started.test.js'],
            discovered: ['first.test.js', 'never-started.test.js'],
            executed: ['first.test.js']
          },
          effectiveArguments: [{ path: 'first.test.js', arguments: ['--test', 'first.test.js'] }],
          perSuite: recorded,
          counts: { pass: 0, fail: 0, skipped: 0, todo: 0, cancelled: 0, total: 0 },
          exitCode: 1,
          failureStage: 'suite-execution',
          failureCode: expectedCode
        })
      );
      const evidencePath = await writeEvidenceAtomic(
        root,
        '.qa-output/test-evidence.json',
        finalEvidence
      );
      const persisted = JSON.parse(await readFile(path.join(root, evidencePath), 'utf8'));
      validateEvidence(persisted);
      assert.equal(persisted.failureStage, 'suite-execution');
      assert.equal(persisted.failureCode, expectedCode);
      assert.equal(persisted.perSuite.length, 1);
      if (expectedCode === 'PROCESS_TREE_TERMINATOR_RESIDUAL') {
        assert.equal(persisted.perSuite[0].completed, false);
        assert.equal(persisted.perSuite[0].timedOut, true);
        assert.deepEqual(persisted.inventory.executed, ['first.test.js']);
      }
      assert.doesNotMatch(JSON.stringify(persisted), /Users[\\/]|password|secret|token/i);
    });
  }
});

test('persists completed only for normalized normal suite completion', () => {
  const cases = [
    ['nominal', {}, true],
    ['timeout', { timedOut: true, terminationReason: 'timeout' }, false],
    ['SIGINT', { interrupted: true, terminationSignal: 'SIGINT' }, false],
    ['SIGTERM', { interrupted: true, terminationSignal: 'SIGTERM' }, false],
    ['termination failure', { terminationFailed: true }, false],
    [
      'unconfirmed termination',
      {
        terminationRequested: true,
        directChildClosed: true,
        treeTerminationConfirmed: false
      },
      false
    ],
    [
      'residual terminator',
      {
        timedOut: true,
        terminationFailed: true,
        reporterCode: 'PROCESS_TREE_TERMINATOR_RESIDUAL'
      },
      false
    ],
    [
      'incomplete reporter',
      {
        reporterResult: {
          ...executionResult('suite.test.js').reporterResult,
          completed: false
        }
      },
      false
    ]
  ];

  for (const [name, overrides, expected] of cases) {
    const persisted = toPerSuite(executionResult('suite.test.js', overrides));
    assert.equal(persisted.completed, expected, name);
  }
});

function manualTimerDependencies(child, treeResult) {
  const timers = new Map();
  let nextId = 1;
  return {
    dependencies: {
      spawn: () => child,
      platform: 'linux',
      terminationGraceMs: 1,
      terminationFinalMs: 1,
      terminateTree: async () => treeResult,
      setTimeout(callback) {
        const id = nextId++;
        timers.set(id, callback);
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      }
    },
    runNextTimer() {
      const entry = timers.entries().next().value;
      assert.ok(entry, 'expected a pending timer');
      const [id, callback] = entry;
      timers.delete(id);
      callback();
    },
    pendingTimers: () => timers.size
  };
}

test('uses a bounded terminal state when a child never closes', async () => {
  const child = new FakeChild();
  const harness = manualTimerDependencies(child, { requested: true, confirmed: true });
  const control = { activeChild: null, interrupted: false };
  const promise = executeSuite(
    'suite.test.js',
    { suiteTimeoutMs: 1, maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES },
    control,
    harness.dependencies
  );
  harness.runNextTimer();
  await Promise.resolve();
  harness.runNextTimer();
  const result = await promise;
  assert.equal(result.terminationFailed, true);
  assert.equal(result.reporterCode, 'PROCESS_TERMINATION_UNCONFIRMED');
  assert.equal(control.activeChild, null);
  assert.equal(control.terminateActive, null);
  assert.equal(harness.pendingTimers(), 0);
});

test('reports a failed kill without leaving pending gate work', async () => {
  const child = new FakeChild();
  const harness = manualTimerDependencies(child, { requested: true, confirmed: false });
  const control = { activeChild: null, interrupted: false };
  const promise = executeSuite(
    'suite.test.js',
    { suiteTimeoutMs: 1, maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES },
    control,
    harness.dependencies
  );
  harness.runNextTimer();
  await Promise.resolve();
  harness.runNextTimer();
  const result = await promise;
  assert.equal(result.terminationFailed, true);
  assert.equal(result.exitCode, 1);
  assert.equal(harness.pendingTimers(), 0);
  assert.equal(child.listenerCount('close'), 0);
});

test('normal close wins deterministically over a later timeout callback', async () => {
  const child = new FakeChild();
  let timeoutCallback;
  let kills = 0;
  const control = { activeChild: null, interrupted: false };
  const promise = executeSuite(
    'suite.test.js',
    { suiteTimeoutMs: 1, maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES },
    control,
    {
      spawn: () => child,
      platform: 'linux',
      setTimeout(callback) {
        timeoutCallback = callback;
        return 1;
      },
      clearTimeout() {}
    }
  );
  child.stdout.end(validReporterLine());
  child.stderr.end();
  child.emit('close', 0, null);
  timeoutCallback();
  child.kill = () => {
    kills += 1;
    return true;
  };
  const result = await promise;
  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 0);
  assert.equal(kills, 0);
  assert.equal(control.activeChild, null);
});

function controlledTimers() {
  const timers = new Map();
  let nextId = 1;
  return {
    schedule(callback) {
      const id = nextId++;
      timers.set(id, callback);
      return id;
    },
    cancel(id) {
      timers.delete(id);
    },
    runNext() {
      const entry = timers.entries().next().value;
      assert.ok(entry, 'expected pending timer');
      timers.delete(entry[0]);
      entry[1]();
    },
    size: () => timers.size
  };
}

test('bounds a taskkill instance that never closes and ignores termination', async () => {
  const timers = controlledTimers();
  const terminator = new EventEmitter();
  terminator.pid = 5678;
  let kills = 0;
  let unrefs = 0;
  terminator.kill = () => {
    kills += 1;
    return false;
  };
  terminator.unref = () => {
    unrefs += 1;
  };
  const child = { pid: 1234, exitCode: null, signalCode: null };
  const promise = terminateProcessTree(child, {
    platform: 'win32',
    spawnProcess: (command, args, options) => {
      assert.equal(command, 'taskkill.exe');
      assert.deepEqual(args, ['/PID', '1234', '/T', '/F']);
      assert.equal(options.shell, undefined);
      return terminator;
    },
    scheduleTimeout: callback => timers.schedule(callback),
    cancelTimeout: id => timers.cancel(id),
    taskkillTimeoutMs: 1,
    taskkillCloseDeadlineMs: 1,
    taskkillSecondCloseDeadlineMs: 1,
    probeProcess: () => {}
  });
  timers.runNext();
  assert.equal(kills, 1);
  timers.runNext();
  assert.equal(kills, 2);
  timers.runNext();
  const result = await promise;
  assert.equal(result.code, 'PROCESS_TREE_TERMINATOR_RESIDUAL');
  assert.equal(result.confirmed, false);
  assert.equal(result.terminatorTimedOut, true);
  assert.equal(result.terminatorExitConfirmed, false);
  assert.equal(result.controlledResidualProcess, true);
  assert.equal(unrefs, 1);
  assert.equal(timers.size(), 0);
  assert.equal(terminator.listenerCount('error'), 0);
  assert.equal(terminator.listenerCount('close'), 0);
});

test('taskkill close and internal timeout share one idempotent terminal state', async () => {
  const timers = controlledTimers();
  const terminator = new EventEmitter();
  terminator.pid = 5678;
  terminator.kill = () => true;
  const promise = terminateProcessTree(
    { pid: 1234, exitCode: null, signalCode: null },
    {
      platform: 'win32',
      spawnProcess: () => terminator,
      scheduleTimeout: callback => timers.schedule(callback),
      cancelTimeout: id => timers.cancel(id)
    }
  );
  terminator.emit('close', 0);
  const result = await promise;
  assert.equal(result.confirmed, true);
  assert.equal(timers.size(), 0);
  assert.equal(terminator.listenerCount('close'), 0);
  assert.equal(terminator.listenerCount('error'), 0);

  const lateTimers = controlledTimers();
  const lateTerminator = new EventEmitter();
  lateTerminator.pid = 5679;
  lateTerminator.kill = () => true;
  const latePromise = terminateProcessTree(
    { pid: 1235, exitCode: null, signalCode: null },
    {
      platform: 'win32',
      spawnProcess: () => lateTerminator,
      scheduleTimeout: callback => lateTimers.schedule(callback),
      cancelTimeout: id => lateTimers.cancel(id)
    }
  );
  lateTimers.runNext();
  lateTerminator.emit('close', 0);
  const lateResult = await latePromise;
  assert.equal(lateResult.code, 'PROCESS_TREE_TERMINATOR_TIMEOUT');
  assert.equal(lateTimers.size(), 0);
  assert.equal(lateTerminator.listenerCount('close'), 0);
});

test('real terminator exits on the second attempt before timeout success resolves', async () => {
  const terminator = spawnProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
    windowsHide: true
  });
  await new Promise((resolve, reject) => {
    terminator.once('spawn', resolve);
    terminator.once('error', reject);
  });
  const pid = terminator.pid;
  const originalKill = terminator.kill.bind(terminator);
  const closed = new Promise(resolve => terminator.once('close', resolve));
  let attempts = 0;
  terminator.kill = signal => {
    attempts += 1;
    return attempts === 1 ? false : originalKill(signal);
  };
  const result = await terminateProcessTree(
    { pid: 1236, exitCode: null, signalCode: null },
    {
      platform: 'win32',
      spawnProcess: () => terminator,
      taskkillTimeoutMs: 20,
      taskkillCloseDeadlineMs: 20,
      taskkillSecondCloseDeadlineMs: 1_000
    }
  );
  const alive = (() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  })();
  if (alive) {
    originalKill('SIGTERM');
    await closed;
  }
  assert.equal(result.code, 'PROCESS_TREE_TERMINATOR_TIMEOUT');
  assert.equal(result.secondAttempted, true);
  assert.equal(result.terminatorExitConfirmed, true);
  assert.equal(result.controlledResidualProcess, false);
  assert.equal(alive, false);
});

test('real residual terminator fails closed before controlled fixture cleanup', async () => {
  const terminator = spawnProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
    windowsHide: true
  });
  await new Promise((resolve, reject) => {
    terminator.once('spawn', resolve);
    terminator.once('error', reject);
  });
  const pid = terminator.pid;
  const originalKill = terminator.kill.bind(terminator);
  const closed = new Promise(resolve => terminator.once('close', resolve));
  terminator.kill = () => false;
  const result = await terminateProcessTree(
    { pid: 1237, exitCode: null, signalCode: null },
    {
      platform: 'win32',
      spawnProcess: () => terminator,
      taskkillTimeoutMs: 20,
      taskkillCloseDeadlineMs: 20,
      taskkillSecondCloseDeadlineMs: 20
    }
  );
  const aliveBeforeCleanup = (() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  })();
  assert.equal(result.code, 'PROCESS_TREE_TERMINATOR_RESIDUAL');
  assert.equal(result.terminatorExitConfirmed, false);
  assert.equal(result.controlledResidualProcess, true);
  assert.equal(aliveBeforeCleanup, true);
  originalKill('SIGTERM');
  await closed;
  assert.throws(() => process.kill(pid, 0));
});

test('closed child state skips taskkill before both pre-spawn checks', async () => {
  for (const child of [
    { pid: 1234, exitCode: null, signalCode: null, observed: true },
    { pid: 1234, exitCode: 0, signalCode: null, observed: false },
    { pid: 1234, exitCode: null, signalCode: 'SIGTERM', observed: false }
  ]) {
    let spawns = 0;
    const result = await terminateProcessTree(child, {
      platform: 'win32',
      isChildCloseObserved: () => child.observed,
      spawnProcess: () => {
        spawns += 1;
      }
    });
    assert.equal(result.code, 'CHILD_ALREADY_CLOSED');
    assert.equal(spawns, 0);
  }

  const child = { pid: 1234, exitCode: null, signalCode: null };
  let spawns = 0;
  const result = await terminateProcessTree(child, {
    platform: 'win32',
    beforeTerminatorSpawn: () => {
      child.exitCode = 0;
    },
    spawnProcess: () => {
      spawns += 1;
    }
  });
  assert.equal(result.code, 'CHILD_ALREADY_CLOSED');
  assert.equal(spawns, 0);
});

test(
  'terminates a real controlled Windows child process tree',
  { skip: process.platform !== 'win32' },
  async () => {
    const parentSource = [
      "const { spawn } = require('node:child_process');",
      "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });",
      'process.stdout.write(String(child.pid) + "\\n");',
      'setInterval(() => {}, 1000);'
    ].join('');
    const parent = spawnProcess(process.execPath, ['-e', parentSource], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });
    const descendantPid = await new Promise((resolve, reject) => {
      let text = '';
      parent.once('error', reject);
      parent.stdout.on('data', chunk => {
        text += chunk.toString('utf8');
        const match = text.match(/^(\d+)\r?\n/);
        if (match) resolve(Number(match[1]));
      });
    });
    const parentClosed = new Promise(resolve => {
      const deadline = scheduleTimeout(() => resolve(false), 3_000);
      parent.once('close', () => {
        cancelTimeout(deadline);
        resolve(true);
      });
    });
    const result = await terminateProcessTree(parent, { platform: 'win32', spawnProcess });
    const closeConfirmed = await parentClosed;
    const isAlive = pid => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    try {
      assert.equal(result.confirmed, true);
      assert.equal(closeConfirmed, true);
      assert.equal(isAlive(parent.pid), false);
      assert.equal(isAlive(descendantPid), false);
    } finally {
      if (isAlive(parent.pid)) parent.kill('SIGTERM');
      if (isAlive(descendantPid)) {
        try {
          process.kill(descendantPid, 'SIGTERM');
        } catch {
          // The controlled descendant already exited.
        }
      }
    }
  }
);

test('captures a nonzero child exit without retaining stderr', async () => {
  const result = await executeSuite(
    'suite.test.js',
    { suiteTimeoutMs: 1000, maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES },
    { activeChild: null, interrupted: false },
    {
      spawn: completedSpawner({ stderr: 'sensitive-payload', exitCode: 1 }),
      setTimeout: () => 1,
      clearTimeout: () => {}
    }
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.stderrBytes, Buffer.byteLength('sensitive-payload'));
  assert.notEqual(result.stderrSha256, ZERO_HASH);
  assert.equal(Object.hasOwn(result, 'stderr'), false);
});

test('fails when retained reporter output exceeds its limit', async () => {
  const result = await executeSuite(
    'suite.test.js',
    { suiteTimeoutMs: 1000, maxReporterBytes: 8 },
    { activeChild: null, interrupted: false },
    {
      spawn: completedSpawner(),
      setTimeout: () => 1,
      clearTimeout: () => {},
      terminateTree: async () => ({ requested: true, confirmed: true })
    }
  );
  assert.equal(result.reporterCode, 'REPORTER_OUTPUT_LIMIT_EXCEEDED');
});

test('reporter rejects missing and duplicate overall summaries', async () => {
  const missing = await reporterOutput([{ type: 'test:pass', data: {} }]);
  assert.equal(missing.summaryCount, 0);
  assert.equal(missing.completed, false);
  const summary = {
    type: 'test:summary',
    data: { type: 'test', counts: { passed: 1, failed: 0, tests: 1 } }
  };
  const duplicate = await reporterOutput([summary, summary]);
  assert.equal(duplicate.summaryCount, 2);
  assert.equal(duplicate.completed, false);
});

test('event stream hash changes when any event changes', async () => {
  const first = await reporterOutput([{ type: 'test:pass', data: { name: 'a' } }]);
  const second = await reporterOutput([{ type: 'test:pass', data: { name: 'b' } }]);
  assert.notEqual(first.eventStreamSha256, second.eventStreamSha256);
});

test('parseReporterResult rejects missing and duplicate bounded results', () => {
  assert.throws(() => parseReporterResult(Buffer.from('')), /INVALID_REPORTER_OUTPUT/);
  const line = validReporterLine();
  assert.throws(
    () => parseReporterResult(Buffer.from(`${line}${line}`)),
    /INVALID_REPORTER_OUTPUT/
  );
});

test('aggregates exactly 20 + 40 + 66 + 51 + 34 + 28 = 239', () => {
  const results = SUITES.map(([suitePath, total]) => suiteResult(suitePath, total));
  const counts = aggregateSuiteResults(
    SUITES.map(([suitePath]) => suitePath),
    results,
    baseline()
  );
  assert.equal(counts.total, 20 + 40 + 66 + 51 + 34 + 28);
  assert.equal(counts.total, 239);
});

test('aggregation rejects missing, duplicate, incomplete, incompatible, and inconsistent results', () => {
  const declared = SUITES.map(([suitePath]) => suitePath);
  const results = SUITES.map(([suitePath, total]) => suiteResult(suitePath, total));
  assert.throws(() => aggregateSuiteResults(declared, results.slice(1), baseline()), /MISSING/);
  assert.throws(
    () => aggregateSuiteResults(declared, [...results, results[0]], baseline()),
    /DUPLICATE/
  );
  assert.throws(
    () =>
      aggregateSuiteResults(
        declared,
        [suiteResult(declared[0], SUITES[0][1], { completed: false }), ...results.slice(1)],
        baseline()
      ),
    /INCOMPLETE/
  );
  assert.throws(
    () =>
      aggregateSuiteResults(
        declared,
        [suiteResult(declared[0], SUITES[0][1], { exitCode: 1 }), ...results.slice(1)],
        baseline()
      ),
    /EXIT_SUMMARY/
  );
  assert.throws(
    () =>
      aggregateSuiteResults(
        declared,
        [suiteResult(declared[0], SUITES[0][1] - 1), ...results.slice(1)],
        baseline()
      ),
    /SUITE_TOTAL/
  );
});

test('aggregate output hash changes with stderr and termination state', () => {
  const base = [suiteResult('suite.test.js', 1)];
  const changedStderr = [suiteResult('suite.test.js', 1, { stderrSha256: 'c'.repeat(64) })];
  const interrupted = [suiteResult('suite.test.js', 1, { interrupted: true })];
  assert.notEqual(hashAggregateOutput(base), hashAggregateOutput(changedStderr));
  assert.notEqual(hashAggregateOutput(base), hashAggregateOutput(interrupted));
});

test('validates sanitized success and failure evidence', () => {
  validateEvidence(buildEvidence(evidenceState()));
  for (const failureStage of [
    'inventory',
    'metadata',
    'node-version',
    'suite-execution',
    'evidence-write',
    'interruption'
  ]) {
    const evidence = buildEvidence(
      evidenceState({
        metadata: {
          commit: null,
          workingTree: 'unknown',
          commitDateUtc: null,
          npmVersion: null,
          packageLockSha256: null
        },
        inventory: { declared: [], discovered: [], executed: [] },
        effectiveArguments: [],
        perSuite: [],
        counts: { pass: 0, fail: 0, skipped: 0, todo: 0, cancelled: 0, total: 0 },
        exitCode: 1,
        failureStage,
        failureCode: 'CONTROLLED_FAILURE'
      })
    );
    validateEvidence(evidence);
  }
});

test('evidence schema rejects personal paths, credentials, and unexpected nested fields', () => {
  const evidence = buildEvidence(evidenceState());
  evidence.inventory.declared = ['C:\\Users\\person\\suite.test.js'];
  assert.throws(() => validateEvidence(evidence), /sensitive|absolute/);
  const nested = buildEvidence(evidenceState());
  nested.runtime.secret = 'forbidden';
  assert.throws(() => validateEvidence(nested), /keys mismatch/);
});

test('writes evidence atomically and removes temporary files', async () => {
  await withTemporaryRepository(async root => {
    const evidence = buildEvidence(evidenceState());
    const relativePath = await writeEvidenceAtomic(root, '.qa-output/test-evidence.json', evidence);
    validateEvidence(JSON.parse(await readFile(path.join(root, relativePath), 'utf8')));
    assert.deepEqual(await readdir(path.join(root, '.qa-output')), ['test-evidence.json']);
  });
});

test('persists run-bound recovery evidence after temporary write failure', async () => {
  const evidence = buildEvidence(evidenceState());
  const files = new Map();
  let writes = 0;
  const error = await captureRejection(
    writeEvidenceAtomic('/virtual', '.qa-output/evidence.json', evidence, {
      mkdir: async () => {},
      writeFile: async (filePath, contents) => {
        writes += 1;
        if (writes === 1) throw new Error('write failed');
        files.set(filePath, contents);
      },
      rename: async () => {},
      rm: async () => {}
    })
  );
  assert.equal(error.code, 'EVIDENCE_TEMP_WRITE_FAILED');
  assert.match(error.persistedPath, new RegExp(evidence.runId));
  const recovered = JSON.parse([...files.values()][0]);
  assert.equal(recovered.failureStage, 'evidence-write');
  assert.equal(recovered.failureCode, 'EVIDENCE_TEMP_WRITE_FAILED');
  assert.equal(recovered.runId, evidence.runId);
  assert.equal(recovered.startedAt, evidence.startedAt);
  assert.ok(Date.parse(recovered.finishedAt) >= Date.parse(recovered.startedAt));
  validateEvidence(recovered);
});

test('consolidates recovery evidence after rename failure', async () => {
  const evidence = buildEvidence(evidenceState());
  const files = new Map();
  let removed = false;
  const error = await captureRejection(
    writeEvidenceAtomic('/virtual', '.qa-output/evidence.json', evidence, {
      mkdir: async () => {},
      writeFile: async (filePath, contents) => files.set(filePath, contents),
      rename: async () => {
        throw new Error('rename failed');
      },
      rm: async () => {
        removed = true;
      }
    })
  );
  assert.equal(error.code, 'EVIDENCE_RENAME_FAILED');
  assert.match(error.persistedPath, new RegExp(evidence.runId));
  assert.equal(removed, true);
  const recoveryEntry = [...files.entries()].find(([filePath]) =>
    filePath.endsWith('.recovery.json')
  );
  const recovered = JSON.parse(recoveryEntry[1]);
  assert.equal(recovered.failureStage, 'evidence-write');
  assert.equal(recovered.failureCode, 'EVIDENCE_RENAME_FAILED');
  assert.equal(recovered.runId, evidence.runId);
  assert.equal(recovered.startedAt, evidence.startedAt);
  assert.ok(Date.parse(recovered.finishedAt) >= Date.parse(recovered.startedAt));
  validateEvidence(recovered);
});

test('fails closed on recovery collision and never masks cleanup failure', async () => {
  const evidence = buildEvidence(evidenceState());
  let writes = 0;
  const error = await captureRejection(
    writeEvidenceAtomic('/virtual', '.qa-output/evidence.json', evidence, {
      mkdir: async () => {},
      writeFile: async () => {
        writes += 1;
        throw new Error(writes === 1 ? 'primary failed' : 'recovery collision');
      },
      rename: async () => {},
      rm: async () => {
        throw new Error('cleanup failed');
      }
    })
  );
  assert.equal(error.code, 'EVIDENCE_TEMP_WRITE_FAILED');
  assert.equal(error.recoveryCode, 'EVIDENCE_RECOVERY_FAILED');
  assert.equal(error.cleanupCode, 'EVIDENCE_CLEANUP_FAILED');
  assert.equal(error.persistedPath, null);
  assert.equal(writes, 2);
  assert.equal(
    formatEvidenceFailureDiagnostics(error),
    'AERP-QA-001 NO_PERSISTED_EVIDENCE_FOR_CURRENT_RUN\n' +
      'AERP-QA-001 recovery failure: EVIDENCE_RECOVERY_FAILED\n' +
      'AERP-QA-001 cleanup failure: EVIDENCE_CLEANUP_FAILED\n'
  );
});

test('replaces previous canonical evidence with the current run identity', async () => {
  await withTemporaryRepository(async root => {
    const outputDirectory = path.join(root, '.qa-output');
    const outputPath = path.join(outputDirectory, 'test-evidence.json');
    await mkdir(outputDirectory);
    await writeFile(outputPath, JSON.stringify({ runId: 'previous-run' }));
    const evidence = buildEvidence(evidenceState());
    await rm(outputPath, { force: true });
    await writeEvidenceAtomic(root, '.qa-output/test-evidence.json', evidence);
    const persisted = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(persisted.runId, evidence.runId);
    assert.notEqual(persisted.runId, 'previous-run');
    assert.deepEqual(await readdir(outputDirectory), ['test-evidence.json']);
  });
});

test('output framing is unambiguous for concatenated values', () => {
  const first = [suiteResult('ab.test.js', 1, { stderrBytes: 12 })];
  const second = [suiteResult('a.test.js', 1, { stderrBytes: 212 })];
  assert.notEqual(hashAggregateOutput(first), hashAggregateOutput(second));
  assert.equal(createHash('sha256').update('deterministic').digest('hex').length, 64);
});
