const { Router } = require('express');
const TeamController = require('../../controllers/TeamController');
const MatchController = require('../../controllers/MatchController');
const { isAuthenticated, isAdmin } = require('../../middlewares/auth');

const router = Router();

// Middleware para todas as rotas administrativas
router.use(isAuthenticated, isAdmin);

// Rotas de Times
router.post('/teams', TeamController.create);
router.put('/teams/:id', TeamController.update);
router.delete('/teams/:id', TeamController.delete);
router.get('/teams', TeamController.list);
router.get('/teams/:id', TeamController.getById);

// Rotas de Partidas
router.post('/matches', MatchController.create);
router.put('/matches/:id/result', MatchController.updateResult);
router.put('/matches/:id/status', MatchController.updateStatus);
router.get('/matches', MatchController.list);
router.get('/matches/:id', MatchController.getById);

module.exports = router; 