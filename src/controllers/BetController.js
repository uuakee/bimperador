const { z } = require('zod');
const database = require('../config/database');
const BetService = require('../services/BetService');

class BetController {
  constructor() {
    this.prisma = database.getInstance();
    this.betService = new BetService();
  }

  // Criar uma nova aposta
  async create(req, res) {
    try {
      const schema = z.object({
        bolaoMatchId: z.string().uuid('ID da partida do bolão inválido'),
        homeScore: z.number().int('Placar deve ser um número inteiro').min(0, 'Placar não pode ser negativo'),
        awayScore: z.number().int('Placar deve ser um número inteiro').min(0, 'Placar não pode ser negativo')
      });

      const data = schema.parse(req.body);
      const userId = req.user.id;

      const bet = await this.betService.create({
        ...data,
        userId
      });

      return res.status(201).json(bet);
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

  // Listar minhas apostas
  async listMyBets(req, res) {
    try {
      const schema = z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
        status: z.enum(['PENDING', 'WON', 'LOST', 'CANCELLED', 'REFUNDED']).optional(),
        bolaoId: z.string().uuid('ID do bolão inválido').optional()
      });

      const filters = schema.parse(req.query);
      const bets = await this.betService.listByUser(req.user.id, filters);

      return res.json(bets);
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

  // Buscar aposta por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const bet = await this.betService.getById(id, userId);

      if (!bet) {
        return res.status(404).json({
          error: 'Aposta não encontrada'
        });
      }

      return res.json(bet);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Cancelar aposta (antes da partida começar)
  async cancel(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const bet = await this.betService.cancel(id, userId);

      return res.json(bet);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Listar apostas de um bolão (admin)
  async listByBolao(req, res) {
    try {
      const { bolaoId } = req.params;
      const schema = z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
        status: z.enum(['PENDING', 'WON', 'LOST', 'CANCELLED', 'REFUNDED']).optional(),
        matchId: z.string().uuid('ID da partida inválido').optional()
      });

      const filters = schema.parse(req.query);
      const bets = await this.betService.listByBolao(bolaoId, filters);

      return res.json(bets);
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
}

module.exports = new BetController(); 