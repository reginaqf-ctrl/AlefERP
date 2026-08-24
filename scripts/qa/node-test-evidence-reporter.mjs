import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { serialize } from 'node:v8';

export const SUITE_RESULT_MARKER = 'AERP_QA_SUITE_RESULT ';
export const REPORTER_SCHEMA_VERSION = '1.0.0';
export const MAX_EVENT_STREAM_BYTES = 256 * 1024 * 1024;

const EMPTY_COUNTS = Object.freeze({
  pass: 0,
  fail: 0,
  skipped: 0,
  todo: 0,
  cancelled: 0,
  total: 0
});

function normalizeCounts(data) {
  const counts = data?.counts || {};
  return {
    pass: Number(counts.passed || 0),
    fail: Number(counts.failed || 0),
    skipped: Number(counts.skipped || 0),
    todo: Number(counts.todo || 0),
    cancelled: Number(counts.cancelled || 0),
    total: Number(counts.tests || 0)
  };
}

function frameLength(length) {
  const frame = Buffer.allocUnsafe(8);
  frame.writeBigUInt64BE(BigInt(length));
  return frame;
}

export default async function* nodeTestEvidenceReporter(source) {
  const eventHash = createHash('sha256');
  let outputBytes = 0;
  let outputLimitExceeded = false;
  let summaryCount = 0;
  let counts = { ...EMPTY_COUNTS };

  for await (const event of source) {
    const serialized = serialize(event);
    outputBytes += 8 + serialized.length;
    eventHash.update(frameLength(serialized.length));
    eventHash.update(serialized);
    if (outputBytes > MAX_EVENT_STREAM_BYTES) outputLimitExceeded = true;

    if (event.type === 'test:summary' && event.data?.file === undefined) {
      summaryCount += 1;
      counts = normalizeCounts(event.data);
    }
  }

  const result = {
    schemaVersion: REPORTER_SCHEMA_VERSION,
    summaryCount,
    counts,
    completed: summaryCount === 1 && !outputLimitExceeded,
    eventStreamSha256: eventHash.digest('hex'),
    outputBytes,
    outputLimitExceeded
  };
  yield `${SUITE_RESULT_MARKER}${JSON.stringify(result)}\n`;
}
