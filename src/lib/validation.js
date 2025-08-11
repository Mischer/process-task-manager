const { limits } = require('../configs/config');
const { httpError } = require('./utils');

function validateInput({ taskId, payload, logger }) {
  if (!taskId || typeof taskId !== 'string' || taskId.length > limits.maxTaskIdLength) {
    logger?.warn?.('validation_failed', {
      reason: 'taskId',
      maxTaskIdLength: limits.maxTaskIdLength
    });
    throw httpError(400, 'Invalid taskId');
  }

  const isObject = payload !== null && typeof payload === 'object';
  const size = Buffer.byteLength(JSON.stringify(isObject ? payload : ''), 'utf8');
  if (!isObject || size > limits.maxPayloadSizeBytes) {
    logger?.warn?.('validation_failed', {
      reason: 'payload',
      size,
      maxBytes: limits.maxPayloadSizeBytes
    });
    throw httpError(400, 'Invalid payload');
  }
}
module.exports = { validateInput };
