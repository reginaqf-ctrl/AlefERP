import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath } from 'node:url';

import { REPORTER_SCHEMA_VERSION, SUITE_RESULT_MARKER } from './node-test-evidence-reporter.mjs';
import {
  EVIDENCE_SCHEMA_VERSION,
  assertCanonicalNodeVersion,
  assertExactTestInventory,
  discoverTestSuites,
  loadTestManifest,
  validateEvidence
} from './test-inventory.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIRECTORY, '../..');
const MANIFEST_PATH = 'qa/manifests/test-suites.json';
const REPORTER_PATH = 'scripts/qa/node-test-evidence-reporter.mjs';
const EVIDENCE_PATH = '.qa-output/test-evidence.json';
export const DEFAULT_SUITE_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_REPORTER_BYTES = 64 * 1024;
export const TERMINATION_GRACE_MS = 1_000;
export const TERMINATION_FINAL_MS = 1_000;
export const TASKKILL_TIMEOUT_MS = 5_000;
export const TASKKILL_CLOSE_DEADLINE_MS = 1_000;
export const TASKKILL_SECOND_CLOSE_DEADLINE_MS = 1_000;
const MAX_SUITE_TIMEOUT_MS = 15 * 60_000;
const MAX_REPORTER_BYTES = 1024 * 1024;
const ZERO_HASH = '0'.repeat(64);
const EMPTY_COUNTS = Object.freeze({
  pass: 0,
  fail: 0,
  skipped: 0,
  todo: 0,
  cancelled: 0,
  total: 0
});

