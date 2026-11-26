'use strict';

// AI that is configured but NOT used: nothing imports this file or calls the model.
const OpenAI = require('openai');

const MODEL = 'gpt-4o-mini';

// The client would read OPENAI_API_KEY from the environment.
function createClient(options) {
  return new OpenAI(options);
}

module.exports = { createClient, MODEL };
//This for testing