// Extract a user-friendly message + detailed debug info from axios errors
export function extractError(e, fallback = 'Operation failed') {
  const resp = e?.response;
  const status = resp?.status;
  const data = resp?.data;

  let message = fallback;
  let detail = '';

  // Kill Bill returns message in various formats
  if (data?.message) {
    message = data.message;
  } else if (typeof data === 'string' && data.length < 200) {
    message = data;
  }

  // Build detailed info for debugging
  const parts = [];
  if (status) parts.push(`HTTP ${status}`);
  if (resp?.config?.method) parts.push(resp.config.method.toUpperCase());
  if (resp?.config?.url) parts.push(resp.config.url);
  if (data?.message) parts.push(`\nMessage: ${data.message}`);
  if (data?.stackTrace) {
    // Kill Bill includes Java stack traces
    const trace = typeof data.stackTrace === 'string'
      ? data.stackTrace
      : JSON.stringify(data.stackTrace, null, 2);
    parts.push(`\nStack: ${trace.slice(0, 500)}`);
  }
  if (data?.cause) parts.push(`\nCause: ${data.cause}`);
  if (data && typeof data === 'object' && !data.message) {
    parts.push(`\nResponse: ${JSON.stringify(data, null, 2).slice(0, 500)}`);
  }
  if (e?.message && !resp) {
    parts.push(`Error: ${e.message}`);
  }

  detail = parts.join('\n');

  return { message, detail };
}
