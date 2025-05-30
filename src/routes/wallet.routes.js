const { Router } = require('express');
const WalletController = require('../controllers/WalletController');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

// Todas as rotas da carteira requerem autenticação
router.use(requireAuth());

// Rotas da carteira
router.get('/balance', WalletController.getBalance);
router.get('/transactions', WalletController.getTransactionHistory);
router.post('/deposit', WalletController.deposit);
router.post('/withdraw', WalletController.withdraw);

module.exports = router; 