export class GateError extends Error {
  constructor(stage, code) {
    super(code);
    this.stage = stage;
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function framedUpdate(hash, value) {
  const bytes = Buffer.from(String(value), 'utf8');
  const length = Buffer.allocUnsafe(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  hash.update(length);
  hash.update(bytes);
}

export function parseCliArguments(args) {
  const options = {
    suiteTimeoutMs: DEFAULT_SUITE_TIMEOUT_MS,
    maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES
  };
  for (const argument of args) {
    const [name, rawValue] = argument.split('=', 2);
    if (!rawValue || !['--suite-timeout-ms', '--max-reporter-bytes'].includes(name)) {
      throw new GateError('initialization', 'INVALID_CLI_ARGUMENT');
    }
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new GateError('initialization', 'INVALID_CLI_ARGUMENT');
    }
    if (name === '--suite-timeout-ms') {
      if (value > MAX_SUITE_TIMEOUT_MS) {
        throw new GateError('initialization', 'INVALID_SUITE_TIMEOUT');
      }
      options.suiteTimeoutMs = value;
    } else {
      if (value > MAX_REPORTER_BYTES) {
        throw new GateError('initialization', 'INVALID_REPORTER_LIMIT');
      }
      options.maxReporterBytes = value;
    }
  }
  return options;
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) throw new GateError('metadata', 'METADATA_COMMAND_FAILED');
  return result.stdout.trim();
}

export async function collectRepositoryMetadata(dependencies = { readFile, commandOutput }) {
  try {
    const packageLock = await dependencies.readFile(path.join(REPO_ROOT, 'package-lock.json'));
    const npmVersion =
      process.platform === 'win32'
        ? dependencies.commandOutput('cmd.exe', ['/d', '/s', '/c', 'npm.cmd --version'])
        : dependencies.commandOutput('npm', ['--version']);
    return {
      commit: dependencies.commandOutput('git', ['rev-parse', 'HEAD']),
      workingTree: dependencies.commandOutput('git', ['status', '--porcelain=v1'])
        ? 'dirty'
        : 'clean',
      commitDateUtc: new Date(
        dependencies.commandOutput('git', ['show', '-s', '--format=%cI', 'HEAD'])
      ).toISOString(),
      npmVersion,
      packageLockSha256: sha256(packageLock)
    };
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError('metadata', 'METADATA_COLLECTION_FAILED');
  }
}

export async function writeEvidenceAtomic(
  repoRoot,
  relativePath,
  evidence,
  operations = { mkdir, writeFile, rename, rm }
) {
  validateEvidence(evidence);
  if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new GateError('evidence-write', 'ABSOLUTE_EVIDENCE_PATH');
  }
  const outputPath = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, outputPath);
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new GateError('evidence-write', 'EVIDENCE_PATH_ESCAPE');
  }
  if (!relative.split(path.sep).join('/').startsWith('.qa-output/')) {
    throw new GateError('evidence-write', 'INVALID_EVIDENCE_DIRECTORY');
  }

  await operations.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${evidence.runId}.${process.pid}.${randomUUID()}.tmp`;
  const recoveryPath = `${outputPath}.${evidence.runId}.recovery.json`;
  const failureEvidence = code => ({
    ...evidence,
    finishedAt: new Date().toISOString(),
    exitCode: 1,
    result: 'failed',
    failureStage: 'evidence-write',
    failureCode: code
  });
  const relativeOutput = relative.split(path.sep).join('/');
  const relativeRecovery = path.relative(repoRoot, recoveryPath).split(path.sep).join('/');
  const cleanup = async () => {
    try {
      await operations.rm(temporaryPath, { force: true });
      return null;
    } catch {
      return 'EVIDENCE_CLEANUP_FAILED';
    }
  };
  const recover = async primaryCode => {
    const recoveryEvidence = failureEvidence(primaryCode);
    validateEvidence(recoveryEvidence);
    try {
      await operations.writeFile(recoveryPath, `${JSON.stringify(recoveryEvidence, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx'
      });
      return { persistedPath: relativeRecovery, recoveryCode: null };
    } catch {
      return { persistedPath: null, recoveryCode: 'EVIDENCE_RECOVERY_FAILED' };
    }
  };
  const fail = (primaryCode, recovery, cleanupCode) => {
    const error = new GateError('evidence-write', primaryCode);
    error.persistedPath = recovery.persistedPath;
    error.recoveryCode = recovery.recoveryCode;
    error.cleanupCode = cleanupCode;
    return error;
  };

  try {
    await operations.writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    });
  } catch {
    const recovery = await recover('EVIDENCE_TEMP_WRITE_FAILED');
    throw fail('EVIDENCE_TEMP_WRITE_FAILED', recovery, await cleanup());
  }
  try {
    await operations.rename(temporaryPath, outputPath);
  } catch {
    const recovery = await recover('EVIDENCE_RENAME_FAILED');
    throw fail('EVIDENCE_RENAME_FAILED', recovery, await cleanup());
  }
  const cleanupCode = await cleanup();
  if (cleanupCode) {
    throw fail(
      'EVIDENCE_CLEANUP_FAILED',
      { persistedPath: relativeOutput, recoveryCode: null },
      cleanupCode
    );
  }
  return relativeOutput;
}

export function formatEvidenceFailureDiagnostics(error) {
  const lines = [];
  if (error?.persistedPath) lines.push(`AERP-QA-001 persisted evidence: ${error.persistedPath}`);
  else lines.push('AERP-QA-001 NO_PERSISTED_EVIDENCE_FOR_CURRENT_RUN');
  if (error?.recoveryCode) lines.push(`AERP-QA-001 recovery failure: ${error.recoveryCode}`);
  if (error?.cleanupCode) lines.push(`AERP-QA-001 cleanup failure: ${error.cleanupCode}`);
  return `${lines.join('\n')}\n`;
}

export function requestInterruption(control, signal) {
  control.interrupted = true;
  control.signal = signal;
  if (control.terminateActive) control.terminateActive('interruption');
}

