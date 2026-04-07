const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes     = require('./routes/auth.routes');
const quizRoutes     = require('./routes/quiz.routes');
const questionRoutes = require('./routes/question.routes');
const profileRoutes  = require('./routes/profile.routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

// Core middleware 
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth',      authRoutes);
app.use('/api/quizzes',   quizRoutes);
app.use('/api/quizzes',   questionRoutes); // Questions are nested under quizzes: /api/quizzes/:quizId/questions
app.use('/api/profile',   profileRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;