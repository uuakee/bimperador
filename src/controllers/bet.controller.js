const betService = require('../services/bet.service');
const { z } = require('zod');

// Schema de validação para apostas
const betChoicesSchema = z.object({
  // Winner
  winner: z.string().uuid().optional(),
  
  // Exact Score
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional()
});

const betSchema = z.object({
  bolaoId: z.string().uuid(),
  bets: z.array(z.object({
    matchId: z.string().uuid(),
    betChoices: betChoicesSchema
  })).min(1)
});

class BetController {
  async placeBet(req, res) {
    try {
      const userId = req.user.id;
      const validatedData = betSchema.parse(req.body);

      const result = await betService.placeBet(userId, validatedData);

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors
        });
      }

      console.error('Erro ao realizar apostas:', error);
      res.status(error.status || 500).json({ error: error.message });
    }
  }

  async getUserBets(req, res) {
    try {
      const userId = req.user.id;
      const bets = await betService.getUserBets(userId);

      res.json(bets);
    } catch (error) {
      console.error('Erro ao buscar apostas do usuário:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getBetDetails(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const bet = await betService.getBetDetails(id, userId);

      if (!bet) {
        return res.status(404).json({ error: 'Aposta não encontrada' });
      }

      res.json(bet);
    } catch (error) {
      console.error('Erro ao buscar detalhes da aposta:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BetController(); 