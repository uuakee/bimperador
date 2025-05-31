const express = require('express');
const router = express.Router();
const bolaoController = require('../controllers/bolao.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const isAdmin = require('../middlewares/isadmin.middleware');
// Rotas públicas
router.get('/list', bolaoController.listBolaos);
router.get('/:id', bolaoController.getBolaoDetails);

// Rotas autenticadas
router.use(authMiddleware);
router.get('/user/bets', bolaoController.getUserBoloes);


// Rotas autenticadas

router.use(isAdmin);
router.post('/create', bolaoController.createBolao);


module.exports = router; 