'use strict';

const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120 }));

const db = mysql.createPool({
  host: config.DB_HOST,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
});

// CORS: only origins explicitly listed in CORS_ORIGINS are allowed.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && config.CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  next();
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    req.user = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (e) {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// Parameterised query prevents SQL injection.
app.get('/user', (req, res) => {
  db.query('SELECT * FROM users WHERE name = ?', [String(req.query.name || '')], (err, rows) => {
    if (err) return res.status(500).json({ error: 'database error' });
    return res.json(rows);
  });
});

// execFile with an argument array (no shell) and a strict hostname allowlist.
const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;
app.get('/ping', (req, res) => {
  const host = String(req.query.host || '');
  if (!HOST_RE.test(host)) return res.status(400).send('invalid host');
  return execFile('ping', ['-c', '1', host], { timeout: 5000 }, (err, stdout) => res.send(stdout || ''));
});

// Files are only served from FILE_ROOT; traversal outside it is rejected.
app.get('/file', (req, res) => {
  const root = path.resolve(config.FILE_ROOT);
  const target = path.resolve(root, String(req.query.file || ''));
  if (!target.startsWith(root + path.sep)) return res.status(400).send('invalid path');
  return fs.readFile(target, 'utf8', (err, data) => {
    if (err) return res.status(404).send('not found');
    return res.type('text/plain').send(data);
  });
});

app.get('/hello', (req, res) => {
  res.send('<h1>Hello ' + escapeHtml(req.query.name || '') + '</h1>');
});

// Tiny arithmetic parser (+ - * / and parentheses) instead of eval().
function evaluate(expr) {
  const tokens = expr.match(/\d+(?:\.\d+)?|[-+*/()]/g) || [];
  if (tokens.join('') !== expr.replace(/\s+/g, '')) throw new Error('invalid expression');
  let pos = 0;
  const factor = () => {
    const t = tokens[pos++];
    if (t === '(') {
      const v = sum();
      if (tokens[pos++] !== ')') throw new Error('expected )');
      return v;
    }
    if (t === '-') return -factor();
    if (t === undefined || !/^\d/.test(t)) throw new Error('unexpected token');
    return parseFloat(t);
  };
  const product = () => {
    let v = factor();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  function sum() {
    let v = product();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const r = product();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const result = sum();
  if (pos !== tokens.length) throw new Error('trailing input');
  return result;
}

app.post('/calc', (req, res) => {
  try {
    res.send(String(evaluate(String(req.body.expression || ''))));
  } catch (e) {
    res.status(400).send('invalid expression');
  }
});

// Deep-copy untrusted JSON while dropping prototype-pollution keys.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!FORBIDDEN_KEYS.has(k)) out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

app.post('/settings', (req, res) => {
  res.json(sanitize(req.body));
});

// Data is parsed as JSON, never evaluated as code.
app.post('/restore', (req, res) => {
  try {
    res.json(sanitize(JSON.parse(String(req.body.data))));
  } catch (e) {
    res.status(400).json({ error: 'invalid data' });
  }
});

// scrypt with a per-password random salt.
app.post('/register', (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'password too short' });
  const salt = crypto.randomBytes(16);
  return crypto.scrypt(password, salt, 64, (err, key) => {
    if (err) return res.status(500).json({ error: 'hash failed' });
    return res.json({ hash: `${salt.toString('hex')}:${key.toString('hex')}` });
  });
});

app.get('/token', (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  const signed = jwt.sign({ user: 'guest' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
  res.json({ token, jwt: signed });
});

app.get('/admin', requireAuth, (req, res) => {
  res.json({ user: req.user.user });
});

// Only same-site relative redirects are allowed.
app.get('/redirect', (req, res) => {
  const url = String(req.query.url || '/');
  if (!/^\/(?![/\\])/.test(url)) return res.status(400).send('invalid redirect target');
  return res.redirect(url);
});

app.listen(config.PORT);