export function parseReporterResult(bytes) {
  const text = bytes.toString('utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const markers = lines.filter(line => line.startsWith(SUITE_RESULT_MARKER));
  if (markers.length !== 1 || lines.length !== 1) {
    throw new GateError('suite-execution', 'INVALID_REPORTER_OUTPUT');
  }
  const result = JSON.parse(markers[0].slice(SUITE_RESULT_MARKER.length));
  if (result.schemaVersion !== REPORTER_SCHEMA_VERSION) {
    throw new GateError('suite-execution', 'INVALID_REPORTER_SCHEMA');
  }
  if (result.summaryCount !== 1) {
    throw new GateError('suite-execution', 'INVALID_SUMMARY_COUNT');
  }
  if (result.outputLimitExceeded) {
    throw new GateError('suite-execution', 'EVENT_OUTPUT_LIMIT_EXCEEDED');
  }
  return result;
}

export function checkControlledProcessStatus(child, probeProcess = process.kill) {
  const pid = child?.pid;
  if (!Number.isSafeInteger(pid) || pid <= 0) return 'unknown';
  if (child.exitCode !== null && child.exitCode !== undefined) return 'absent';
  if (child.signalCode !== null && child.signalCode !== undefined) return 'absent';
  try {
    probeProcess(pid, 0);
    return 'present';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'absent' : 'unknown';
  }
}

export function terminateProcessTree(
  child,
  {
    platform = process.platform,
    spawnProcess = spawn,
    killProcess = process.kill,
    scheduleTimeout = setTimeout,
    cancelTimeout = clearTimeout,
    taskkillTimeoutMs = TASKKILL_TIMEOUT_MS,
    taskkillCloseDeadlineMs = TASKKILL_CLOSE_DEADLINE_MS,
    taskkillSecondCloseDeadlineMs = TASKKILL_SECOND_CLOSE_DEADLINE_MS,
    isChildCloseObserved = () => false,
    beforeTerminatorSpawn = () => {},
    probeProcess = process.kill
  } = {}
) {
  const pid = child?.pid;
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return Promise.resolve({ requested: false, confirmed: false, code: 'INVALID_CHILD_PID' });
  }
  if (platform !== 'win32') {
    try {
      killProcess(-pid, 'SIGKILL');
      return Promise.resolve({ requested: true, confirmed: true, code: 'PROCESS_GROUP_KILLED' });
    } catch {
      return Promise.resolve({
        requested: true,
        confirmed: false,
        code: 'PROCESS_GROUP_KILL_FAILED'
      });
    }
  }
  const childKnownClosed = () =>
    isChildCloseObserved() === true || child.exitCode !== null || child.signalCode !== null;
  if (childKnownClosed()) {
    return Promise.resolve({ requested: false, confirmed: false, code: 'CHILD_ALREADY_CLOSED' });
  }
  beforeTerminatorSpawn();
  if (childKnownClosed()) {
    return Promise.resolve({ requested: false, confirmed: false, code: 'CHILD_ALREADY_CLOSED' });
  }
  // A PID is not a cryptographically stable process identity. These checks reduce the reuse
  // window by using the PID directly from spawn, checking ChildProcess state twice, launching
  // taskkill immediately, and failing closed unless both taskkill and root close are confirmed.
  return new Promise(resolve => {
    let settled = false;
    let timeoutTimer = null;
    let closeDeadlineTimer = null;
    let timedOut = false;
    let secondAttempted = false;
    let terminatorCloseObserved = false;
    let terminator = null;
    const cleanup = () => {
      if (timeoutTimer !== null) cancelTimeout(timeoutTimer);
      if (closeDeadlineTimer !== null) cancelTimeout(closeDeadlineTimer);
      terminator?.removeListener('error', onError);
      terminator?.removeListener('close', onClose);
    };
    const finish = result => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    function onError() {
      finish({ requested: false, confirmed: false, code: 'TREE_TERMINATOR_SPAWN_FAILED' });
    }
    function onClose(code) {
      terminatorCloseObserved = true;
      if (timedOut) {
        finish({
          requested: true,
          confirmed: false,
          code: 'PROCESS_TREE_TERMINATOR_TIMEOUT',
          terminatorTimedOut: true,
          terminatorExitConfirmed: true,
          controlledResidualProcess: false,
          secondAttempted
        });
        return;
      }
      finish({
        requested: true,
        confirmed: code === 0,
        code: code === 0 ? 'PROCESS_TREE_KILLED' : 'PROCESS_TREE_KILL_FAILED',
        terminatorTimedOut: false,
        terminatorExitConfirmed: true,
        controlledResidualProcess: false,
        secondAttempted: false
      });
    }
    try {
      terminator = spawnProcess('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });
    } catch {
      finish({ requested: false, confirmed: false, code: 'TREE_TERMINATOR_SPAWN_FAILED' });
      return;
    }
    const terminatorPid = terminator?.pid;
    terminator.once('error', onError);
    terminator.once('close', onClose);
    const timeoutTerminator = () => {
      if (settled || terminatorCloseObserved) return;
      timedOut = true;
      if (Number.isSafeInteger(terminatorPid) && terminatorPid > 0) {
        try {
          terminator.kill('SIGTERM');
        } catch {
          // The final deadline below remains authoritative.
        }
      }
      closeDeadlineTimer = scheduleTimeout(() => {
        if (settled) return;
        const firstStatus = terminatorCloseObserved
          ? 'absent'
          : checkControlledProcessStatus(terminator, probeProcess);
        if (firstStatus === 'absent') {
          finish({
            requested: true,
            confirmed: false,
            code: 'PROCESS_TREE_TERMINATOR_TIMEOUT',
            terminatorTimedOut: true,
            terminatorExitConfirmed: true,
            controlledResidualProcess: false,
            secondAttempted: false
          });
          return;
        }
        secondAttempted = true;
        if (Number.isSafeInteger(terminatorPid) && terminatorPid > 0) {
          try {
            terminator.kill('SIGKILL');
          } catch {
            // PID status after the final deadline remains authoritative.
          }
        }
        closeDeadlineTimer = scheduleTimeout(() => {
          if (settled) return;
          const finalStatus = terminatorCloseObserved
            ? 'absent'
            : checkControlledProcessStatus(terminator, probeProcess);
          if (finalStatus === 'absent') {
            finish({
              requested: true,
              confirmed: false,
              code: 'PROCESS_TREE_TERMINATOR_TIMEOUT',
              terminatorTimedOut: true,
              terminatorExitConfirmed: true,
              controlledResidualProcess: false,
              secondAttempted: true
            });
            return;
          }
          terminator.unref?.();
          finish({
            requested: true,
            confirmed: false,
            code: 'PROCESS_TREE_TERMINATOR_RESIDUAL',
            terminatorTimedOut: true,
            terminatorExitConfirmed: false,
            controlledResidualProcess: true,
            secondAttempted: true,
            pidStatus: finalStatus
          });
        }, taskkillSecondCloseDeadlineMs);
      }, taskkillCloseDeadlineMs);
    };
    if (childKnownClosed()) timeoutTerminator();
    else timeoutTimer = scheduleTimeout(timeoutTerminator, taskkillTimeoutMs);
  });
}

export function executeSuite(
  suitePath,
  options,
  control,
  dependencies = {
    spawn,
    setTimeout,
    clearTimeout,
    platform: process.platform,
    terminationGraceMs: TERMINATION_GRACE_MS,
    terminationFinalMs: TERMINATION_FINAL_MS,
    terminateTree: terminateProcessTree
  }
) {
  const argumentsList = ['--test', `--test-reporter=./${REPORTER_PATH}`, suitePath];
  return new Promise(resolve => {
    const child = dependencies.spawn(process.execPath, argumentsList, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: (dependencies.platform ?? process.platform) !== 'win32'
    });
    control.activeChild = child;
    const reporterChunks = [];
    let reporterBytes = 0;
    let reporterLimitExceeded = false;
    const stderrHash = createHash('sha256');
    let stderrBytes = 0;
    let timedOut = false;
    let processError = false;
    let settled = false;
    let terminationReason = null;
    let terminationRequested = false;
    let childCloseObserved = false;
    let directChildClosed = false;
    let treeTerminationConfirmed = false;
    let terminationUnconfirmed = false;
    let treeResultKnown = false;
    let treeFailureCode = null;
    let closeCode = null;
    let closeSignal = null;
    let finalTimer = null;

    const clearAllTimers = () => {
      dependencies.clearTimeout(suiteTimer);
      if (finalTimer !== null) dependencies.clearTimeout(finalTimer);
    };
    const cleanup = () => {
      clearAllTimers();
      control.activeChild = null;
      control.terminateActive = null;
      child.removeListener('error', onError);
      child.removeListener('close', onClose);
      child.stdout.removeListener('data', onStdout);
      child.stderr.removeListener('data', onStderr);
    };
    const finalize = (code, signalCode, unconfirmed = false) => {
      if (settled) return;
      settled = true;
      terminationUnconfirmed = unconfirmed;
      cleanup();
      const exitCode = Number.isInteger(code) ? code : 1;
      let reporterResult = null;
      let reporterCode = null;
      try {
        if (reporterLimitExceeded) {
          throw new GateError('suite-execution', 'REPORTER_OUTPUT_LIMIT_EXCEEDED');
        }
        reporterResult = parseReporterResult(Buffer.concat(reporterChunks));
      } catch (error) {
        reporterCode = error instanceof GateError ? error.code : 'REPORTER_PARSE_FAILED';
      }
      if (terminationUnconfirmed) {
        reporterCode =
          treeFailureCode === 'PROCESS_TREE_TERMINATOR_TIMEOUT'
            ? treeFailureCode
            : 'PROCESS_TERMINATION_UNCONFIRMED';
      }
      resolve({
        path: suitePath,
        arguments: argumentsList,
        exitCode,
        signalCode: typeof signalCode === 'string' ? signalCode : null,
        timedOut,
        interrupted: control.interrupted,
        terminationReason,
        terminationSignal: control.signal,
        terminationRequested,
        directChildClosed,
        treeTerminationConfirmed,
        terminationFailed: terminationUnconfirmed,
        processError,
        reporterCode,
        reporterResult,
        stderrSha256: stderrHash.digest('hex'),
        stderrBytes
      });
    };
    const requestTermination = reason => {
      if (settled || terminationReason !== null) return;
      terminationReason = reason;
      terminationRequested = true;
      if (reason === 'timeout') timedOut = true;
      const terminateTree = dependencies.terminateTree ?? terminateProcessTree;
      Promise.resolve(
        terminateTree(child, {
          platform: dependencies.platform ?? process.platform,
          spawnProcess: dependencies.spawn,
          killProcess: process.kill,
          scheduleTimeout: dependencies.setTimeout,
          cancelTimeout: dependencies.clearTimeout,
          taskkillTimeoutMs: dependencies.taskkillTimeoutMs ?? TASKKILL_TIMEOUT_MS,
          taskkillCloseDeadlineMs:
            dependencies.taskkillCloseDeadlineMs ?? TASKKILL_CLOSE_DEADLINE_MS,
          taskkillSecondCloseDeadlineMs:
            dependencies.taskkillSecondCloseDeadlineMs ?? TASKKILL_SECOND_CLOSE_DEADLINE_MS,
          probeProcess: dependencies.probeProcess ?? process.kill,
          isChildCloseObserved: () => childCloseObserved
        })
      )
        .then(result => {
          if (settled) return;
          treeResultKnown = true;
          treeTerminationConfirmed = result?.confirmed === true;
          treeFailureCode = result?.confirmed === true ? null : result?.code;
          if (directChildClosed) finalize(closeCode, closeSignal, !treeTerminationConfirmed);
        })
        .catch(() => {
          treeResultKnown = true;
          treeTerminationConfirmed = false;
          treeFailureCode = 'PROCESS_TREE_KILL_FAILED';
          if (directChildClosed) finalize(closeCode, closeSignal, true);
        });
      finalTimer = dependencies.setTimeout(
        () => finalize(closeCode, closeSignal, !(directChildClosed && treeTerminationConfirmed)),
        (dependencies.terminationGraceMs ?? TERMINATION_GRACE_MS) +
          (dependencies.terminationFinalMs ?? TERMINATION_FINAL_MS)
      );
    };
    control.terminateActive = requestTermination;

    const suiteTimer = dependencies.setTimeout(
      () => requestTermination('timeout'),
      options.suiteTimeoutMs
    );

    function onStdout(chunk) {
      reporterBytes += chunk.length;
      if (reporterBytes <= options.maxReporterBytes) reporterChunks.push(chunk);
      else {
        reporterLimitExceeded = true;
        requestTermination('reporter-output-limit');
      }
    }
    function onStderr(chunk) {
      stderrBytes += chunk.length;
      stderrHash.update(chunk);
    }
    function onError() {
      processError = true;
      requestTermination('process-error');
    }
    function onClose(code, signalCode) {
      childCloseObserved = true;
      directChildClosed = true;
      closeCode = code;
      closeSignal = signalCode;
      if (terminationReason === null) finalize(code, signalCode);
      else if (treeResultKnown) finalize(code, signalCode, !treeTerminationConfirmed);
    }
    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.on('error', onError);
    child.on('close', onClose);
  });
}

