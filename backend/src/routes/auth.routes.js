const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const { register, login, me } = require('../controllers/auth.controller');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, me);

module.exports = router;