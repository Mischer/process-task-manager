'use strict';

module.exports = {
  limits: {
    maxTaskIdLength: parseInt(process.env.MAX_TASK_ID_LENGTH, 10) || 128,
    maxPayloadSizeBytes: parseInt(process.env.MAX_PAYLOAD_SIZE_BYTES, 10) || 50 * 1024,
    baseBackoffSeconds: parseInt(process.env.BASE_BACKOFF_SECONDS, 10) || 5,
    maxBackoffSeconds: parseInt(process.env.MAX_BACKOFF_SECONDS, 10) || 900,
    maxLogBodyBytes: parseInt(process.env.MAX_LOG_BODY_BYTES, 10) || 4000
  },
  resources: {
    tasksTable: process.env.TASKS_TABLE,
    queueUrl: process.env.QUEUE_URL
  }
};
