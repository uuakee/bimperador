const { Router } = require('express');
const MatchController = require('../controllers/match.controller');
const isAdmin = require('../middlewares/isadmin.middleware');

const router = Router();


// Rotas públicas
router.get('/list', MatchController.index);
router.get('/list/:id', MatchController.show);

// Rotas protegidas (apenas admin)
router.post('/create', isAdmin, MatchController.create);
router.put('/update/:id', isAdmin, MatchController.update);
router.delete('/delete/:id', isAdmin, MatchController.delete);
router.put('/update-score/:id', isAdmin, MatchController.updateScore);

module.exports = router;


