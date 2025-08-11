'use strict';

/**
 * Extract correlation id from headers / request context / AWS context.
 */
function getCorrelationId(event, context) {
    return (
        event?.headers?.['x-correlation-id'] ||
        event?.headers?.['X-Correlation-Id'] ||
        event?.requestContext?.requestId ||
        context?.awsRequestId
    );
}

/**
 * Safe JSON parser for API Gateway/Lambda events.
 */
function parseJson(body) {
    if (body == null) return {};
    if (typeof body === 'object') return body;
    try {
        return JSON.parse(body);
    } catch {
        throw httpError(400, 'Invalid JSON body');
    }
}

/**
 * Build a standard JSON HTTP response.
 */
function respond(statusCode, body, correlationId) {
    return {
        statusCode,
        headers: {
            'content-type': 'application/json',
            'x-correlation-id': correlationId
        },
        body: JSON.stringify(body)
    };
}

/**
 * Create an error that carries an HTTP status code.
 */
function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

/**
 * Map thrown error to HTTP status.
 */
function statusOf(err) {
    const code = Number(err?.statusCode);
    if (code === 202) return 202;
    if (code >= 400 && code < 500) return code;
    return 500;
}

module.exports = {
    getCorrelationId,
    parseJson,
    respond,
    httpError,
    statusOf
};