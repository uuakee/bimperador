const database = require('../config/database');

class BetService {
  constructor() {
    this.prisma = database.getInstance();
  }

  async create(data) {
    const { bolaoMatchId, userId, homeScore, awayScore } = data;

    return await this.prisma.$transaction(async (tx) => {
      // Verificar se o BolaoMatch existe e está aberto
      const bolaoMatch = await tx.bolaoMatch.findUnique({
        where: { id: bolaoMatchId },
        include: {
          bolao: true,
          match: true
        }
      });

      if (!bolaoMatch) {
        throw new Error('Partida do bolão não encontrada');
      }

      if (bolaoMatch.status !== 'OPEN') {
        throw new Error('Apostas encerradas para esta partida');
      }

      if (bolaoMatch.match.status !== 'SCHEDULED') {
        throw new Error('Partida já iniciou ou foi finalizada');
      }

      // Verificar se o usuário participa do bolão
      const participant = await tx.bolaoParticipant.findUnique({
        where: {
          bolaoId_userId: {
            bolaoId: bolaoMatch.bolaoId,
            userId
          }
        }
      });

      if (!participant) {
        throw new Error('Você não participa deste bolão');
      }

      // Verificar se já existe aposta do usuário para esta partida
      const existingBet = await tx.bet.findFirst({
        where: {
          userId,
          bolaoMatchId
        }
      });

      if (existingBet) {
        throw new Error('Você já fez uma aposta para esta partida');
      }

      // Criar a aposta
      const bet = await tx.bet.create({
        data: {
          userId,
          bolaoMatchId,
          matchId: bolaoMatch.matchId,
          homeScore,
          awayScore,
          status: 'PENDING'
        },
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true
            }
          }
        }
      });

      return bet;
    });
  }

  async listByUser(userId, filters) {
    const { page = 1, limit = 10, status, bolaoId } = filters;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(status && { status }),
      ...(bolaoId && {
        bolaoMatch: {
          bolaoId
        }
      })
    };

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true
            }
          },
          bolaoMatch: {
            include: {
              bolao: true
            }
          }
        },
        skip,
        take: limit
      }),
      this.prisma.bet.count({ where })
    ]);

    return {
      bets,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit
      }
    };
  }

  async getById(id, userId) {
    const bet = await this.prisma.bet.findFirst({
      where: {
        id,
        userId
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true
          }
        },
        bolaoMatch: {
          include: {
            bolao: true
          }
        }
      }
    });

    if (!bet) {
      throw new Error('Aposta não encontrada');
    }

    return bet;
  }

  async cancel(id, userId) {
    return await this.prisma.$transaction(async (tx) => {
      // Buscar a aposta
      const bet = await tx.bet.findFirst({
        where: {
          id,
          userId
        },
        include: {
          match: true,
          bolaoMatch: {
            include: {
              bolao: true
            }
          }
        }
      });

      if (!bet) {
        throw new Error('Aposta não encontrada');
      }

      if (bet.status !== 'PENDING') {
        throw new Error('Só é possível cancelar apostas pendentes');
      }

      if (bet.match.status !== 'SCHEDULED') {
        throw new Error('Não é possível cancelar apostas de partidas já iniciadas');
      }

      // Atualizar status da aposta
      const updatedBet = await tx.bet.update({
        where: { id },
        data: {
          status: 'CANCELLED'
        },
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true
            }
          }
        }
      });

      return updatedBet;
    });
  }

  async listByBolao(bolaoId, filters) {
    const { page = 1, limit = 10, status, matchId } = filters;
    const skip = (page - 1) * limit;

    const where = {
      bolaoMatch: {
        bolaoId
      },
      ...(status && { status }),
      ...(matchId && { matchId })
    };

    const [bets, total] = await Promise.all([
      this.prisma.bet.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          },
          match: {
            include: {
              homeTeam: true,
              awayTeam: true
            }
          }
        },
        skip,
        take: limit
      }),
      this.prisma.bet.count({ where })
    ]);

    return {
      bets,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit
      }
    };
  }

  // Método para calcular pontuação de uma aposta
  calculatePoints(bet, match) {
    if (!match.isFinished || !match.homeScore || !match.awayScore) {
      return 0;
    }

    // Placar exato
    if (bet.homeScore === match.homeScore && bet.awayScore === match.awayScore) {
      return 25;
    }

    // Acertou o vencedor/empate e diferença de gols
    const betDiff = bet.homeScore - bet.awayScore;
    const matchDiff = match.homeScore - match.awayScore;
    if (Math.sign(betDiff) === Math.sign(matchDiff) && Math.abs(betDiff) === Math.abs(matchDiff)) {
      return 18;
    }

    // Acertou apenas o vencedor/empate
    if (Math.sign(betDiff) === Math.sign(matchDiff)) {
      return 12;
    }

    // Não pontuou
    return 0;
  }

  // Método para processar resultado de uma partida
  async processMatchResult(matchId) {
    return await this.prisma.$transaction(async (tx) => {
      // Buscar a partida
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          bolaos: {
            include: {
              bolao: true,
              bets: true
            }
          }
        }
      });

      if (!match || !match.isFinished) {
        throw new Error('Partida não encontrada ou não finalizada');
      }

      // Processar cada bolão que tem esta partida
      for (const bolaoMatch of match.bolaos) {
        // Atualizar status do BolaoMatch
        await tx.bolaoMatch.update({
          where: { id: bolaoMatch.id },
          data: { status: 'CLOSED' }
        });

        // Processar cada aposta
        for (const bet of bolaoMatch.bets) {
          const points = this.calculatePoints(bet, match);
          
          // Atualizar aposta
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              points,
              status: points > 0 ? 'WON' : 'LOST'
            }
          });

          // Atualizar pontuação do participante
          await tx.bolaoParticipant.update({
            where: {
              bolaoId_userId: {
                bolaoId: bolaoMatch.bolaoId,
                userId: bet.userId
              }
            },
            data: {
              points: {
                increment: points
              }
            }
          });
        }

        // Atualizar posições no ranking
        const participants = await tx.bolaoParticipant.findMany({
          where: { bolaoId: bolaoMatch.bolaoId },
          orderBy: { points: 'desc' }
        });

        // Atualizar posição de cada participante
        for (let i = 0; i < participants.length; i++) {
          await tx.bolaoParticipant.update({
            where: { id: participants[i].id },
            data: { position: i + 1 }
          });
        }
      }
    });
  }
}

module.exports = BetService; 