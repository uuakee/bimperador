// src/controllers/TeamController.js
const { z } = require('zod');
const TeamService = require('../services/team.service');

class TeamController {
  // Lista todos os times
  async index(req, res) {
    try {
      const teams = await TeamService.findAll();
      return res.json(teams);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Busca um time específico
  async show(req, res) {
    try {
      const { id } = req.params;
      const team = await TeamService.findById(id);
      return res.json(team);
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  }

  // Cria um novo time
  async create(req, res) {
    try {
      // Validação dos dados
      const schema = z.object({
        name: z.string().min(3, 'Nome do time deve ter no mínimo 3 caracteres'),
        code: z.string().min(3, 'Código do time deve ter no mínimo 3 caracteres'),
        logo: z.string().optional(),
        country: z.string().optional()
      });

      const data = schema.parse(req.body);
      const team = await TeamService.create(data);
      
      return res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // Atualiza um time
  async update(req, res) {
    try {
      const { id } = req.params;

      // Validação dos dados
      const schema = z.object({
        name: z.string().min(3, 'Nome do time deve ter no mínimo 3 caracteres').optional(),
        code: z.string().min(3, 'Código do time deve ter no mínimo 3 caracteres').optional(),
        logo: z.string().optional(),
        country: z.string().optional(),
        isActive: z.boolean().optional()
      });

      const data = schema.parse(req.body);
      const team = await TeamService.update(id, data);

      return res.json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      return res.status(404).json({ error: error.message });
    }
  }

  // Remove um time
  async delete(req, res) {
    try {
      const { id } = req.params;
      await TeamService.delete(id);
      return res.status(204).send();
    } catch (error) {
      return res.status(404).json({ error: error.message });
    }
  }
}

module.exports = new TeamController();
