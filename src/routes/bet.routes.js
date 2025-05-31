const express = require('express');
const router = express.Router();
const betController = require('../controllers/bet.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Todas as rotas de apostas requerem autenticação
router.use(authMiddleware);

// Rotas de apostas
router.post('/', betController.placeBet);
router.get('/user', betController.getUserBets);
router.get('/:id', betController.getBetDetails);

module.exports = router; 