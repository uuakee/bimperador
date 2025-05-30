const { z } = require('zod');
const database = require('../config/database');

class TeamController {
  constructor() {
    this.prisma = database.getInstance();
  }

  async create(req, res) {
    try {
      const schema = z.object({
        name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
        code: z.string().min(2, 'Código deve ter no mínimo 2 caracteres').max(3, 'Código deve ter no máximo 3 caracteres'),
        logo: z.string().url('URL do logo inválida').optional(),
        country: z.string().default('BR')
      });

      const data = schema.parse(req.body);

      // Verifica se já existe time com mesmo nome ou código
      const existingTeam = await this.prisma.team.findFirst({
        where: {
          OR: [
            { name: data.name },
            { code: data.code }
          ]
        }
      });

      if (existingTeam) {
        if (existingTeam.name === data.name) {
          throw new Error('Já existe um time com este nome');
        }
        if (existingTeam.code === data.code) {
          throw new Error('Já existe um time com este código');
        }
      }

      const team = await this.prisma.team.create({
        data
      });

      return res.status(201).json(team);
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

  async update(req, res) {
    try {
      const { id } = req.params;

      const schema = z.object({
        name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').optional(),
        code: z.string().min(2, 'Código deve ter no mínimo 2 caracteres').max(3, 'Código deve ter no máximo 3 caracteres').optional(),
        logo: z.string().url('URL do logo inválida').optional(),
        isActive: z.boolean().optional()
      });

      const data = schema.parse(req.body);

      // Verifica se o time existe
      const team = await this.prisma.team.findUnique({
        where: { id }
      });

      if (!team) {
        return res.status(404).json({
          error: 'Time não encontrado'
        });
      }

      // Verifica se já existe outro time com mesmo nome ou código
      if (data.name || data.code) {
        const existingTeam = await this.prisma.team.findFirst({
          where: {
            OR: [
              data.name ? { name: data.name } : {},
              data.code ? { code: data.code } : {}
            ],
            NOT: {
              id
            }
          }
        });

        if (existingTeam) {
          if (data.name && existingTeam.name === data.name) {
            throw new Error('Já existe um time com este nome');
          }
          if (data.code && existingTeam.code === data.code) {
            throw new Error('Já existe um time com este código');
          }
        }
      }

      const updatedTeam = await this.prisma.team.update({
        where: { id },
        data
      });

      return res.json(updatedTeam);
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

  async list(req, res) {
    try {
      const schema = z.object({
        page: z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
        search: z.string().optional(),
        isActive: z.string().optional().transform(val => val === 'true')
      });

      const { page, limit, search, isActive } = schema.parse(req.query);
      const skip = (page - 1) * limit;

      // Construir where clause
      const where = {
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } }
          ]
        })
      };

      // Buscar times e total
      const [teams, total] = await Promise.all([
        this.prisma.team.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit
        }),
        this.prisma.team.count({ where })
      ]);

      return res.json({
        teams,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit
        }
      });
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;

      const team = await this.prisma.team.findUnique({
        where: { id }
      });

      if (!team) {
        return res.status(404).json({
          error: 'Time não encontrado'
        });
      }

      return res.json(team);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;

      // Verifica se o time existe
      const team = await this.prisma.team.findUnique({
        where: { id }
      });

      if (!team) {
        return res.status(404).json({
          error: 'Time não encontrado'
        });
      }

      // Verifica se o time tem partidas associadas
      const hasMatches = await this.prisma.match.findFirst({
        where: {
          OR: [
            { homeTeamId: id },
            { awayTeamId: id }
          ]
        }
      });

      if (hasMatches) {
        // Em vez de deletar, apenas inativa o time
        await this.prisma.team.update({
          where: { id },
          data: { isActive: false }
        });

        return res.json({
          message: 'Time inativado com sucesso pois possui partidas associadas'
        });
      }

      // Se não tem partidas, pode deletar
      await this.prisma.team.delete({
        where: { id }
      });

      return res.json({
        message: 'Time deletado com sucesso'
      });
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
}

module.exports = new TeamController(); 