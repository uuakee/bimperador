 // src/controllers/MatchController.js
const { z } = require('zod');
const MatchService = require('../services/match.service');

class MatchController {
    // Lista todas as partidas com filtros opcionais
    async index(req, res) {
        try {
            const schema = z.object({
                status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']).optional(),
                competition: z.string().optional(),
                date: z.string().datetime().optional(),
                teamId: z.string().uuid().optional()
            });

            const filters = schema.parse(req.query);
            const matches = await MatchService.findAll(filters);
            return res.json(matches);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            return res.status(500).json({ error: error.message });
        }
    }

    // Busca uma partida específica
    async show(req, res) {
        try {
            const { id } = req.params;
            const match = await MatchService.findById(id);
            return res.json(match);
        } catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }

    // Cria uma nova partida
    async create(req, res) {
        try {
            const schema = z.object({
                homeTeamId: z.string().uuid(),
                awayTeamId: z.string().uuid(),
                matchDate: z.string().datetime(),
                competition: z.string(),
                round: z.string().optional(),
                status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']).default('SCHEDULED')
            });

            const data = schema.parse(req.body);
            const match = await MatchService.create(data);
            
            return res.status(201).json(match);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            return res.status(500).json({ error: error.message });
        }
    }

    // Atualiza uma partida
    async update(req, res) {
        try {
            const { id } = req.params;

            const schema = z.object({
                homeTeamId: z.string().uuid().optional(),
                awayTeamId: z.string().uuid().optional(),
                matchDate: z.string().datetime().optional(),
                competition: z.string().optional(),
                round: z.string().optional(),
                status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED']).optional(),
                homeScore: z.number().int().min(0).optional(),
                awayScore: z.number().int().min(0).optional()
            });

            const data = schema.parse(req.body);
            const match = await MatchService.update(id, data);

            return res.json(match);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            return res.status(404).json({ error: error.message });
        }
    }

    // Remove uma partida
    async delete(req, res) {
        try {
            const { id } = req.params;
            await MatchService.delete(id);
            return res.status(204).send();
        } catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }

    // Atualiza o placar de uma partida
    async updateScore(req, res) {
        try {
            const { id } = req.params;
            const schema = z.object({
                homeScore: z.number().int().min(0),
                awayScore: z.number().int().min(0)
            });

            const { homeScore, awayScore } = schema.parse(req.body);
            const match = await MatchService.updateScore(id, homeScore, awayScore);

            return res.json(match);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            return res.status(404).json({ error: error.message });
        }
    }
}

module.exports = new MatchController();