const { Logger } = require('@aws-lambda-powertools/logger');
const { getCorrelationId, parseJsonStrict, respond, statusOf } = require('./lib/utils');
const { validateInput } = require('./lib/validation');
const { putTaskIfAbsent } = require('./repository/dynamo-db');
const { enqueueTask } = require('./messaging/sqs');
const { TASK_STATUSES } = require('./configs/constants');

const logger = new Logger();

exports.handler = async (event, context) => {
  const correlationId = getCorrelationId(event, context);
  logger.appendKeys({
    function: context.functionName,
    awsRequestId: context.awsRequestId,
    correlationId
  });

  try {
    logger.debug('Parsing request body');
    const { taskId, payload } = parseJsonStrict(event?.body);

    logger.debug('Validating input');
    validateInput({ taskId, payload });

    const now = new Date().toISOString();
    const { created } = await putTaskIfAbsent({
      taskId,
      status: TASK_STATUSES.RECEIVED,
      createdAt: now,
      lastUpdatedAt: now
    });

    if (!created) {
      logger.info('Task already exists (idempotent accept)', { taskId });
      return respond(202, { message: 'Accepted', taskId, correlationId }, correlationId);
    }

    logger.debug('Enqueuing task to SQS');
    await enqueueTask({ taskId, payload, correlationId });

    logger.info('Task accepted and enqueued', { taskId });
    return respond(202, { message: 'Accepted', taskId, correlationId }, correlationId, {
      location: `/tasks/${taskId}`
    });
  } catch (err) {
    const status = statusOf(err);
    if (status >= 500) {
      logger.error('Submit failed with 5xx', { error: err.message, stack: err.stack });
      return respond(500, { message: 'Internal Server Error', correlationId }, correlationId);
    } else {
      logger.warn('Submit rejected with 4xx', { status, reason: err.message });
      return respond(status, { message: err.message, correlationId }, correlationId);
    }
  }
};
