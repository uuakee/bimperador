const { Router } = require('express');
const TeamController = require('../controllers/team.controller');
const isAdmin = require('../middlewares/isadmin.middleware');

const router = Router();

// Rotas públicas
router.get('/list', TeamController.index);
router.get('/list/:id', TeamController.show);

// Rotas protegidas (apenas admin)
router.post('/create', isAdmin, TeamController.create);
router.put('/update/:id', isAdmin, TeamController.update);
router.delete('/delete/:id', isAdmin, TeamController.delete);

module.exports = router; 