const WalletService = require('../services/WalletService');
const { historyFilterSchema, financialOperationSchema } = require('../validators/walletValidators');

class WalletController {
  async getBalance(req, res) {
    try {
      const userId = req.user.id;
      const balance = await WalletService.getBalance(userId);
      return res.json(balance);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async getTransactionHistory(req, res) {
    try {
      const userId = req.user.id;
      
      // Validação dos filtros
      const filters = historyFilterSchema.parse(req.query);
      
      const history = await WalletService.getTransactionHistory(userId, filters);
      return res.json(history);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Filtros inválidos',
          details: error.errors.map(err => ({
            campo: err.path.join('.'),
            mensagem: err.message
          }))
        });
      }

      return res.status(400).json({
        error: error.message
      });
    }
  }

  async deposit(req, res) {
    try {
      const userId = req.user.id;
      
      // Validação do corpo da requisição
      const { amount, description } = financialOperationSchema.parse(req.body);
      
      const result = await WalletService.deposit(userId, amount, description);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors.map(err => ({
            campo: err.path.join('.'),
            mensagem: err.message
          }))
        });
      }

      return res.status(400).json({
        error: error.message
      });
    }
  }

  async withdraw(req, res) {
    try {
      const userId = req.user.id;
      
      // Validação do corpo da requisição
      const { amount, description } = financialOperationSchema.parse(req.body);
      
      const result = await WalletService.withdraw(userId, amount, description);
      return res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors.map(err => ({
            campo: err.path.join('.'),
            mensagem: err.message
          }))
        });
      }

      return res.status(400).json({
        error: error.message
      });
    }
  }
}

module.exports = new WalletController(); 