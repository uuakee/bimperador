const bolaoResultService = require('../services/bolao.result.service');

class BolaoResultController {
  async finalizeBolao(req, res) {
    try {
      const { bolaoId } = req.params;
      
      const results = await bolaoResultService.calculateBolaoResults(bolaoId);

      res.json({
        message: 'Bolão finalizado e prêmios distribuídos com sucesso',
        results: {
          winners: results.map(winner => ({
            username: winner.user.username,
            correctPredictions: winner.correctPredictions,
            totalBets: winner.totalBets,
            prize: winner.prize,
            level: winner.level
          }))
        }
      });
    } catch (error) {
      console.error('Erro ao finalizar bolão:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getBolaoResults(req, res) {
    try {
      const { bolaoId } = req.params;
      
      const bolao = await prisma.bolao.findUnique({
        where: { id: bolaoId },
        include: {
          bets: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              },
              choices: true
            }
          },
          matches: {
            include: {
              match: {
                include: {
                  homeTeam: true,
                  awayTeam: true
                }
              }
            }
          }
        }
      });

      if (!bolao) {
        return res.status(404).json({ error: 'Bolão não encontrado' });
      }

      // Agrupa resultados por usuário
      const userResults = {};
      bolao.bets.forEach(bet => {
        if (!userResults[bet.userId]) {
          userResults[bet.userId] = {
            username: bet.user.username,
            correctPredictions: 0,
            totalBets: 0,
            predictions: []
          };
        }

        const match = bolao.matches.find(bm => bm.matchId === bet.matchId).match;
        const prediction = {
          matchId: bet.matchId,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          prediction: this.formatPrediction(bet.choices, bolao.modality),
          result: this.formatMatchResult(match),
          correct: bet.points > 0
        };

        userResults[bet.userId].predictions.push(prediction);
        userResults[bet.userId].totalBets++;
        if (bet.points > 0) {
          userResults[bet.userId].correctPredictions++;
        }
      });

      res.json({
        bolao: {
          title: bolao.title,
          status: bolao.status,
          prizePool: bolao.prizePool,
          totalMatches: bolao.matches.length
        },
        results: Object.values(userResults)
      });
    } catch (error) {
      console.error('Erro ao buscar resultados do bolão:', error);
      res.status(500).json({ error: error.message });
    }
  }

  formatPrediction(choices, modality) {
    switch (modality) {
      case 'WINNER':
        const winner = choices.find(c => c.type === 'WINNER');
        return `Vencedor: ${winner.value}`;
      
      case 'EXACT_SCORE':
        const home = choices.find(c => c.type === 'HOME_SCORE');
        const away = choices.find(c => c.type === 'AWAY_SCORE');
        return `${home.value} x ${away.value}`;
      
      default:
        return 'Formato não suportado';
    }
  }

  formatMatchResult(match) {
    return `${match.homeScore} x ${match.awayScore}`;
  }
}

module.exports = new BolaoResultController(); 