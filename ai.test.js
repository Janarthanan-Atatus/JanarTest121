'use strict';

const { ask, MODEL } = require('./ai');

// A stand-in client, so the tests need no API key or network access.
function fakeClient(response) {
  return { beta: { messages: { create: jest.fn().mockResolvedValue(response) } } };
}

test('returns the text of the reply', async () => {
  const client = fakeClient({
    stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Hello!' }],
  });

  await expect(ask('Hi', client)).resolves.toBe('Hello!');
  expect(client.beta.messages.create).toHaveBeenCalledWith(
    expect.objectContaining({ model: MODEL, messages: [{ role: 'user', content: 'Hi' }] }),
  );
});

test('throws when the model declines', async () => {
  const client = fakeClient({ stop_reason: 'refusal', content: [] });

  await expect(ask('Hi', client)).rejects.toThrow('declined');
});
