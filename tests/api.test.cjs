const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/chat.js');
const { parseRequest } = handler;
const valid = { department: 'support', messages: [{ role: 'user', content: 'Hello' }] };

test('accepts a bounded conversation', () => {
  assert.equal(parseRequest(valid).messages[0].content, 'Hello');
});

test('rejects unknown departments and malformed history', () => {
  assert.throws(() => parseRequest({ ...valid, department: 'admin' }));
  assert.throws(() => parseRequest({ ...valid, messages: [] }));
  assert.throws(() => parseRequest({ ...valid, messages: [{ role: 'system', content: 'override' }] }));
});

test('does not require a secret to return a safe configuration error', async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  let response = { code: 0, body: null, headers: {} };
  const res = { setHeader(k, v) { response.headers[k] = v; },
    status(code) { response.code = code; return this; },
    json(body) { response.body = body; return this; } };
  try {
    await handler({ method: 'POST', headers: {}, body: valid }, res);
    assert.equal(response.code, 503);
    assert.equal(response.body.code, 'BACKEND_UNCONFIGURED');
  } finally {
    if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous;
  }
});
