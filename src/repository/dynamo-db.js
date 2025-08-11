const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const { resources } = require('../configs/config');

/**
 * Insert task if not exists (idempotent create).
 *
 * @param {Object} task - full item to put (must include taskId)
 * @param {Object} [opts]
 * @param {string} [opts.keyName='taskId'] - partition key name
 * @returns {Promise<{created:boolean}>}
 */
async function putTaskIfAbsent(task, opts = {}) {
  const keyName = opts.keyName || 'taskId';
  if (!task || typeof task !== 'object' || !task[keyName]) {
    throw new Error('putTaskIfAbsent: invalid task or missing key');
  }

  await dynamoDb
    .send(
      new PutCommand({
        TableName: resources.tasksTable,
        Item: task,
        ConditionExpression: `attribute_not_exists(#k)`,
        ExpressionAttributeNames: { '#k': keyName }
      })
    )
    .catch((err) => {
      if (err?.name === 'ConditionalCheckFailedException') {
        return { created: false };
      }
      throw err;
    });

  return { created: true };
}

async function getTask(taskId) {
  const res = await dynamoDb.send(
    new GetCommand({
      TableName: resources.tasksTable,
      Key: { taskId }
    })
  );
  return res.Item;
}

async function updateTaskStatus(taskId, status) {
  await dynamoDb.send(
    new UpdateCommand({
      TableName: resources.tasksTable,
      Key: { taskId },
      UpdateExpression: 'SET #s = :s, lastUpdatedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':t': new Date().toISOString() }
    })
  );
}

async function markTaskProcessed(taskId) {
  await dynamoDb.send(
    new UpdateCommand({
      TableName: resources.tasksTable,
      Key: { taskId },
      UpdateExpression: 'SET #s = :s, processedAt = :t, lastUpdatedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': 'PROCESSED', ':t': new Date().toISOString() }
    })
  );
}

module.exports = { putTaskIfAbsent, getTask, updateTaskStatus, markTaskProcessed };