function isNormalSuiteCompletion(execution) {
  return (
    execution.reporterResult?.completed === true &&
    execution.processError !== true &&
    execution.timedOut !== true &&
    execution.interrupted !== true &&
    execution.terminationFailed !== true &&
    execution.terminationRequested !== true &&
    execution.reporterCode == null &&
    execution.signalCode == null
  );
}

export function toPerSuite(execution) {
  const result = execution.reporterResult;
  return {
    path: execution.path,
    ...(result?.counts || EMPTY_COUNTS),
    completed: isNormalSuiteCompletion(execution),
    exitCode: execution.exitCode,
    timedOut: execution.timedOut,
    interrupted: execution.interrupted,
    terminationContext: execution.interrupted
      ? execution.terminationSignal
      : execution.terminationReason,
    eventStreamSha256: result?.eventStreamSha256 || ZERO_HASH,
    stderrSha256: execution.stderrSha256,
    stderrBytes: execution.stderrBytes,
    outputBytes: result?.outputBytes || 0
  };
}

export function assertSuccessfulSuiteExecution(execution, suite) {
  if (execution.reporterCode === 'PROCESS_TREE_TERMINATOR_RESIDUAL') {
    throw new GateError('suite-execution', 'PROCESS_TREE_TERMINATOR_RESIDUAL');
  }
  if (execution.reporterCode === 'PROCESS_TREE_TERMINATOR_TIMEOUT') {
    throw new GateError('suite-execution', 'PROCESS_TREE_TERMINATOR_TIMEOUT');
  }
  if (execution.reporterCode === 'PROCESS_TERMINATION_UNCONFIRMED') {
    throw new GateError('suite-execution', 'PROCESS_TERMINATION_UNCONFIRMED');
  }
  if (execution.terminationFailed) {
    throw new GateError('suite-execution', 'PROCESS_TERMINATION_FAILED');
  }
  if (execution.interrupted) throw new GateError('interruption', 'RUN_INTERRUPTED');
  if (execution.timedOut) throw new GateError('suite-execution', 'SUITE_TIMEOUT');
  if (execution.reporterCode) {
    throw new GateError('suite-execution', execution.reporterCode);
  }
  if (!suite.completed) throw new GateError('suite-execution', 'SUITE_INCOMPLETE');
  if (suite.cancelled !== 0) throw new GateError('suite-execution', 'SUITE_TEST_CANCELLED');
  if (suite.fail !== 0) throw new GateError('suite-execution', 'SUITE_TEST_FAILURE');
  if (suite.exitCode !== 0) throw new GateError('suite-execution', 'SUITE_EXIT_NONZERO');
}

