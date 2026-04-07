const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  startSession,
  getSession,
  getLeaderboard,
} = require('../controllers/quiz.controller');

// All quiz routes require authentication
router.use(authenticate);

// Quiz CRUD
router.get('/',    listQuizzes);
router.post('/',   createQuiz);
router.get('/:id', getQuiz);
router.patch('/:id', updateQuiz);
router.delete('/:id', deleteQuiz);

// Session management
router.post('/:id/sessions',                          startSession);
router.get('/:id/sessions/:sessionId',                getSession);
router.get('/:id/sessions/:sessionId/leaderboard',    getLeaderboard);

module.exports = router;