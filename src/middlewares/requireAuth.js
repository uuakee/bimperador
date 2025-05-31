const authMiddleware = require('./auth.middleware');

// Middleware para proteger rotas que requerem autenticação
const requireAuth = (roles = []) => {
  return async (req, res, next) => {
    try {
      // Primeiro executa o middleware de autenticação
      await new Promise((resolve, reject) => {
        authMiddleware(req, res, (err) => {
          if (err) reject(err);
          resolve();
        });
      });

      // Se roles não foi especificado ou está vazio, permite qualquer usuário autenticado
      if (!roles.length) {
        return next();
      }

      // Verifica se o usuário tem a role necessária (se implementado no seu sistema)
      if (req.user.role && roles.includes(req.user.role)) {
        return next();
      }

      return res.status(403).json({
        error: 'Acesso negado: você não tem permissão para acessar este recurso'
      });
    } catch (error) {
      return res.status(401).json({
        error: 'Não autorizado'
      });
    }
  };
};

module.exports = requireAuth; 