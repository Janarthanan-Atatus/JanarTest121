'use strict';

// All configuration comes from the environment. Nothing secret is stored in source.
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  JWT_SECRET: required('JWT_SECRET'),
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: required('DB_USER'),
  DB_PASSWORD: required('DB_PASSWORD'),
  DB_NAME: process.env.DB_NAME || 'appdb',
  FILE_ROOT: process.env.FILE_ROOT || '/app/public',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
};