export async function executeSuiteSequence(
  suitePaths,
  options,
  control,
  { executor = executeSuite, onResult = () => {} } = {}
) {
  const results = [];
  for (const suitePath of suitePaths) {
    if (control.interrupted) throw new GateError('interruption', 'RUN_INTERRUPTED');
    const execution = await executor(suitePath, options, control);
    const suite = toPerSuite(execution);
    results.push(suite);
    onResult(execution, suite);
    assertSuccessfulSuiteExecution(execution, suite);
  }
  return results;
}

export function aggregateSuiteResults(declared, perSuite, reconciledBaseline) {
  const seen = new Set();
  const byPath = new Map();
  for (const suite of perSuite) {
    if (seen.has(suite.path)) throw new GateError('aggregation', 'DUPLICATE_SUITE_RESULT');
    seen.add(suite.path);
    byPath.set(suite.path, suite);
  }
  if (perSuite.length !== declared.length || declared.some(item => !byPath.has(item))) {
    throw new GateError('aggregation', 'MISSING_SUITE_RESULT');
  }

  const counts = { ...EMPTY_COUNTS };
  for (const suitePath of declared) {
    const suite = byPath.get(suitePath);
    if (!suite.completed) throw new GateError('aggregation', 'INCOMPLETE_SUITE');
    if (suite.timedOut || suite.interrupted) {
      throw new GateError('aggregation', 'TERMINATED_SUITE');
    }
    if (suite.exitCode !== 0 || suite.fail !== 0 || suite.cancelled !== 0) {
      throw new GateError('aggregation', 'SUITE_EXIT_SUMMARY_MISMATCH');
    }
    if (suite.total !== reconciledBaseline.perSuite[suitePath]) {
      throw new GateError('aggregation', 'RECONCILED_SUITE_TOTAL_MISMATCH');
    }
    for (const key of Object.keys(counts)) counts[key] += suite[key];
  }
  if (counts.total !== reconciledBaseline.total || counts.total !== 233) {
    throw new GateError('aggregation', 'RECONCILED_TOTAL_MISMATCH');
  }
  return counts;
}

