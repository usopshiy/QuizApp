const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getOrganizerSessions,
  getParticipantSessions,
  getSessionResults,
} = require('../controllers/profile.controller');

// All profile routes require a valid JWT
router.use(authenticate);

// GET /api/profile/me/sessions        — organizer: quiz session history
router.get('/me/sessions', getOrganizerSessions);

// GET /api/profile/me/participations  — participant: sessions they joined as a user
router.get('/me/participations', getParticipantSessions);

// GET /api/profile/sessions/:sessionId/results  — full results for one session
// (also accessible via quiz routes but handy here for the cabinet detail view)
router.get('/sessions/:sessionId/results', getSessionResults);

module.exports = router;