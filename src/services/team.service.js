const database = require('../config/database');

class TeamService {
    constructor() {
        this.prisma = database.getInstance();
    }

    async create(data) {
        const existingTeam = await this.prisma.team.findFirst({
            where: {
                OR: [
                    { name: data.name },
                    { code: data.code }
                ]
            }
        });

        if (existingTeam) {
            throw new Error('Time já existe com este nome ou código');
        }

        return this.prisma.team.create({
            data
        });
    }

    async update(id, data) {
        const team = await this.prisma.team.findUnique({
            where: { id }
        });

        if (!team) {
            throw new Error('Time não encontrado');
        }

        // Verifica se o novo nome ou código já existe em outro time
        if (data.name || data.code) {
            const existingTeam = await this.prisma.team.findFirst({
                where: {
                    OR: [
                        data.name ? { name: data.name } : {},
                        data.code ? { code: data.code } : {}
                    ],
                    NOT: {
                        id
                    }
                }
            });

            if (existingTeam) {
                throw new Error('Já existe um time com este nome ou código');
            }
        }

        return this.prisma.team.update({
            where: { id },
            data
        });
    }

    async delete(id) {
        const team = await this.prisma.team.findUnique({
            where: { id }
        });

        if (!team) {
            throw new Error('Time não encontrado');
        }

        // Verifica se o time tem relacionamentos
        const hasMatches = await this.prisma.match.findFirst({
            where: {
                OR: [
                    { homeTeamId: id },
                    { awayTeamId: id }
                ]
            }
        });

        if (hasMatches) {
            // Em vez de excluir, apenas desativa o time
            return this.prisma.team.update({
                where: { id },
                data: { isActive: false }
            });
        }

        return this.prisma.team.delete({
            where: { id }
        });
    }

    async findAll() {
        return this.prisma.team.findMany({
            orderBy: { name: 'asc' }
        });
    }

    async findById(id) {
        const team = await this.prisma.team.findUnique({
            where: { id }
        });

        if (!team) {
            throw new Error('Time não encontrado');
        }

        return team;
    }
}

module.exports = new TeamService(); 