const database = require('../config/database');

class MatchService {
    constructor() {
        this.prisma = database.getInstance();
    }

    async create(data) {
        // Verifica se os times existem
        const homeTeam = await this.prisma.team.findUnique({
            where: { id: data.homeTeamId }
        });

        const awayTeam = await this.prisma.team.findUnique({
            where: { id: data.awayTeamId }
        });

        if (!homeTeam || !awayTeam) {
            throw new Error('Time(s) não encontrado(s)');
        }

        if (data.homeTeamId === data.awayTeamId) {
            throw new Error('Times da casa e visitante devem ser diferentes');
        }

        // Verifica se já existe uma partida entre estes times na mesma data
        const existingMatch = await this.prisma.match.findFirst({
            where: {
                AND: [
                    {
                        OR: [
                            {
                                homeTeamId: data.homeTeamId,
                                awayTeamId: data.awayTeamId
                            },
                            {
                                homeTeamId: data.awayTeamId,
                                awayTeamId: data.homeTeamId
                            }
                        ]
                    },
                    {
                        matchDate: data.matchDate
                    }
                ]
            }
        });

        if (existingMatch) {
            throw new Error('Já existe uma partida entre estes times nesta data');
        }

        return this.prisma.match.create({
            data,
            include: {
                homeTeam: true,
                awayTeam: true
            }
        });
    }

    async update(id, data) {
        const match = await this.prisma.match.findUnique({
            where: { id }
        });

        if (!match) {
            throw new Error('Partida não encontrada');
        }

        // Se estiver atualizando os times, faz as verificações necessárias
        if (data.homeTeamId || data.awayTeamId) {
            const homeTeamId = data.homeTeamId || match.homeTeamId;
            const awayTeamId = data.awayTeamId || match.awayTeamId;

            if (homeTeamId === awayTeamId) {
                throw new Error('Times da casa e visitante devem ser diferentes');
            }

            // Verifica se os times existem
            const [homeTeam, awayTeam] = await Promise.all([
                this.prisma.team.findUnique({ where: { id: homeTeamId } }),
                this.prisma.team.findUnique({ where: { id: awayTeamId } })
            ]);

            if (!homeTeam || !awayTeam) {
                throw new Error('Time(s) não encontrado(s)');
            }
        }

        // Se estiver atualizando o placar, atualiza o status para FINISHED
        if ((data.homeScore !== undefined && data.homeScore !== null) || 
            (data.awayScore !== undefined && data.awayScore !== null)) {
            data.status = 'FINISHED';
            data.isFinished = true;
        }

        return this.prisma.match.update({
            where: { id },
            data,
            include: {
                homeTeam: true,
                awayTeam: true
            }
        });
    }

    async delete(id) {
        const match = await this.prisma.match.findUnique({
            where: { id },
            include: {
                bets: true,
                bolaos: true
            }
        });

        if (!match) {
            throw new Error('Partida não encontrada');
        }

        // Se a partida tiver apostas ou estiver em algum bolão, não permite exclusão
        if (match.bets.length > 0 || match.bolaos.length > 0) {
            throw new Error('Não é possível excluir uma partida que possui apostas ou está em um bolão');
        }

        return this.prisma.match.delete({
            where: { id }
        });
    }

    async findAll(filters = {}) {
        const where = {};

        // Filtros opcionais
        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.competition) {
            where.competition = filters.competition;
        }

        if (filters.date) {
            where.matchDate = new Date(filters.date);
        }

        if (filters.teamId) {
            where.OR = [
                { homeTeamId: filters.teamId },
                { awayTeamId: filters.teamId }
            ];
        }

        return this.prisma.match.findMany({
            where,
            include: {
                homeTeam: true,
                awayTeam: true
            },
            orderBy: {
                matchDate: 'asc'
            }
        });
    }

    async findById(id) {
        const match = await this.prisma.match.findUnique({
            where: { id },
            include: {
                homeTeam: true,
                awayTeam: true
            }
        });

        if (!match) {
            throw new Error('Partida não encontrada');
        }

        return match;
    }

    async updateScore(id, homeScore, awayScore) {
        const match = await this.prisma.match.findUnique({
            where: { id }
        });

        if (!match) {
            throw new Error('Partida não encontrada');
        }

        if (match.status === 'FINISHED') {
            throw new Error('Não é possível atualizar o placar de uma partida finalizada');
        }

        return this.prisma.match.update({
            where: { id },
            data: {
                homeScore,
                awayScore,
                status: 'FINISHED',
                isFinished: true
            },
            include: {
                homeTeam: true,
                awayTeam: true
            }
        });
    }
}

module.exports = new MatchService(); 