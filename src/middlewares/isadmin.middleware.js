// middlewares/isAdminMiddleware.js
const jwt = require('jsonwebtoken');
const database = require('../config/database');

const isAdmin = async (req, res, next) => {
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

    const prisma = database.getInstance();
    const user = await prisma.user.findUnique({
        where: {
            id: decoded.userId
        }
    });

    if (!user || !user.isAdmin) {
        return res.status(403).json({
            error: 'Acesso não autorizado'
        });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
};

module.exports = isAdmin;
