const bolaoService = require('../services/bolao.service');
const database = require('../config/database');
const { z } = require('zod');

// Schemas de validação
const createBolaoSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  entryFee: z.number().positive(),
  maxPlayers: z.number().int().positive().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  modality: z.enum(['WINNER', 'EXACT_SCORE']),
  settings: z.record(z.any()).optional(),
  matchIds: z.array(z.string().uuid())
});

const placeBetSchema = z.object({
  bolaoId: z.string().uuid(),
  matchId: z.string().uuid(),
  betData: z.object({
    winner: z.string().uuid().optional(),
    homeScore: z.number().int().min(0).optional(),
    awayScore: z.number().int().min(0).optional(),
    totalGoals: z.number().int().min(0).optional(),
    bothScore: z.boolean().optional()
  })
});

class BolaoController {
  constructor() {
    this.prisma = database.getInstance();

    // Vincula o this aos métodos
    this.createBolao = this.createBolao.bind(this);
    this.placeBet = this.placeBet.bind(this);
    this.listBolaos = this.listBolaos.bind(this);
    this.getBolaoDetails = this.getBolaoDetails.bind(this);
    this.getUserBoloes = this.getUserBoloes.bind(this);
  }

  async createBolao(req, res) {
    try {
      const validatedData = createBolaoSchema.parse(req.body);
      const bolao = await bolaoService.createBolao(validatedData);
      res.status(201).json(bolao);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Dados inválidos', 
          details: error.errors 
        });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async placeBet(req, res) {
    try {
      const validatedData = placeBetSchema.parse(req.body);
      const userId = req.user.id; // Assumindo que temos o usuário no request após autenticação

      const bet = await bolaoService.placeBet(
        userId,
        validatedData.bolaoId,
        validatedData.matchId,
        validatedData.betData
      );

      res.status(201).json(bet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Dados inválidos', 
          details: error.errors 
        });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async listBolaos(req, res) {
    try {
      console.log('Buscando bolões...');
      
      const bolaos = await this.prisma.bolao.findMany({
        where: {
          status: 'ACTIVE'
        },
        include: {
          matches: {
            include: {
              match: {
                include: {
                  homeTeam: true,
                  awayTeam: true
                }
              }
            }
          },
          bets: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          },
          _count: {
            select: {
              bets: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log(`Encontrados ${bolaos.length} bolões`);
      
      // Formata a resposta para incluir informações úteis
      const formattedBolaos = bolaos.map(bolao => ({
        id: bolao.id,
        title: bolao.title,
        description: bolao.description,
        entryFee: bolao.entryFee,
        prizePool: bolao.prizePool,
        startDate: bolao.startDate,
        endDate: bolao.endDate,
        status: bolao.status,
        modality: bolao.modality,
        totalParticipants: bolao._count.bets,
        maxPlayers: bolao.maxPlayers,
        matches: bolao.matches.map(bm => ({
          id: bm.match.id,
          homeTeam: bm.match.homeTeam,
          awayTeam: bm.match.awayTeam,
          matchDate: bm.match.matchDate,
          status: bm.match.status
        }))
      }));

      res.json(formattedBolaos);
    } catch (error) {
      console.error('Erro ao listar bolões:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getBolaoDetails(req, res) {
    try {
      const { id } = req.params;
      const bolao = await this.prisma.bolao.findUnique({
        where: { id },
        include: {
          matches: {
            include: {
              match: {
                include: {
                  homeTeam: true,
                  awayTeam: true
                }
              }
            }
          },
          bets: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true
                }
              },
              choices: true
            }
          }
        }
      });

      if (!bolao) {
        return res.status(404).json({ error: 'Bolão não encontrado' });
      }

      res.json(bolao);
    } catch (error) {
      console.error('Erro ao buscar detalhes do bolão:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getUserBoloes(req, res) {
    try {
      const userId = req.user.id;
      const bets = await this.prisma.bet.findMany({
        where: {
          userId
        },
        include: {
          bolao: true,
          match: {
            include: {
              homeTeam: true,
              awayTeam: true
            }
          },
          choices: true
        }
      });

      res.json(bets);
    } catch (error) {
      console.error('Erro ao buscar bolões do usuário:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

// Exporta uma única instância do controller
module.exports = new BolaoController(); 