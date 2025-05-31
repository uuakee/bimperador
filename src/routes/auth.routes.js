const { Router } = require('express');
const AuthController = require('../controllers/auth.controller');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

router.post('/login', AuthController.login);
router.post('/register', AuthController.register);

router.get('/validate', requireAuth(), AuthController.validateToken);
router.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

module.exports = router; 