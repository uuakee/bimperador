const database = require('../config/database');

class TransactionRepository {
  constructor() {
    this.prisma = database.getInstance();
  }

  async create(data, tx = this.prisma) {
    try {
      const transaction = await tx.transaction.create({
        data,
        include: {
          wallet: true
        }
      });
      return transaction;
    } catch (error) {
      throw new Error(`Erro ao criar transação: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id },
        include: {
          wallet: true
        }
      });
      return transaction;
    } catch (error) {
      throw new Error(`Erro ao buscar transação: ${error.message}`);
    }
  }

  async findByWalletId(walletId, filters = {}) {
    try {
      const { page = 1, limit = 10, type, status, startDate, endDate } = filters;
      const skip = (page - 1) * limit;

      // Construir filtro de data
      const dateFilter = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate);
      }

      // Construir where clause
      const where = {
        walletId,
        ...(type && { type }),
        ...(status && { status }),
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      };

      // Buscar transações e total
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            wallet: true
          }
        }),
        this.prisma.transaction.count({ where })
      ]);

      return {
        transactions,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          perPage: limit
        }
      };
    } catch (error) {
      throw new Error(`Erro ao buscar transações: ${error.message}`);
    }
  }

  async updateStatus(id, status, tx = this.prisma) {
    try {
      const transaction = await tx.transaction.update({
        where: { id },
        data: { status },
        include: {
          wallet: true
        }
      });
      return transaction;
    } catch (error) {
      throw new Error(`Erro ao atualizar status da transação: ${error.message}`);
    }
  }

  async delete(id, tx = this.prisma) {
    try {
      await tx.transaction.delete({
        where: { id }
      });
    } catch (error) {
      throw new Error(`Erro ao deletar transação: ${error.message}`);
    }
  }

  async updateWalletBalance(walletId, amount, type, tx = this.prisma) {
    try {
      const updateData = {};

      switch (type) {
        case 'DEPOSIT':
          updateData.balance = { increment: amount };
          updateData.totalDeposit = { increment: amount };
          break;
        case 'WITHDRAW':
          updateData.balance = { decrement: amount };
          updateData.totalWithdraw = { increment: amount };
          break;
        case 'BET':
          updateData.balance = { decrement: amount };
          break;
        case 'PRIZE':
          updateData.balance = { increment: amount };
          break;
        case 'REFUND':
          updateData.balance = { increment: amount };
          break;
        default:
          throw new Error('Tipo de transação inválido');
      }

      const wallet = await tx.wallet.update({
        where: { id: walletId },
        data: updateData
      });

      return wallet;
    } catch (error) {
      throw new Error(`Erro ao atualizar saldo: ${error.message}`);
    }
  }

  async processTransaction(walletId, { type, amount, description = '' }) {
    return await this.prisma.$transaction(async (tx) => {
      try {
        // Verifica se a carteira existe
        const wallet = await tx.wallet.findUnique({
          where: { id: walletId }
        });

        if (!wallet) {
          throw new Error('Carteira não encontrada');
        }

        // Valida o valor
        if (amount <= 0) {
          throw new Error('Valor deve ser maior que zero');
        }

        // Verifica saldo para operações de débito
        if (['WITHDRAW', 'BET'].includes(type) && wallet.balance < amount) {
          throw new Error('Saldo insuficiente');
        }

        // Cria a transação
        const transaction = await this.create({
          walletId,
          type,
          amount: ['WITHDRAW', 'BET'].includes(type) ? -amount : amount,
          description,
          status: 'COMPLETED'
        }, tx);

        // Atualiza o saldo da carteira
        const updatedWallet = await this.updateWalletBalance(
          walletId,
          amount,
          type,
          tx
        );

        return { transaction, wallet: updatedWallet };
      } catch (error) {
        throw new Error(`Erro ao processar transação: ${error.message}`);
      }
    });
  }

  async getWalletBalance(walletId) {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { id: walletId },
        select: {
          balance: true,
          totalDeposit: true,
          totalWithdraw: true
        }
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      return wallet;
    } catch (error) {
      throw new Error(`Erro ao consultar saldo: ${error.message}`);
    }
  }
}

module.exports = new TransactionRepository(); 