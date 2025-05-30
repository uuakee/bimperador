const AuthService = require('../services/AuthService');
const { loginSchema, registerSchema } = require('../validators/authValidators');
const { z } = require('zod');

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await AuthService.login(email, password);
      return res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors.map(err => ({
            campo: err.path.join('.'),
            mensagem: err.message
          }))
        });
      }

      return res.status(401).json({
        error: error.message
      });
    }
  }

  async register(req, res) {
    try {
      const userData = registerSchema.parse(req.body);
      const result = await AuthService.register(userData);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors.map(err => ({
            campo: err.path.join('.'),
            mensagem: err.message
          }))
        });
      }

      return res.status(400).json({
        error: error.message
      });
    }
  }

  async validateToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          error: 'Token não fornecido'
        });
      }

      const user = await AuthService.validateToken(token);
      return res.json({ user });
    } catch (error) {
      return res.status(401).json({
        error: error.message
      });
    }
  }
}

module.exports = new AuthController(); 