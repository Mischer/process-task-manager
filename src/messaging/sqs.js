const {
  SQSClient,
  SendMessageCommand,
  ChangeMessageVisibilityCommand
} = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({});
const { resources } = require('../configs/config');

/**
 * Send a task message to the processing SQS queue.
 *
 * @param {Object} params
 * @param {string} params.taskId - Unique task identifier.
 * @param {Object} params.payload - Task payload object.
 * @param {string} params.correlationId - Correlation ID for tracing across services.
 * @returns {Promise<void>}
 */
async function enqueueTask({ taskId, payload, correlationId }) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: resources.queueUrl,
      MessageBody: JSON.stringify({ taskId, payload, correlationId }),
      MessageAttributes: {
        taskId: { DataType: 'String', StringValue: taskId },
        correlationId: { DataType: 'String', StringValue: correlationId }
      }
    })
  );
}

/**
 * Change the visibility timeout for a specific SQS message.
 *
 * @param {Object} params
 * @param {string} params.receiptHandle - The receipt handle of the SQS message.
 * @param {number} params.delaySeconds - New visibility timeout in seconds.
 * @returns {Promise<void>}
 */
async function changeVisibility({ receiptHandle, delaySeconds }) {
  await sqs.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: resources.queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: delaySeconds
    })
  );
}

module.exports = { enqueueTask, changeVisibility };
