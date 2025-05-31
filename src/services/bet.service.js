const database = require('../config/database');

class BetService {
  constructor() {
    this.prisma = database.getInstance();
  }

  async placeBet(userId, data) {
    const { bolaoId, bets } = data;

    // Busca o bolão e suas configurações
    const bolao = await this.prisma.bolao.findUnique({
      where: { id: bolaoId },
      include: {
        matches: {
          include: {
            match: true
          }
        }
      }
    });

    if (!bolao) {
      throw new Error('Bolão não encontrado');
    }

    // Verifica se o bolão está ativo
    if (bolao.status !== 'ACTIVE') {
      throw new Error('Este bolão não está ativo para apostas');
    }

    // Verifica se todas as partidas pertencem ao bolão
    const bolaoMatchIds = bolao.matches.map(bm => bm.matchId);
    const invalidMatches = bets.filter(bet => !bolaoMatchIds.includes(bet.matchId));
    
    if (invalidMatches.length > 0) {
      throw new Error('Algumas partidas selecionadas não pertencem a este bolão');
    }

    // Verifica se já existe aposta do usuário para alguma das partidas neste bolão
    const existingBets = await this.prisma.bet.findMany({
      where: {
        userId,
        bolaoId,
        matchId: {
          in: bets.map(bet => bet.matchId)
        }
      }
    });

    if (existingBets.length > 0) {
      throw new Error('Você já realizou apostas para algumas destas partidas neste bolão');
    }

    // Calcula o valor total necessário (entryFee por partida)
    const totalAmount = bolao.entryFee * bets.length;

    // Verifica o saldo do usuário
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet || wallet.balance < totalAmount) {
      throw new Error('Saldo insuficiente para realizar estas apostas');
    }

    // Valida as escolhas das apostas de acordo com a modalidade
    for (const bet of bets) {
      await this.validateBetChoices(bolao.modality, bet.betChoices);
    }

    // Cria as apostas usando uma transação
    const createdBets = await this.prisma.$transaction(async (tx) => {
      const newBets = [];

      // 1. Cria cada aposta
      for (const bet of bets) {
        const newBet = await tx.bet.create({
          data: {
            userId,
            bolaoId,
            matchId: bet.matchId,
            amount: bolao.entryFee,
            status: 'ACTIVE',
            choices: {
              create: this.formatBetChoices(bet.betChoices, bolao.modality)
            }
          },
          include: {
            choices: true,
            match: {
              include: {
                homeTeam: true,
                awayTeam: true
              }
            }
          }
        });
        newBets.push(newBet);
      }

      // 2. Atualiza o saldo da carteira
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: {
            decrement: totalAmount
          }
        }
      });

      // 3. Atualiza o prizePool do bolão
      await tx.bolao.update({
        where: { id: bolaoId },
        data: {
          prizePool: {
            increment: totalAmount
          }
        }
      });

      // 4. Cria uma notificação para o usuário
      await tx.notification.create({
        data: {
          userId,
          title: 'Apostas Realizadas',
          message: `Suas apostas no bolão ${bolao.title} foram registradas com sucesso!`,
          type: 'BET_PLACED',
          data: {
            bolaoId: bolao.id,
            bets: newBets.map(bet => ({
              betId: bet.id,
              matchId: bet.matchId
            }))
          }
        }
      });

      return newBets;
    });

    return {
      message: 'Apostas realizadas com sucesso',
      totalAmount,
      bets: createdBets
    };
  }

  async validateBetChoices(modality, betChoices) {
    console.log('Validando aposta:', { modality, betChoices });
    
    switch (modality) {
      case 'WINNER':
        if (!betChoices.winner) {
          throw new Error('É necessário escolher um vencedor');
        }
        break;

      case 'EXACT_SCORE':
        console.log('Validando EXACT_SCORE:', {
          betChoices,
          homeScore: betChoices.homeScore,
          awayScore: betChoices.awayScore,
          typeHome: typeof betChoices.homeScore,
          typeAway: typeof betChoices.awayScore
        });
        
        if (typeof betChoices.homeScore !== 'number' || typeof betChoices.awayScore !== 'number') {
          throw new Error('É necessário informar o placar para ambas as equipes');
        }
        if (betChoices.homeScore < 0 || betChoices.awayScore < 0) {
          throw new Error('O placar não pode conter números negativos');
        }
        break;

      default:
        throw new Error('Modalidade de aposta não suportada');
    }
  }

  formatBetChoices(betChoices, modality) {
    const choices = [];

    switch (modality) {
      case 'WINNER':
        choices.push({
          type: 'WINNER',
          value: betChoices.winner,
          teamId: betChoices.winner
        });
        break;

      case 'EXACT_SCORE':
        choices.push(
          {
            type: 'HOME_SCORE',
            value: betChoices.homeScore.toString()
          },
          {
            type: 'AWAY_SCORE',
            value: betChoices.awayScore.toString()
          }
        );
        break;
    }

    return choices;
  }

  async calculateBetResult(betId, matchResult) {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: {
        choices: true,
        bolao: true,
        match: true
      }
    });

    if (!bet) {
      throw new Error('Aposta não encontrada');
    }

    let points = 0;
    const { modality } = bet.bolao;

    switch (modality) {
      case 'WINNER':
        points = this.calculateWinnerPoints(bet.choices, matchResult);
        break;

      case 'EXACT_SCORE':
        points = this.calculateExactScorePoints(bet.choices, matchResult);
        break;
    }

    // Atualiza a aposta com os pontos e status
    await this.prisma.bet.update({
      where: { id: betId },
      data: {
        points,
        status: points > 0 ? 'WON' : 'LOST'
      }
    });

    return points;
  }

  calculateWinnerPoints(choices, matchResult) {
    const winnerChoice = choices.find(c => c.type === 'WINNER');
    const actualWinner = matchResult.homeScore > matchResult.awayScore 
      ? matchResult.homeTeamId 
      : matchResult.homeScore < matchResult.awayScore 
        ? matchResult.awayTeamId 
        : 'draw';

    return winnerChoice.value === actualWinner ? 10 : 0;
  }

  calculateExactScorePoints(choices, matchResult) {
    const homeScore = choices.find(c => c.type === 'HOME_SCORE');
    const awayScore = choices.find(c => c.type === 'AWAY_SCORE');

    const exactScore = homeScore.value === matchResult.homeScore.toString() && 
                      awayScore.value === matchResult.awayScore.toString();

    return exactScore ? 20 : 0;
  }
}

module.exports = new BetService(); 