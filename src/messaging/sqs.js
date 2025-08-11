const {
  SQSClient,
  SendMessageCommand,
  ChangeMessageVisibilityCommand
} = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({});
const { resources } = require('../configs/config');

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
