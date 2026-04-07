const router  = require('express').Router();
const multer  = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} = require('../controllers/question.controller');

// Store upload in memory so we can stream to MinIO
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// All routes require auth
router.use(authenticate);

// POST   /api/quizzes/:quizId/questions          — create (optional image)
router.post(
  '/:quizId/questions',
  upload.single('image'),
  createQuestion
);

// PATCH  /api/quizzes/:quizId/questions/:questionId — update (optional image)
router.patch(
  '/:quizId/questions/:questionId',
  upload.single('image'),
  updateQuestion
);

// DELETE /api/quizzes/:quizId/questions/:questionId
router.delete('/:quizId/questions/:questionId', deleteQuestion);

// PUT    /api/quizzes/:quizId/questions/reorder   — drag-and-drop reorder
router.put('/:quizId/questions/reorder', reorderQuestions);

module.exports = router;