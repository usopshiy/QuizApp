const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'quiz_user',
  password: process.env.DB_PASSWORD || 'quiz_password',
  database: process.env.DB_NAME || 'quiz_db',
});

// Проверка подключения при старте
pool.on('connect', () => {
  console.log('✅ Успешное подключение к PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка пула PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};