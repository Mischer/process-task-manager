'use strict';

module.exports = {
    limits: {
        maxTaskIdLength: parseInt(process.env.MAX_TASK_ID_LENGTH, 10) || 128,
        maxPayloadSizeBytes: parseInt(process.env.MAX_PAYLOAD_SIZE_BYTES, 10) || (50 * 1024)
    }
};