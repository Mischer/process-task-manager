const { Logger } = require('@aws-lambda-powertools/logger');
const { parseJsonStrict, sleep } = require('./lib/utils');
const { limits } = require('./configs/config');
const { getTask, updateTaskStatus } = require('./repository/dynamo-db');
const { changeVisibility } = require('./messaging/sqs');
const { TASK_STATUSES } = require('./configs/constants');

const logger = new Logger();

exports.handler = async (event, context) => {
  logger.appendKeys({ function: context.functionName, awsRequestId: context.awsRequestId });

  for (const record of event.Records ?? []) {
    const body = parseJsonStrict(record.body);

    const taskId = body.taskId || record.messageAttributes?.taskId?.stringValue;
    const correlationId =
      body.correlationId ||
      record.messageAttributes?.correlationId?.stringValue ||
      record.messageId;

    const receiveCount = Number(record.attributes?.ApproximateReceiveCount || '1');

    logger.appendKeys({ correlationId, taskId, messageId: record.messageId, receiveCount });

    try {
      if (!taskId) {
        throw new Error('missing_taskId');
      }

      const existing = await getTask(taskId);
      if (existing?.status === TASK_STATUSES.PROCESSED) {
        logger.debug('Task already processed, skipping');
        continue;
      }

      logger.debug('Marking task as PROCESSING in DynamoDB');
      await updateTaskStatus(taskId, TASK_STATUSES.PROCESSING);

      logger.debug('Simulating work for task');
      await sleep(100 + Math.floor(Math.random() * 200));

      if (Math.random() < 0.3) {
        throw new Error('simulated_failure');
      }

      logger.debug('Marking task as PROCESSED in DynamoDB');
      await updateTaskStatus(taskId, TASK_STATUSES.PROCESSED);

      logger.info('Task processed successfully', { taskId });
    } catch (err) {
      const delay = Math.min(
        limits.maxBackoffSeconds,
        Math.pow(2, receiveCount) * limits.baseBackoffSeconds
      );

      logger.warn('Task processing failed — applying backoff', {
        error: err.message,
        delaySeconds: delay
      });

      try {
        logger.debug('Changing SQS message visibility');
        await changeVisibility({
          receiptHandle: record.receiptHandle,
          delaySeconds: delay
        });
      } catch (error) {
        logger.error('Failed to change message visibility', { error: error.message });
      }

      throw err;
    }
  }
};
