const database = require('../config/database');

class BolaoResultService {
  constructor() {
    this.prisma = database.getInstance();
  }

  async calculateBolaoResults(bolaoId) {
    const bolao = await this.prisma.bolao.findUnique({
      where: { id: bolaoId },
      include: {
        matches: {
          include: {
            match: true
          }
        },
        bets: {
          include: {
            choices: true,
            user: true
          }
        }
      }
    });

    if (!bolao) {
      throw new Error('Bolão não encontrado');
    }

    // Verifica se todas as partidas foram finalizadas
    const allMatchesFinished = bolao.matches.every(bm => bm.match.isFinished);
    if (!allMatchesFinished) {
      throw new Error('Ainda existem partidas não finalizadas neste bolão');
    }

    // Agrupa apostas por usuário
    const userBets = {};
    bolao.bets.forEach(bet => {
      if (!userBets[bet.userId]) {
        userBets[bet.userId] = {
          user: bet.user,
          bets: [],
          correctPredictions: 0,
          totalBets: 0
        };
      }
      userBets[bet.userId].bets.push(bet);
      userBets[bet.userId].totalBets++;
    });

    console.log('Apostas agrupadas por usuário:', userBets);

    // Calcula acertos por usuário
    for (const userId in userBets) {
      const userData = userBets[userId];
      for (const bet of userData.bets) {
        const match = bolao.matches.find(bm => bm.matchId === bet.matchId).match;
        const points = await this.calculateMatchPoints(bet, match, bolao.modality);
        console.log('Pontos calculados:', {
          userId,
          matchId: bet.matchId,
          points,
          betChoices: bet.choices,
          matchResult: {
            homeScore: match.homeScore,
            awayScore: match.awayScore
          }
        });
        if (points > 0) {
          userData.correctPredictions++;
        }
      }
    }

    console.log('Usuários após cálculo de pontos:', userBets);

    // Define níveis de premiação baseado no número total de partidas
    const totalMatches = bolao.matches.length;
    const prizePool = Number(bolao.prizePool);
    
    const prizeLevels = this.calculatePrizeLevels(totalMatches, prizePool);
    console.log('Níveis de premiação:', prizeLevels);

    // Distribui prêmios
    const winners = await this.distributePrizes(userBets, prizeLevels, bolao.id);
    console.log('Vencedores após distribuição:', winners);

    // Atualiza status do bolão
    await this.prisma.bolao.update({
      where: { id: bolaoId },
      data: {
        status: 'FINISHED'
      }
    });

    return winners;
  }

  calculatePrizeLevels(totalMatches, prizePool) {
    // Requisito mínimo de 4 acertos
    const minCorrect = Math.min(4, totalMatches);
    
    // Calcula diferentes níveis de premiação
    const levels = [];
    
    // Acertou tudo
    if (totalMatches >= 1) {
      levels.push({
        correctPredictions: totalMatches,
        percentage: 100, // 100% do prêmio quando acerta tudo
        prizeAmount: prizePool
      });
    }

    // Errou apenas 1 (só se aplicável)
    if (totalMatches > 1 && totalMatches - 1 >= minCorrect) {
      levels.push({
        correctPredictions: totalMatches - 1,
        percentage: 30,
        prizeAmount: (prizePool * 0.3)
      });
    }

    // Errou 2 (só se aplicável)
    if (totalMatches > 2 && totalMatches - 2 >= minCorrect) {
      levels.push({
        correctPredictions: totalMatches - 2,
        percentage: 15,
        prizeAmount: (prizePool * 0.15)
      });
    }

    // Mínimo de acertos (só se aplicável)
    if (minCorrect < totalMatches - 2) {
      levels.push({
        correctPredictions: minCorrect,
        percentage: 5,
        prizeAmount: (prizePool * 0.05)
      });
    }

    return levels;
  }

