const database = require('../config/database');

class BolaoService {
  constructor() {
    this.prisma = database.getInstance();
  }

  async createBolao(data) {
    const {
      title,
      description,
      entryFee,
      maxPlayers,
      startDate,
      endDate,
      modality,
      settings,
      matchIds
    } = data;

    // Criar o bolão com uma transação para garantir consistência
    const bolao = await this.prisma.$transaction(async (tx) => {
      // Criar o bolão
      const newBolao = await tx.bolao.create({
        data: {
          title,
          description,
          entryFee,
          maxPlayers,
          startDate,
          endDate,
          modality,
          settings,
          prizePool: 0, // Começa com 0 e vai acumulando com as entradas
        },
      });

      // Associar as partidas ao bolão
      if (matchIds && matchIds.length > 0) {
        await tx.bolaoMatch.createMany({
          data: matchIds.map(matchId => ({
            bolaoId: newBolao.id,
            matchId
          }))
        });
      }

      return newBolao;
    });

    return bolao;
  }

  async placeBet(userId, bolaoId, matchId, betData) {
    const bolao = await this.prisma.bolao.findUnique({
      where: { id: bolaoId },
      include: { matches: true }
    });

    if (!bolao) throw new Error('Bolão não encontrado');
    if (bolao.status !== 'ACTIVE') throw new Error('Bolão não está ativo');

    // Verificar se o usuário tem saldo suficiente
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet || wallet.balance < bolao.entryFee) {
      throw new Error('Saldo insuficiente');
    }

    // Validar aposta baseado na modalidade do bolão
    await this.validateBet(bolao.modality, betData);

    // Criar aposta com uma transação
    const bet = await this.prisma.$transaction(async (tx) => {
      // Criar a aposta
      const newBet = await tx.bet.create({
        data: {
          userId,
          bolaoId,
          matchId,
          amount: bolao.entryFee,
          choices: {
            create: this.formatBetChoices(betData, bolao.modality)
          }
        }
      });

      // Atualizar a carteira do usuário
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: bolao.entryFee }
        }
      });

      // Atualizar o prizePool do bolão
      await tx.bolao.update({
        where: { id: bolaoId },
        data: {
          prizePool: { increment: bolao.entryFee }
        }
      });

      return newBet;
    });

    return bet;
  }

  async validateBet(modality, betData) {
    switch (modality) {
      case 'WINNER':
        if (!betData.winner) throw new Error('Escolha do vencedor é obrigatória');
        break;
      case 'EXACT_SCORE':
        if (!betData.homeScore || !betData.awayScore) {
          throw new Error('Placar completo é obrigatório');
        }
        break;
      case 'TOTAL_GOALS':
        if (!betData.totalGoals) throw new Error('Total de gols é obrigatório');
        break;
      case 'BOTH_SCORE':
        if (betData.bothScore === undefined) {
          throw new Error('Definição de ambos marcam é obrigatória');
        }
        break;
      default:
        throw new Error('Modalidade de bolão não suportada');
    }
  }

  formatBetChoices(betData, modality) {
    const choices = [];

    switch (modality) {
      case 'WINNER':
        choices.push({
          type: 'WINNER',
          value: betData.winner,
          teamId: betData.winner // ID do time vencedor
        });
        break;
      case 'EXACT_SCORE':
        choices.push(
          {
            type: 'HOME_SCORE',
            value: betData.homeScore.toString()
          },
          {
            type: 'AWAY_SCORE',
            value: betData.awayScore.toString()
          }
        );
        break;
      case 'TOTAL_GOALS':
        choices.push({
          type: 'TOTAL_GOALS',
          value: betData.totalGoals.toString()
        });
        break;
      case 'BOTH_SCORE':
        choices.push({
          type: 'BOTH_SCORE',
          value: betData.bothScore ? 'yes' : 'no'
        });
        break;
    }

    return choices;
  }

  async calculateResults(matchId) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        bets: {
          include: {
            choices: true,
            bolao: true
          }
        }
      }
    });

    if (!match || !match.isFinished) {
      throw new Error('Partida não finalizada');
    }

    // Processar cada aposta da partida
    for (const bet of match.bets) {
      const points = await this.calculateBetPoints(bet, match);
      
      await this.prisma.bet.update({
        where: { id: bet.id },
        data: {
          points,
          status: points > 0 ? 'WON' : 'LOST'
        }
      });
    }

    // Distribuir prêmios para cada bolão afetado
    await this.distributePrizes(matchId);
  }

  async calculateBetPoints(bet, match) {
    const { modality } = bet.bolao;
    let points = 0;

    switch (modality) {
      case 'WINNER':
        const winnerChoice = bet.choices.find(c => c.type === 'WINNER');
        const actualWinner = match.homeScore > match.awayScore ? match.homeTeamId :
                           match.homeScore < match.awayScore ? match.awayTeamId : 'draw';
        if (winnerChoice.value === actualWinner) points = 10;
        break;

      case 'EXACT_SCORE':
        const homeScore = bet.choices.find(c => c.type === 'HOME_SCORE');
        const awayScore = bet.choices.find(c => c.type === 'AWAY_SCORE');
        if (homeScore.value === match.homeScore.toString() && 
            awayScore.value === match.awayScore.toString()) {
          points = 20;
        }
        break;

      // Adicionar outros casos conforme necessário
    }

    return points;
  }

  async distributePrizes(matchId) {
    // Implementar distribuição de prêmios baseado nas regras do bolão
    // Esta é uma implementação básica que pode ser expandida
    const boloesAffected = await this.prisma.bolao.findMany({
      where: {
        matches: {
          some: {
            matchId
          }
        },
        status: 'ACTIVE'
      },
      include: {
        bets: {
          where: {
            matchId,
            status: 'WON'
          }
        }
      }
    });

    for (const bolao of boloesAffected) {
      if (bolao.bets.length > 0) {
        const prizePerWinner = bolao.prizePool / bolao.bets.length;

        // Distribuir prêmios para os vencedores
        await Promise.all(bolao.bets.map(bet =>
          this.prisma.wallet.update({
            where: { userId: bet.userId },
            data: {
              balance: { increment: prizePerWinner }
            }
          })
        ));

        // Marcar bolão como finalizado se necessário
        // Lógica adicional pode ser implementada aqui
      }
    }
  }
}

module.exports = new BolaoService(); 