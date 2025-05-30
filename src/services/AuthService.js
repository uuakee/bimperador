const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../config/database');

class AuthService {
  constructor() {
    this.prisma = database.getInstance();
  }

  async login(email, password) {
    try {
      // Busca o usuário pelo email
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          wallet: true
        }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verifica a senha
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Senha incorreta');
      }

      // Gera o token JWT
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Remove a senha do objeto de retorno
      const { password: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      throw new Error(`Erro no login: ${error.message}`);
    }
  }

  async register(userData) {
    try {
      // Verifica se já existe usuário com mesmo email ou username
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: userData.email },
            { username: userData.username },
            { cpf: userData.cpf }
          ]
        }
      });

      if (existingUser) {
        if (existingUser.email === userData.email) {
          throw new Error('Email já cadastrado');
        }
        if (existingUser.username === userData.username) {
          throw new Error('Nome de usuário já cadastrado');
        }
        if (existingUser.cpf === userData.cpf) {
          throw new Error('CPF já cadastrado');
        }
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Cria o usuário com a carteira
      const newUser = await this.prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          wallet: {
            create: {
              balance: 0,
              totalDeposit: 0
            }
          }
        },
        include: {
          wallet: true
        }
      });

      // Remove a senha do objeto de retorno
      const { password: _, ...userWithoutPassword } = newUser;

      // Gera o token JWT
      const token = jwt.sign(
        {
          userId: newUser.id,
          email: newUser.email,
          username: newUser.username
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      throw new Error(`Erro no registro: ${error.message}`);
    }
  }

  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          wallet: true
        }
      });

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new Error('Token inválido ou expirado');
    }
  }
}

module.exports = new AuthService(); 