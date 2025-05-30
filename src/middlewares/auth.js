const jwt = require('jsonwebtoken');
const database = require('../config/database');

const isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Token não fornecido'
      });
    }

    const [, token] = authHeader.split(' ');

    if (!token) {
      return res.status(401).json({
        error: 'Token não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const prisma = database.getInstance();

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Usuário não encontrado ou inativo'
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Token inválido'
      });
    }

    return res.status(500).json({
      error: 'Erro ao verificar token'
    });
  }
};

const isAdmin = async (req, res, next) => {
  try {
    const prisma = database.getInstance();
    
    const admin = await prisma.admin.findUnique({
      where: { userId: req.user.id }
    });

    if (!admin) {
      return res.status(403).json({
        error: 'Acesso não autorizado'
      });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return res.status(500).json({
      error: 'Erro ao verificar permissões de administrador'
    });
  }
};

module.exports = {
  isAuthenticated,
  isAdmin
}; 