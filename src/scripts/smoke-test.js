/* Smoke test for API -> SQS -> Lambda -> DynamoDB (parallel + latency stats) */
const { Logger } = require('@aws-lambda-powertools/logger');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { TASK_STATUSES } = require('../configs/constants');

const TASKS_ENDPOINT = process.env.TASKS_ENDPOINT;
const BASE = (process.env.API_URL || '').replace(/\/$/, '');
const TASKS_URL = TASKS_ENDPOINT || `${BASE}/tasks`;
const TASKS_TABLE = process.env.TASKS_TABLE;
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1';

const TASK_COUNT = parseInt(process.env.SMOKE_TASK_COUNT || '10', 10);
const POLL_TIMEOUT_MS = parseInt(process.env.SMOKE_TIMEOUT_MS || '20000', 10);
const POLL_INTERVAL_MS = parseInt(process.env.SMOKE_INTERVAL_MS || '2000', 10);

const logger = new Logger({ serviceName: 'smoke' });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function percentile(arr, p) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.ceil((p / 100) * a.length) - 1;
  return a[Math.max(0, idx)];
}
function stats(arr) {
  if (!arr.length) return { count: 0 };
  const sum = arr.reduce((s, x) => s + x, 0);
  return {
    count: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: Math.round(sum / arr.length),
    p50: percentile(arr, 50),
    p90: percentile(arr, 90),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99)
  };
}

(async () => {
  logger.appendKeys({ REGION, TASK_COUNT, POLL_TIMEOUT_MS, POLL_INTERVAL_MS });

  if (!TASKS_URL || !TASKS_TABLE) {
    logger.error('Missing required env', { TASKS_URL: !!TASKS_URL, TASKS_TABLE: !!TASKS_TABLE });
    process.exit(1);
  }

  try {
    // Prepare tasks
    const base = `smoke-${Date.now()}`;
    const tasks = Array.from({ length: TASK_COUNT }, (_, i) => ({
      taskId: `${base}-${i + 1}`,
      correlationId: `corr-${base}-${i + 1}`,
      submitAt: 0,
      doneAt: null
    }));

    logger.info('Submitting tasks', { count: tasks.length });

    const submitStart = Date.now();
    const submitResults = await Promise.allSettled(
      tasks.map(async (t) => {
        t.submitAt = Date.now();
        const resp = await fetch(TASKS_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-correlation-id': t.correlationId
          },
          body: JSON.stringify({ taskId: t.taskId, payload: { smoke: true, ix: t.taskId } })
        });
        if (resp.status !== 202) {
          const text = await resp.text().catch(() => '');
          throw new Error(`API ${resp.status}: ${text}`);
        }
      })
    );
    const submitEnd = Date.now();

    const failedSubmits = submitResults.filter((r) => r.status === 'rejected');
    if (failedSubmits.length) {
      logger.error('Some POSTs failed', {
        errorsCount: failedSubmits.length,
        sample: failedSubmits.slice(0, 3).map((r) => r.reason?.message || String(r.reason))
      });
      process.exit(1);
    }
    logger.info('All tasks submitted', { ms: submitEnd - submitStart });

    // Poll DynamoDB for completion
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let firstDoneMs = null;

    while (Date.now() < deadline) {
      let progressed = false;

      // simple sequential poll (good enough for <= 50 items); parallelize if needed
      for (const t of tasks) {
        if (t.doneAt) continue;

        const res = await ddb.send(
          new GetCommand({ TableName: TASKS_TABLE, Key: { taskId: t.taskId } })
        );
        const item = res.Item || null;

        if (item?.status === TASK_STATUSES.PROCESSED) {
          t.doneAt = Date.now();
          const latency = t.doneAt - t.submitAt;
          if (firstDoneMs == null) firstDoneMs = latency;
          logger.info('Task processed', { taskId: t.taskId, latencyMs: latency });
          progressed = true;
        } else if (item) {
          logger.debug('Task in DynamoDB', { taskId: t.taskId, status: item.status });
        }
      }

      const remaining = tasks.filter((t) => !t.doneAt).length;
      if (remaining === 0) break;
      if (!progressed) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    // Build latency stats
    const latencies = tasks.filter((t) => t.doneAt).map((t) => t.doneAt - t.submitAt);
    const agg = stats(latencies);
    const allDone = latencies.length === tasks.length;
    const allLatencyMs = allDone ? Math.max(...latencies) : null;

    logger.info('Latency stats (ms)', {
      count: agg.count,
      min: agg.min,
      avg: agg.avg,
      p50: agg.p50,
      p90: agg.p90,
      p95: agg.p95,
      p99: agg.p99,
      max: agg.max,
      timeToFirstProcessedMs: firstDoneMs,
      timeToAllProcessedMs: allLatencyMs
    });

    if (!allDone) {
      const pending = tasks.filter((t) => !t.doneAt).map((t) => t.taskId);
      logger.warn('Some tasks not processed within timeout', { pending });
      process.exit(1);
    }

    logger.info('All tasks processed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Smoke test failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