  async distributePrizes(userBets, prizeLevels, bolaoId) {
    const winners = [];

    // Processa cada nível de premiação, do maior para o menor
    for (const level of prizeLevels) {
      // Encontra usuários que atingiram este nível
      const levelWinners = Object.entries(userBets)
        .filter(([_, data]) => data.correctPredictions === level.correctPredictions)
        .map(([userId, data]) => ({
          userId,
          user: data.user,
          correctPredictions: data.correctPredictions,
          totalBets: data.totalBets
        }));

      if (levelWinners.length > 0) {
        // Calcula prêmio por usuário neste nível
        const prizePerWinner = level.prizeAmount / levelWinners.length;

        console.log('Distribuindo prêmios:', {
          level,
          winners: levelWinners,
          prizePerWinner
        });

        // Distribui os prêmios
        const updatedWinners = await Promise.all(levelWinners.map(async (winner) => {
          // Atualiza carteira do usuário
          const updatedWallet = await this.prisma.wallet.update({
            where: { userId: winner.userId },
            data: {
              balance: { increment: prizePerWinner }
            }
          });

          console.log('Wallet atualizada:', {
            userId: winner.userId,
            oldBalance: updatedWallet.balance - prizePerWinner,
            newBalance: updatedWallet.balance,
            prize: prizePerWinner
          });

          // Cria registro do prêmio
          await this.prisma.payment.create({
            data: {
              userId: winner.userId,
              bolaoId,
              amount: prizePerWinner,
              type: 'PRIZE',
              status: 'COMPLETED',
              description: `Prêmio por ${winner.correctPredictions} acertos no bolão`,
              processedAt: new Date()
            }
          });

          // Cria notificação
          await this.prisma.notification.create({
            data: {
              userId: winner.userId,
              title: 'Parabéns! Você ganhou um prêmio!',
              message: `Você acertou ${winner.correctPredictions} predições e ganhou R$ ${prizePerWinner.toFixed(2)}!`,
              type: 'BET_WON',
              data: {
                bolaoId,
                correctPredictions: winner.correctPredictions,
                prizeAmount: prizePerWinner
              }
            }
          });

          return {
            ...winner,
            prize: prizePerWinner,
            level: level.correctPredictions
          };
        }));

        winners.push(...updatedWinners);
      }
    }

    return winners;
  }

  async calculateMatchPoints(bet, match, modality) {
    switch (modality) {
      case 'WINNER':
        return this.calculateWinnerPoints(bet.choices, match);
      case 'EXACT_SCORE':
        const homeScoreChoice = bet.choices.find(c => c.type === 'HOME_SCORE');
        const awayScoreChoice = bet.choices.find(c => c.type === 'AWAY_SCORE');
        
        console.log('Calculando pontos EXACT_SCORE:', {
          bet: {
            homeScore: homeScoreChoice?.value,
            awayScore: awayScoreChoice?.value
          },
          match: {
            homeScore: match.homeScore,
            awayScore: match.awayScore
          }
        });

        if (homeScoreChoice && awayScoreChoice &&
            Number(homeScoreChoice.value) === match.homeScore &&
            Number(awayScoreChoice.value) === match.awayScore) {
          return 1;
        }
        return 0;
      case 'TOTAL_GOALS':
        return this.calculateTotalGoalsPoints(bet.choices, match);
      case 'BOTH_SCORE':
        return this.calculateBothScorePoints(bet.choices, match);
      default:
        return 0;
    }
  }

  // Métodos de cálculo de pontos existentes...
  calculateWinnerPoints(choices, match) {
    const winnerChoice = choices.find(c => c.type === 'WINNER');
    const actualWinner = match.homeScore > match.awayScore 
      ? match.homeTeamId 
      : match.homeScore < match.awayScore 
        ? match.awayTeamId 
        : 'draw';

    return winnerChoice.value === actualWinner ? 1 : 0; // Agora retorna 1 para acerto, 0 para erro
  }

  calculateExactScorePoints(choices, match) {
    const homeScore = choices.find(c => c.type === 'HOME_SCORE');
    const awayScore = choices.find(c => c.type === 'AWAY_SCORE');

    return (homeScore.value === match.homeScore.toString() && 
            awayScore.value === match.awayScore.toString()) ? 1 : 0;
  }

  calculateTotalGoalsPoints(choices, match) {
    const totalGoalsChoice = choices.find(c => c.type === 'TOTAL_GOALS');
    const actualTotalGoals = match.homeScore + match.awayScore;

    return parseInt(totalGoalsChoice.value) === actualTotalGoals ? 1 : 0;
  }

  calculateBothScorePoints(choices, match) {
    const bothScoreChoice = choices.find(c => c.type === 'BOTH_SCORE');
    const actualBothScore = match.homeScore > 0 && match.awayScore > 0;
    const predictedBothScore = bothScoreChoice.value === 'yes';

    return actualBothScore === predictedBothScore ? 1 : 0;
  }
}

module.exports = new BolaoResultService(); 