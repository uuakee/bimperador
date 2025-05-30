const { PrismaClient } = require('@prisma/client');

class Database {
  constructor() {
    if (!Database.instance) {
      this.prisma = new PrismaClient();
      Database.instance = this;
    }
    return Database.instance;
  }

  async connect() {
    try {
      await this.prisma.$connect();
      console.log('✅ Conexão com o banco de dados estabelecida com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar com o banco de dados:', error);
      return false;
    }
  }

  async disconnect() {
    try {
      await this.prisma.$disconnect();
      console.log('👋 Conexão com o banco de dados encerrada.');
    } catch (error) {
      console.error('❌ Erro ao desconectar do banco de dados:', error);
    }
  }

  getInstance() {
    return this.prisma;
  }
}

module.exports = new Database();
