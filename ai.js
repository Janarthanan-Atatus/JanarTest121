'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-5-5';

// The client reads ANTHROPIC_API_KEY from the environment.
async function ask(prompt, client = new Anthropic()) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // If a safety check declines the request, the API retries it on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined the request');
  }
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

module.exports = { ask, MODEL };

if (require.main === module) {
  ask(process.argv.slice(2).join(' ') || 'Say hello in one sentence.')
    .then(console.log)
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}
