const { PrismaClient } = require('@prisma/client');
const betService = require('../../services/bet.service');
const bolaoResultService = require('../../services/bolao.result.service');
const bcrypt = require('bcryptjs');

describe('Fluxo completo do Bolão', () => {
  let prisma;
  
  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('deve completar todo o fluxo do bolão com sucesso', async () => {
    try {
      // Limpar dados de teste anteriores se existirem
      const testUser = await prisma.user.findFirst({
        where: { 
          OR: [
            { email: 'test@example.com' },
            { username: 'testuser' },
            { cpf: '12345678900' }
          ]
        }
      });

      if (testUser) {
        // Deletar pagamentos primeiro
        await prisma.payment.deleteMany({
          where: { userId: testUser.id }
        });

        // Deletar wallet devido à restrição de chave estrangeira
        await prisma.wallet.deleteMany({
          where: { userId: testUser.id }
        });
        
        // Deletar apostas do usuário
        await prisma.bet.deleteMany({
          where: { userId: testUser.id }
        });

        // Deletar usuário
        await prisma.user.delete({
          where: { id: testUser.id }
        });
      }

      // 1. Criar usuário de teste
      const hashedPassword = await bcrypt.hash('senha123', 10);
      const user = await prisma.user.create({
        data: {
          username: 'testuser',
          email: 'test@example.com',
          password: hashedPassword,
          fullName: 'Test User da Silva',
          cpf: '12345678900', // CPF é obrigatório
          phone: '11999999999', // Opcional, mas vamos incluir
          isActive: true,
          isAdmin: false
        }
      });

      console.log('Usuário criado:', {
        id: user.id,
        username: user.username,
        email: user.email
      });

      // 2. Criar wallet e adicionar saldo
      const wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 1000, // R$ 1000 de saldo inicial
          totalDeposit: 1000, // Registrando o depósito inicial
          totalWithdraw: 0
        }
      });

      console.log('Wallet criada:', {
        id: wallet.id,
        balance: wallet.balance,
        userId: wallet.userId
      });

      // 3. Buscar times existentes
      const teams = await prisma.team.findMany({
        take: 4,
        orderBy: {
          name: 'asc'
        }
      });

      if (teams.length < 4) {
        throw new Error('Não há times suficientes cadastrados no banco de dados. Necessário pelo menos 4 times.');
      }

      console.log('Times encontrados:', teams.map(t => ({ id: t.id, name: t.name })));

      // 4. Criar partidas
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const matches = await Promise.all([
        prisma.match.create({
          data: {
            homeTeamId: teams[0].id,
            awayTeamId: teams[1].id,
            matchDate: tomorrow,
            status: 'SCHEDULED',
            competition: 'Brasileirão',
            round: 'Rodada 1'
          }
        }),
        prisma.match.create({
          data: {
            homeTeamId: teams[2].id,
            awayTeamId: teams[3].id,
            matchDate: tomorrow,
            status: 'SCHEDULED',
            competition: 'Brasileirão',
            round: 'Rodada 1'
          }
        })
      ]);

      console.log('Partidas criadas:', matches.map(m => ({
        id: m.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        date: m.matchDate
      })));

      // 5. Criar um bolão
      const bolao = await prisma.bolao.create({
        data: {
          title: 'Bolão de Teste',
          description: 'Bolão para teste de integração',
          entryFee: 100, // R$ 100 por aposta
          status: 'ACTIVE',
          modality: 'EXACT_SCORE',
          prizePool: 0,
          startDate: new Date(), // Data atual
          endDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 dias depois
          matches: {
            create: matches.map(match => ({
              matchId: match.id
            }))
          }
        }
      });

      console.log('Bolão criado:', {
        id: bolao.id,
        title: bolao.title,
        entryFee: bolao.entryFee,
        prizePool: bolao.prizePool
      });

      // 6. Fazer apostas
      const betsData = {
        bolaoId: bolao.id,
        bets: [
          {
            matchId: matches[0].id,
            betChoices: {
              homeScore: 2,
              awayScore: 1
            }
          },
          {
            matchId: matches[1].id,
            betChoices: {
              homeScore: 0,
              awayScore: 0
            }
          }
        ]
      };

      console.log('Tentando realizar apostas (detalhado):', JSON.stringify(betsData, null, 2));
      console.log('Tipo do homeScore:', typeof betsData.bets[0].betChoices.homeScore);
      console.log('Tipo do awayScore:', typeof betsData.bets[0].betChoices.awayScore);

      // Validar a estrutura antes de enviar
      for (const bet of betsData.bets) {
        if (!bet.betChoices || typeof bet.betChoices.homeScore !== 'number' || typeof bet.betChoices.awayScore !== 'number') {
          throw new Error('Estrutura de apostas inválida: ' + JSON.stringify(bet));
        }
      }

      // Log para debug do serviço
      console.log('Bolão modalidade:', bolao.modality);
      console.log('Primeira aposta betChoices:', JSON.stringify(betsData.bets[0].betChoices, null, 2));

      const placedBets = await betService.placeBet(user.id, betsData);
      console.log('Apostas realizadas:', placedBets);

      // 7. Simular fim das partidas e registrar resultados
      await Promise.all(matches.map(async (match, index) => {
        // Primeiro jogo com resultado 2x1, segundo jogo 0x0 (iguais às apostas)
        const homeScore = index === 0 ? 2 : 0;
        const awayScore = index === 0 ? 1 : 0;

        await prisma.match.update({
          where: { id: match.id },
          data: {
            homeScore,
            awayScore,
            status: 'FINISHED',
            isFinished: true
          }
        });
      }));

      console.log('Partidas finalizadas com resultados');

      // 8. Finalizar bolão e calcular resultados
      const results = await bolaoResultService.calculateBolaoResults(bolao.id);
      console.log('Resultados do bolão:', results);

      // 9. Verificações
      const updatedWallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });

      const custoApostas = betsData.bets.length * bolao.entryFee;
      const saldoEsperado = Number(wallet.balance) - custoApostas + results[0].prize;

      console.log('Wallet após premiação:', {
        balanceInicial: Number(wallet.balance),
        custoApostas,
        premio: results[0].prize,
        saldoEsperado,
        saldoFinal: Number(updatedWallet.balance)
      });

      // O valor final deve ser: saldo inicial - custo das apostas + prêmio
      expect(Number(updatedWallet.balance)).toBe(saldoEsperado);

      // Limpar dados de teste
      await prisma.bet.deleteMany({ where: { userId: user.id } });
      await prisma.payment.deleteMany({ where: { userId: user.id } });
      
      // Verificar se a wallet ainda existe antes de tentar deletar
      const walletExists = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });
      
      if (walletExists) {
        await prisma.wallet.delete({ where: { userId: user.id } });
      }
      
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.bolao.delete({ where: { id: bolao.id } });
      await prisma.match.deleteMany({ where: { id: { in: matches.map(m => m.id) } } });

      console.log('Dados de teste limpos com sucesso');

    } catch (error) {
      console.error('Erro durante o teste:', error);
      throw error;
    }
  });
}); 