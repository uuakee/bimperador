const { Router } = require('express');
const BolaoController = require('../../controllers/BolaoController');
const BetController = require('../../controllers/BetController');
const { isAuthenticated, isAdmin } = require('../../middlewares/auth');

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(isAuthenticated);

// Rotas públicas de Bolões
router.get('/bolaos', BolaoController.list);
router.get('/bolaos/my', BolaoController.listMyBolaos);
router.get('/bolaos/:id', BolaoController.getById);
router.post('/bolaos/:id/join', BolaoController.join);

// Rotas administrativas de Bolões
router.post('/bolaos', isAdmin, BolaoController.create);
router.put('/bolaos/:id/status', isAdmin, BolaoController.updateStatus);
router.post('/bolaos/:id/matches', isAdmin, BolaoController.addMatches);

// Rotas de Apostas
router.post('/bets', BetController.create);
router.get('/bets/my', BetController.listMyBets);
router.get('/bets/:id', BetController.getById);
router.post('/bets/:id/cancel', BetController.cancel);

// Rotas administrativas de Apostas
router.get('/bolaos/:bolaoId/bets', isAdmin, BetController.listByBolao);

module.exports = router; 