const jwt = require('jsonwebtoken');
const database = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    // Verifica se o token está presente no header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    // Extrai o token do header (remove o 'Bearer ')
    const token = authHeader.replace('Bearer ', '');

    // Verifica e decodifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Busca o usuário no banco
    const prisma = database.getInstance();
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { wallet: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    // Adiciona o usuário ao objeto da requisição
    const { password: _, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;

    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = authMiddleware; 