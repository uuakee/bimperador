const { z } = require('zod');
const database = require('../config/database');
const BolaoService = require('../services/BolaoService');

class BolaoController {
  constructor() {
    this.prisma = database.getInstance();
    this.bolaoService = new BolaoService();
  }

  // Criar um novo bolão
  async create(req, res) {
    try {
      const schema = z.object({
        title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
        description: z.string().optional(),
        entryFee: z.number().positive('Taxa de entrada deve ser maior que zero'),
        maxPlayers: z.number().int().positive().optional(),
        startDate: z.string().datetime('Data de início inválida'),
        endDate: z.string().datetime('Data de término inválida'),
        modality: z.enum(['WINNER', 'EXACT_SCORE', 'TOTAL_GOALS', 'BOTH_SCORE', 'CUSTOM']),
        settings: z.object({}).passthrough().optional()
      });

      const data = schema.parse(req.body);

      // Validar datas
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);

      if (startDate <= new Date()) {
        throw new Error('Data de início deve ser futura');
      }

      if (endDate <= startDate) {
        throw new Error('Data de término deve ser posterior à data de início');
      }

      const bolao = await this.bolaoService.create({
        ...data,
        ownerId: req.user.id
      });

      return res.status(201).json(bolao);
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

  // Listar bolões disponíveis
  async list(req, res) {
    try {
      const schema = z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
        status: z.enum(['ACTIVE', 'CLOSED', 'FINISHED', 'CANCELLED']).optional(),
        modality: z.enum(['WINNER', 'EXACT_SCORE', 'TOTAL_GOALS', 'BOTH_SCORE', 'CUSTOM']).optional(),
        search: z.string().optional(),
        minPrize: z.number().optional(),
        maxEntryFee: z.number().optional()
      });

      const filters = schema.parse(req.query);
      const boloes = await this.bolaoService.list(filters);

      return res.json(boloes);
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

  // Participar de um bolão
  async join(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await this.bolaoService.join(id, userId);

      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Buscar bolão por ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const bolao = await this.bolaoService.getById(id);

      if (!bolao) {
        return res.status(404).json({
          error: 'Bolão não encontrado'
        });
      }

      return res.json(bolao);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Atualizar status do bolão (admin)
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const schema = z.object({
        status: z.enum(['ACTIVE', 'CLOSED', 'FINISHED', 'CANCELLED'])
      });

      const { status } = schema.parse(req.body);

      const bolao = await this.bolaoService.updateStatus(id, status);

      return res.json(bolao);
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

  // Adicionar partidas ao bolão (admin)
  async addMatches(req, res) {
    try {
      const { id } = req.params;
      const schema = z.object({
        matches: z.array(z.object({
          matchId: z.string().uuid('ID da partida inválido'),
          odds: z.number().positive('Odds devem ser maiores que zero').optional()
        }))
      });

      const { matches } = schema.parse(req.body);

      const bolao = await this.bolaoService.addMatches(id, matches);

      return res.json(bolao);
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

  // Listar meus bolões
  async listMyBolaos(req, res) {
    try {
      const schema = z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
        status: z.enum(['ACTIVE', 'CLOSED', 'FINISHED', 'CANCELLED']).optional()
      });

      const filters = schema.parse(req.query);
      const boloes = await this.bolaoService.listByUser(req.user.id, filters);

      return res.json(boloes);
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

module.exports = new BolaoController(); 