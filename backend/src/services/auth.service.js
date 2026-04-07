const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const db        = require('../config/db');

const SALT_ROUNDS = 10;
const JWT_SECRET  = process.env.JWT_SECRET  || 'change_this_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

async function register({ email, displayName, password }) {
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const err = new Error('Email already in use');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await db.query(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, role, created_at`,
    [email.toLowerCase().trim(), displayName.trim(), passwordHash]
  );

  const user = rows[0];
  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const { rows } = await db.query(
    'SELECT id, email, display_name, role, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (rows.length === 0) {
    throwUnauthorized();
  }

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throwUnauthorized();

  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token: signToken(safeUser) };
}

async function getUserById(id) {
  const { rows } = await db.query(
    'SELECT id, email, display_name, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

// Helpers

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function throwUnauthorized() {
  const err = new Error('Invalid email or password');
  err.statusCode = 401;
  throw err;
}

module.exports = { register, login, getUserById };