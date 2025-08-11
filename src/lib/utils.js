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
 * Strict JSON parser: throws 400 if body is not valid JSON.
 * Good for API handlers where JSON is required.
 */
function parseJsonStrict(body) {
  if (body === null) return {};
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(body);
  } catch {
    throw httpError(400, 'Invalid JSON body');
  }
}

/**
 * Lenient JSON parser: returns null when not a valid JSON.
 * Good for DLQ/forensics where body may be arbitrary text.
 */
function parseJsonSafe(body) {
  if (body === null) return null;
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * Build a standard JSON HTTP response.
 */
function respond(statusCode, body, correlationId, headers = {}) {
  return {
    statusCode,
    headers: {
      ...headers,
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  getCorrelationId,
  parseJsonStrict,
  parseJsonSafe,
  respond,
  httpError,
  statusOf,
  sleep
};
