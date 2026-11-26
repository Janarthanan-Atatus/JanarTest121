'use strict';

// The AI module is mocked, so no request is sent to the model.
jest.mock('./ai', () => ({ ask: jest.fn().mockResolvedValue('Hello!') }));

Object.assign(process.env, { JWT_SECRET: 'test-only', DB_USER: 'test', DB_PASSWORD: 'test' });

const jwt = require('jsonwebtoken');
const app = require('./app');
const { ask } = require('./ai');

let server;
let url;
beforeAll((done) => {
  server = app.listen(0, '127.0.0.1', () => {
    url = `http://127.0.0.1:${server.address().port}/ask`;
    done();
  });
});
afterAll((done) => {
  server.close(done);
});

function post(headers) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ prompt: 'Hi' }),
  });
}

test('POST /ask rejects a request without a token', async () => {
  expect((await post({})).status).toBe(401);
  expect(ask).not.toHaveBeenCalled();
});

test('POST /ask returns the AI answer', async () => {
  const token = jwt.sign({ user: 'guest' }, 'test-only');
  const res = await post({ Authorization: `Bearer ${token}` });

  await expect(res.json()).resolves.toEqual({ answer: 'Hello!' });
  expect(ask).toHaveBeenCalledWith('Hi');
});
