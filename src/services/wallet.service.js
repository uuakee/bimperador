const database = require('../config/database');
const TransactionRepository = require('../repositories/TransactionRepository');

class WalletService {
  constructor() {
    this.prisma = database.getInstance();
  }

  async getBalance(userId) {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return await TransactionRepository.getWalletBalance(wallet.id);
    } catch (error) {
      throw new Error(`Erro ao consultar saldo: ${error.message}`);
    }
  }

  async getTransactionHistory(userId, filters = {}) {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return await TransactionRepository.findByWalletId(wallet.id, filters);
    } catch (error) {
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }
  }

  async deposit(userId, amount, description = 'Depósito') {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return await TransactionRepository.processTransaction(wallet.id, {
        type: 'DEPOSIT',
        amount,
        description
      });
    } catch (error) {
      throw new Error(`Erro ao processar depósito: ${error.message}`);
    }
  }

  async withdraw(userId, amount, description = 'Saque') {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return await TransactionRepository.processTransaction(wallet.id, {
        type: 'WITHDRAW',
        amount,
        description
      });
    } catch (error) {
      throw new Error(`Erro ao processar saque: ${error.message}`);
    }
  }

  // Novo método para processar apostas
  async processBet(userId, amount, description = 'Aposta') {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return await TransactionRepository.processTransaction(wallet.id, {
        type: 'BET',
        amount,
        description
      });
    } catch (error) {
      throw new Error(`Erro ao processar aposta: ${error.message}`);
    }
  }

  // Novo método para processar prêmios
  async processPrize(userId, amount, description = 'Prêmio') {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return await TransactionRepository.processTransaction(wallet.id, {
        type: 'PRIZE',
        amount,
        description
      });
    } catch (error) {
      throw new Error(`Erro ao processar prêmio: ${error.message}`);
    }
  }

  // Novo método para processar reembolsos
  async processRefund(userId, amount, description = 'Reembolso') {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return await TransactionRepository.processTransaction(wallet.id, {
        type: 'REFUND',
        amount,
        description
      });
    } catch (error) {
      throw new Error(`Erro ao processar reembolso: ${error.message}`);
    }
  }
}

module.exports = new WalletService(); 