export function hashAggregateOutput(perSuite) {
  const hash = createHash('sha256');
  for (const suite of perSuite) {
    framedUpdate(hash, suite.path);
    framedUpdate(hash, suite.eventStreamSha256);
    framedUpdate(hash, suite.stderrSha256);
    framedUpdate(hash, suite.stderrBytes);
    framedUpdate(hash, suite.exitCode);
    framedUpdate(hash, suite.timedOut);
    framedUpdate(hash, suite.interrupted);
    framedUpdate(hash, suite.terminationContext);
  }
  return hash.digest('hex');
}

function emptyMetadata() {
  return {
    commit: null,
    workingTree: 'unknown',
    commitDateUtc: null,
    npmVersion: null,
    packageLockSha256: null
  };
}

export function buildEvidence(state) {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    runId: state.runId,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    commit: state.metadata.commit,
    workingTree: state.metadata.workingTree,
    commitDateUtc: state.metadata.commitDateUtc,
    runtime: { node: process.version.replace(/^v/, ''), npm: state.metadata.npmVersion },
    packageLockSha256: state.metadata.packageLockSha256,
    inventory: state.inventory,
    effectiveArguments: state.effectiveArguments,
    perSuite: state.perSuite,
    counts: state.counts,
    exitCode: state.exitCode,
    outputSha256: hashAggregateOutput(state.perSuite),
    result: state.exitCode === 0 ? 'passed' : 'failed',
    failureStage: state.failureStage,
    failureCode: state.failureCode,
    suiteTimeoutMs: state.options.suiteTimeoutMs,
    maxReporterBytes: state.options.maxReporterBytes
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const state = {
    runId: randomUUID(),
    startedAt,
    metadata: emptyMetadata(),
    inventory: { declared: [], discovered: [], executed: [] },
    effectiveArguments: [],
    perSuite: [],
    counts: { ...EMPTY_COUNTS },
    exitCode: 1,
    failureStage: 'initialization',
    failureCode: 'RUN_NOT_COMPLETED',
    options: {
      suiteTimeoutMs: DEFAULT_SUITE_TIMEOUT_MS,
      maxReporterBytes: DEFAULT_MAX_REPORTER_BYTES
    }
  };
  const control = { activeChild: null, interrupted: false, signal: null };
  const onSigint = () => requestInterruption(control, 'SIGINT');
  const onSigterm = () => requestInterruption(control, 'SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  try {
    await rm(path.join(REPO_ROOT, EVIDENCE_PATH), { force: true });
    state.options = parseCliArguments(process.argv.slice(2));

    state.failureStage = 'inventory';
    const manifest = await loadTestManifest(REPO_ROOT, MANIFEST_PATH);
    const discovered = await discoverTestSuites(REPO_ROOT);
    const planned = assertExactTestInventory(REPO_ROOT, {
      declared: manifest.suites,
      discovered,
      executed: manifest.suites
    });
    state.inventory.declared = planned.declared;
    state.inventory.discovered = planned.discovered;

    state.failureStage = 'metadata';
    state.metadata = await collectRepositoryMetadata();

    state.failureStage = 'node-version';
    assertCanonicalNodeVersion(process.version, manifest.canonicalNodeVersion);

    state.failureStage = 'suite-execution';
    await executeSuiteSequence(planned.executed, state.options, control, {
      onResult(execution, suite) {
        state.inventory.executed.push(execution.path);
        state.effectiveArguments.push({ path: execution.path, arguments: execution.arguments });
        state.perSuite.push(suite);
      }
    });

    state.failureStage = 'aggregation';
    state.counts = aggregateSuiteResults(
      planned.executed,
      state.perSuite,
      manifest.reconciledBaseline
    );
    state.exitCode = 0;
    state.failureStage = null;
    state.failureCode = 'NONE';
  } catch (error) {
    state.exitCode = 1;
    state.failureStage = error instanceof GateError ? error.stage : state.failureStage;
    state.failureCode = error instanceof GateError ? error.code : 'UNEXPECTED_FAILURE';
    process.stderr.write(
      `AERP-QA-001 ${state.failureStage || 'unknown'} failure: ${state.failureCode}\n`
    );
    if (state.failureCode === 'PROCESS_TREE_TERMINATOR_RESIDUAL') {
      process.stderr.write('AERP-QA-001 CONTROLLED_TERMINATOR_PROCESS_RESIDUAL\n');
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    let evidence = buildEvidence(state);
    try {
      const evidencePath = await writeEvidenceAtomic(REPO_ROOT, EVIDENCE_PATH, evidence);
      process.stdout.write(`AERP-QA-001 evidence: ${evidencePath}\n`);
    } catch (error) {
      state.exitCode = 1;
      state.failureStage = 'evidence-write';
      state.failureCode = error instanceof GateError ? error.code : 'EVIDENCE_CONTINGENCY_FAILED';
      evidence = buildEvidence(state);
      process.stderr.write(formatEvidenceFailureDiagnostics(error));
      process.stderr.write(
        `AERP-QA-001 ${evidence.failureStage} failure: ${evidence.failureCode}\n`
      );
    }
    process.exitCode = state.exitCode;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) await main();
