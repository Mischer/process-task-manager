const { Logger } = require('@aws-lambda-powertools/logger');
const { parseJsonSafe } = require('./lib/utils');
const { limits } = require('./configs/config');

const logger = new Logger();

exports.handler = async (event, context) => {
  logger.appendKeys({ function: context.functionName, awsRequestId: context.awsRequestId });

  for (const record of event.Records ?? []) {
    const body = parseJsonSafe(record.body) ?? record.body;

    const taskId =
      record.messageAttributes?.taskId?.stringValue ||
      (typeof body === 'object' && body?.taskId) ||
      'unknown';

    const correlationId =
      record.messageAttributes?.correlationId?.stringValue ||
      (typeof body === 'object' && body?.correlationId) ||
      record.messageId;

    const receiveCount = Number(record.attributes?.ApproximateReceiveCount || '1');

    logger.appendKeys({
      correlationId,
      taskId,
      messageId: record.messageId,
      receiveCount
    });

    logger.error('DLQ message received', {
      bodyPreview: previewBody(body, limits.maxLogBodyBytes),
      sentTimestamp: record.attributes?.SentTimestamp
    });
  }
};

function previewBody(body, maxBytes) {
  const str = typeof body === 'object' ? JSON.stringify(body) : String(body ?? '');
  if (str.length <= maxBytes) {
    return str;
  }

  return str.slice(0, maxBytes) + '...';
}
