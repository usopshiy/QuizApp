const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Настройка CORS (чтобы Angular мог достучаться)
app.use(cors());
app.use(express.json());

// Инициализация Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // В проде замените на конкретный домен
    methods: ["GET", "POST"]
  }
});

// Тестовый маршрут
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running!' });
});

// Простейшее подключение сокетов
io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Пользователь отключился: ${socket.id}`);
  });
});

const db = require('./config/db');

// Получить все активные квизы
app.get('/api/quizzes', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM quizzes WHERE status = $1', ['active']);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});