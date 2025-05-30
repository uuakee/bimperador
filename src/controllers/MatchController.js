const { z } = require('zod');
const database = require('../config/database');

class MatchController {
  constructor() {
    this.prisma = database.getInstance();
  }

  // Método administrativo para criar partida
  async create(req, res) {
    try {
      const schema = z.object({
        homeTeamId: z.string().uuid('ID do time da casa inválido'),
        awayTeamId: z.string().uuid('ID do time visitante inválido'),
        matchDate: z.string().datetime('Data da partida inválida'),
        competition: z.string().min(3, 'Nome da competição deve ter no mínimo 3 caracteres'),
        round: z.string().optional(),
        status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']).default('SCHEDULED')
      });

      const data = schema.parse(req.body);

      // Verifica se os times existem e estão ativos
      const [homeTeam, awayTeam] = await Promise.all([
        this.prisma.team.findUnique({ where: { id: data.homeTeamId } }),
        this.prisma.team.findUnique({ where: { id: data.awayTeamId } })
      ]);

      if (!homeTeam || !homeTeam.isActive) {
        throw new Error('Time da casa não encontrado ou inativo');
      }

      if (!awayTeam || !awayTeam.isActive) {
        throw new Error('Time visitante não encontrado ou inativo');
      }

      if (data.homeTeamId === data.awayTeamId) {
        throw new Error('Times da casa e visitante devem ser diferentes');
      }

      // Verifica se já existe partida na mesma data para algum dos times
      const existingMatch = await this.prisma.match.findFirst({
        where: {
          matchDate: new Date(data.matchDate),
          OR: [
            { homeTeamId: data.homeTeamId },
            { homeTeamId: data.awayTeamId },
            { awayTeamId: data.homeTeamId },
            { awayTeamId: data.awayTeamId }
          ]
        }
      });

      if (existingMatch) {
        throw new Error('Já existe uma partida agendada para um dos times nesta data');
      }

      const match = await this.prisma.match.create({
        data: {
          ...data,
          matchDate: new Date(data.matchDate)
        },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });

      return res.status(201).json(match);
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

  // Método administrativo para atualizar resultado
  async updateResult(req, res) {
    try {
      const { id } = req.params;

      const schema = z.object({
        homeScore: z.number().int('Placar deve ser um número inteiro').min(0, 'Placar não pode ser negativo'),
        awayScore: z.number().int('Placar deve ser um número inteiro').min(0, 'Placar não pode ser negativo'),
        status: z.enum(['LIVE', 'FINISHED']).default('FINISHED')
      });

      const data = schema.parse(req.body);

      // Verifica se a partida existe
      const match = await this.prisma.match.findUnique({
        where: { id },
        include: {
          bolaos: {
            include: {
              bolao: true
            }
          }
        }
      });

      if (!match) {
        return res.status(404).json({
          error: 'Partida não encontrada'
        });
      }

      // Atualiza o resultado
      const updatedMatch = await this.prisma.match.update({
        where: { id },
        data: {
          ...data,
          isFinished: data.status === 'FINISHED'
        },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });

      // TODO: Se a partida foi finalizada, processar os resultados dos bolões

      return res.json(updatedMatch);
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

  // Método público para listar partidas
  async list(req, res) {
    try {
      const schema = z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
        status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']).optional(),
        competition: z.string().optional(),
        teamId: z.string().uuid('ID do time inválido').optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional()
      });

      const { page, limit, status, competition, teamId, startDate, endDate } = schema.parse(req.query);
      const skip = (page - 1) * limit;

      // Construir filtro de data
      const dateFilter = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate);
      }

      // Construir where clause
      const where = {
        ...(status && { status }),
        ...(competition && { competition }),
        ...(Object.keys(dateFilter).length > 0 && { matchDate: dateFilter }),
        ...(teamId && {
          OR: [
            { homeTeamId: teamId },
            { awayTeamId: teamId }
          ]
        })
      };

      // Buscar partidas e total
      const [matches, total] = await Promise.all([
        this.prisma.match.findMany({
          where,
          orderBy: { matchDate: 'asc' },
          skip,
          take: limit,
          include: {
            homeTeam: true,
            awayTeam: true
          }
        }),
        this.prisma.match.count({ where })
      ]);

      return res.json({
        matches,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit
        }
      });
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

  // Método público para buscar partida por ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const match = await this.prisma.match.findUnique({
        where: { id },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });

      if (!match) {
        return res.status(404).json({
          error: 'Partida não encontrada'
        });
      }

      return res.json(match);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  // Método administrativo para cancelar/adiar partida
  async updateStatus(req, res) {
    try {
      const { id } = req.params;

      const schema = z.object({
        status: z.enum(['CANCELLED', 'POSTPONED']),
        newDate: z.string().datetime().optional()
      });

      const { status, newDate } = schema.parse(req.body);

      // Verifica se a partida existe
      const match = await this.prisma.match.findUnique({
        where: { id }
      });

      if (!match) {
        return res.status(404).json({
          error: 'Partida não encontrada'
        });
      }

      if (match.status === 'FINISHED') {
        throw new Error('Não é possível alterar o status de uma partida finalizada');
      }

      // Se for adiamento, verifica disponibilidade da nova data
      if (status === 'POSTPONED' && newDate) {
        const existingMatch = await this.prisma.match.findFirst({
          where: {
            matchDate: new Date(newDate),
            OR: [
              { homeTeamId: match.homeTeamId },
              { homeTeamId: match.awayTeamId },
              { awayTeamId: match.homeTeamId },
              { awayTeamId: match.awayTeamId }
            ],
            NOT: {
              id: match.id
            }
          }
        });

        if (existingMatch) {
          throw new Error('Já existe uma partida agendada para um dos times nesta data');
        }
      }

      const updatedMatch = await this.prisma.match.update({
        where: { id },
        data: {
          status,
          ...(newDate && { matchDate: new Date(newDate) })
        },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });

      // TODO: Se a partida foi cancelada/adiada, processar reembolsos dos bolões

      return res.json(updatedMatch);
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

module.exports = new MatchController(); 