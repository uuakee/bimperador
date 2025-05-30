const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar dados existentes (cuidado em produção!)
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.betChoice.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.bolaoMatch.deleteMany();
  await prisma.bolao.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();

  // Criar usuários de teste
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@bolao.com',
        username: 'admin',
        password: hashedPassword,
        fullName: 'Administrador',
        cpf: '12345678901',
        phone: '11999999999',
        wallet: {
          create: {
            balance: 1000.00,
            totalDeposit: 1000.00
          }
        }
      },
      include: {
        wallet: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'joao@teste.com',
        username: 'joao123',
        password: hashedPassword,
        fullName: 'João Silva',
        cpf: '98765432109',
        phone: '11888888888',
        wallet: {
          create: {
            balance: 500.00,
            totalDeposit: 500.00
          }
        }
      },
      include: {
        wallet: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'maria@teste.com',
        username: 'maria456',
        password: hashedPassword,
        fullName: 'Maria Santos',
        cpf: '11223344556',
        phone: '11777777777',
        wallet: {
          create: {
            balance: 300.00,
            totalDeposit: 300.00
          }
        }
      },
      include: {
        wallet: true
      }
    })
  ]);

  console.log('✅ Usuários criados:', users.length);

  // Criar times brasileiros
  const teams = await Promise.all([
    prisma.team.create({
      data: {
        name: 'Flamengo',
        code: 'FLA',
        logo: 'https://logoeps.com/wp-content/uploads/2013/03/flamengo-vector-logo.png'
      }
    }),
    prisma.team.create({
      data: {
        name: 'Palmeiras',
        code: 'PAL',
        logo: 'https://logoeps.com/wp-content/uploads/2013/03/palmeiras-vector-logo.png'
      }
    }),
    prisma.team.create({
      data: {
        name: 'Corinthians',
        code: 'COR',
        logo: 'https://logoeps.com/wp-content/uploads/2013/03/corinthians-vector-logo.png'
      }
    }),
    prisma.team.create({
      data: {
        name: 'São Paulo',
        code: 'SAO',
        logo: 'https://logoeps.com/wp-content/uploads/2013/03/sao-paulo-vector-logo.png'
      }
    }),
    prisma.team.create({
      data: {
        name: 'Santos',
        code: 'SAN',
        logo: 'https://logoeps.com/wp-content/uploads/2013/03/santos-vector-logo.png'
      }
    }),
    prisma.team.create({
      data: {
        name: 'Grêmio',
        code: 'GRE',
        logo: 'https://logoeps.com/wp-content/uploads/2013/03/gremio-vector-logo.png'
      }
    })
  ]);

  console.log('✅ Times criados:', teams.length);

  // Criar partidas futuras
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  dayAfterTomorrow.setHours(16, 0, 0, 0);

  const matches = await Promise.all([
    prisma.match.create({
      data: {
        homeTeamId: teams[0].id, // Flamengo
        awayTeamId: teams[1].id, // Palmeiras
        matchDate: tomorrow,
        competition: 'Campeonato Brasileiro',
        round: 'Rodada 1',
        status: 'SCHEDULED'
      }
    }),
    prisma.match.create({
      data: {
        homeTeamId: teams[2].id, // Corinthians
        awayTeamId: teams[3].id, // São Paulo
        matchDate: dayAfterTomorrow,
        competition: 'Campeonato Brasileiro',
        round: 'Rodada 1',
        status: 'SCHEDULED'
      }
    }),
    prisma.match.create({
      data: {
        homeTeamId: teams[4].id, // Santos
        awayTeamId: teams[5].id, // Grêmio
        matchDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 dias
        competition: 'Copa do Brasil',
        round: 'Oitavas de Final',
        status: 'SCHEDULED'
      }
    })
  ]);

  console.log('✅ Partidas criadas:', matches.length);

  // Criar bolões
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);

  const bolaos = await Promise.all([
    prisma.bolao.create({
      data: {
        title: 'Bolão Brasileirão - Rodada 1',
        description: 'Bolão para apostar nos vencedores da primeira rodada',
        entryFee: 10.00,
        maxPlayers: 100,
        prizePool: 0,
        startDate: startDate,
        endDate: endDate,
        modality: 'WINNER',
        status: 'ACTIVE',
        settings: {
          pointsPerCorrectWinner: 1,
          pointsPerDraw: 0.5
        }
      }
    }),
    prisma.bolao.create({
      data: {
        title: 'Bolão Placar Exato',
        description: 'Acerte o placar exato das partidas',
        entryFee: 25.00,
        maxPlayers: 50,
        prizePool: 0,
        startDate: startDate,
        endDate: endDate,
        modality: 'EXACT_SCORE',
        status: 'ACTIVE',
        settings: {
          pointsPerExactScore: 3,
          pointsPerCorrectWinner: 1
        }
      }
    })
  ]);

  console.log('✅ Bolões criados:', bolaos.length);

  // Associar partidas aos bolões
  const bolaoMatches = await Promise.all([
    // Bolão 1 - todas as partidas
    prisma.bolaoMatch.create({
      data: {
        bolaoId: bolaos[0].id,
        matchId: matches[0].id
      }
    }),
    prisma.bolaoMatch.create({
      data: {
        bolaoId: bolaos[0].id,
        matchId: matches[1].id
      }
    }),
    // Bolão 2 - apenas primeira partida
    prisma.bolaoMatch.create({
      data: {
        bolaoId: bolaos[1].id,
        matchId: matches[0].id
      }
    })
  ]);

  console.log('✅ Associações bolão-partida criadas:', bolaoMatches.length);

  // Criar algumas apostas de exemplo
  const bets = await Promise.all([
    // João aposta no Flamengo para vencer
    prisma.bet.create({
      data: {
        userId: users[1].id,
        bolaoId: bolaos[0].id,
        matchId: matches[0].id,
        amount: 10.00,
        choices: {
          create: {
            type: 'WINNER',
            value: 'homeWin',
            teamId: teams[0].id
          }
        }
      }
    }),
    // Maria aposta no placar exato 2-1 para o Flamengo
    prisma.bet.create({
      data: {
        userId: users[2].id,
        bolaoId: bolaos[1].id,
        matchId: matches[0].id,
        amount: 25.00,
        choices: {
          create: {
            type: 'EXACT_SCORE',
            value: '2-1'
          }
        }
      }
    })
  ]);

  console.log('✅ Apostas criadas:', bets.length);

  // Criar transações
  const transactions = await Promise.all([
    // Depósito do João
    prisma.transaction.create({
      data: {
        walletId: users[1].wallet.id,
        type: 'DEPOSIT',
        amount: 500.00,
        description: 'Depósito inicial',
        status: 'COMPLETED'
      }
    }),
    // Aposta do João
    prisma.transaction.create({
      data: {
        walletId: users[1].wallet.id,
        type: 'BET',
        amount: -10.00,
        description: 'Aposta no bolão Brasileirão',
        status: 'COMPLETED'
      }
    })
  ]);

  console.log('✅ Transações criadas:', transactions.length);

  // Criar uma partida finalizada para exemplo
  const finishedMatch = await prisma.match.create({
    data: {
      homeTeamId: teams[0].id, // Flamengo
      awayTeamId: teams[2].id, // Corinthians
      matchDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Ontem
      homeScore: 2,
      awayScore: 1,
      competition: 'Amistoso',
      round: 'Jogo Único',
      status: 'FINISHED',
      isFinished: true
    }
  });

  console.log('✅ Partida finalizada criada');

  console.log('🎉 Seed concluído com sucesso!');
  console.log(`
📊 Resumo dos dados criados:
- ${users.length} usuários
- ${teams.length} times
- ${matches.length + 1} partidas (${matches.length} futuras + 1 finalizada)
- ${bolaos.length} bolões
- ${bets.length} apostas
- ${transactions.length} transações

🔐 Usuários de teste:
- admin@bolao.com / 123456
- joao@teste.com / 123456  
- maria@teste.com / 123456
  `);
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });