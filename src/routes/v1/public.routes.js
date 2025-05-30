const { Router } = require('express');
const TeamController = require('../../controllers/TeamController');
const MatchController = require('../../controllers/MatchController');

const router = Router();

// Rotas públicas de Times
router.get('/teams', TeamController.list);
router.get('/teams/:id', TeamController.getById);

// Rotas públicas de Partidas
router.get('/matches', MatchController.list);
router.get('/matches/:id', MatchController.getById);

module.exports = router; 