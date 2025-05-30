const database = require('../config/database');
const TransactionRepository = require('../repositories/TransactionRepository');

class BolaoService {
  constructor() {
    this.prisma = database.getInstance();
  }

  async create(data) {
    const { entryFee, ...rest } = data;

    return await this.prisma.$transaction(async (tx) => {
      // Criar o bolão
      const bolao = await tx.bolao.create({
        data: {
          ...rest,
          entryFee,
          prizePool: 0,
          status: 'ACTIVE'
        }
      });

      return bolao;
    });
  }

  async list(filters) {
    const {
      page = 1,
      limit = 10,
      status,
      modality,
      search,
      minPrize,
      maxEntryFee
    } = filters;

    const skip = (page - 1) * limit;

    // Construir where clause
    const where = {
      status: status || 'ACTIVE',
      isActive: true,
      ...(modality && { modality }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(minPrize && { prizePool: { gte: minPrize } }),
      ...(maxEntryFee && { entryFee: { lte: maxEntryFee } })
    };

    // Buscar bolões e total
    const [boloes, total] = await Promise.all([
      this.prisma.bolao.findMany({
        where,
        orderBy: [
          { startDate: 'asc' },
          { createdAt: 'desc' }
        ],
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
          _count: {
            select: {
              participants: true
            }
          }
        },
        skip,
        take: limit
      }),
      this.prisma.bolao.count({ where })
    ]);

    return {
      boloes,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit
      }
    };
  }

  async join(bolaoId, userId) {
    return await this.prisma.$transaction(async (tx) => {
      // Verificar se o bolão existe e está ativo
      const bolao = await tx.bolao.findUnique({
        where: { id: bolaoId }
      });

      if (!bolao) {
        throw new Error('Bolão não encontrado');
      }

      if (!bolao.isActive || bolao.status !== 'ACTIVE') {
        throw new Error('Bolão não está disponível para participação');
      }

      if (bolao.maxPlayers) {
        const participantsCount = await tx.bolaoParticipant.count({
          where: { bolaoId }
        });

        if (participantsCount >= bolao.maxPlayers) {
          throw new Error('Bolão atingiu o limite de participantes');
        }
      }

      // Verificar se o usuário já participa
      const existingParticipant = await tx.bolaoParticipant.findUnique({
        where: {
          bolaoId_userId: {
            bolaoId,
            userId
          }
        }
      });

      if (existingParticipant) {
        throw new Error('Você já participa deste bolão');
      }

      // Verificar saldo do usuário
      const wallet = await tx.wallet.findUnique({
        where: { userId }
      });

      if (!wallet || wallet.balance < bolao.entryFee) {
        throw new Error('Saldo insuficiente');
      }

      // Processar pagamento
      await TransactionRepository.processTransaction(wallet.id, {
        type: 'BET',
        amount: bolao.entryFee,
        description: `Entrada no bolão: ${bolao.title}`
      }, tx);

      // Criar participante
      const participant = await tx.bolaoParticipant.create({
        data: {
          bolaoId,
          userId,
          status: 'ACTIVE'
        }
      });

      // Atualizar prize pool
      await tx.bolao.update({
        where: { id: bolaoId },
        data: {
          prizePool: {
            increment: bolao.entryFee
          }
        }
      });

      // Criar pagamento
      await tx.payment.create({
        data: {
          userId,
          bolaoId,
          amount: bolao.entryFee,
          type: 'ENTRY_FEE',
          status: 'COMPLETED',
          description: `Taxa de entrada - ${bolao.title}`,
          processedAt: new Date()
        }
      });

      return participant;
    });
  }

  async getById(id) {
    return await this.prisma.bolao.findUnique({
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
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          },
          orderBy: {
            points: 'desc'
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      }
    });
  }

  async updateStatus(id, status) {
    return await this.prisma.bolao.update({
      where: { id },
      data: { status }
    });
  }

  async addMatches(id, matches) {
    return await this.prisma.$transaction(async (tx) => {
      // Verificar se o bolão existe e está ativo
      const bolao = await tx.bolao.findUnique({
        where: { id }
      });

      if (!bolao) {
        throw new Error('Bolão não encontrado');
      }

      if (bolao.status !== 'ACTIVE') {
        throw new Error('Bolão não está ativo');
      }

      // Verificar se as partidas existem e não estão finalizadas
      const matchIds = matches.map(m => m.matchId);
      const existingMatches = await tx.match.findMany({
        where: {
          id: { in: matchIds }
        }
      });

      if (existingMatches.length !== matchIds.length) {
        throw new Error('Uma ou mais partidas não foram encontradas');
      }

      const finishedMatches = existingMatches.filter(m => m.isFinished);
      if (finishedMatches.length > 0) {
        throw new Error('Uma ou mais partidas já foram finalizadas');
      }

      // Criar BolaoMatch para cada partida
      const bolaoMatches = await Promise.all(
        matches.map(match => 
          tx.bolaoMatch.create({
            data: {
              bolaoId: id,
              matchId: match.matchId,
              odds: match.odds || 1.0,
              status: 'OPEN'
            }
          })
        )
      );

      return bolaoMatches;
    });
  }

  async listByUser(userId, filters) {
    const { page = 1, limit = 10, status } = filters;
    const skip = (page - 1) * limit;

    const where = {
      participants: {
        some: {
          userId
        }
      },
      ...(status && { status })
    };

    const [boloes, total] = await Promise.all([
      this.prisma.bolao.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
          participants: {
            where: {
              userId
            },
            select: {
              points: true,
              position: true
            }
          }
        },
        skip,
        take: limit
      }),
      this.prisma.bolao.count({ where })
    ]);

    return {
      boloes,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit
      }
    };
  }
}

module.exports = BolaoService; 