const { z } = require('zod');

// Funções auxiliares de validação
const sanitizeString = (str) => str.trim();

const validateCPF = (cpf) => {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');

  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(10))) return false;

  return true;
};

const validatePassword = (password) => {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  const errors = [];
  if (password.length < minLength) {
    errors.push(`A senha deve ter no mínimo ${minLength} caracteres`);
  }
  if (!hasUpperCase) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula');
  }
  if (!hasLowerCase) {
    errors.push('A senha deve conter pelo menos uma letra minúscula');
  }
  if (!hasNumbers) {
    errors.push('A senha deve conter pelo menos um número');
  }

  return errors.length ? errors : true;
};

// Schema de login
const loginSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .transform(sanitizeString),
  password: z
    .string()
    .min(6, 'A senha deve ter no mínimo 6 caracteres')
});

// Schema de registro
const registerSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .transform(sanitizeString),
  username: z
    .string()
    .min(3, 'Username deve ter no mínimo 3 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username deve conter apenas letras, números e _')
    .transform(sanitizeString),
  password: z
    .string()
    .refine((password) => {
      const validation = validatePassword(password);
      return validation === true;
    }, {
      message: (val) => validatePassword(val).join(', ')
    }),
  fullName: z
    .string()
    .min(3, 'Nome completo deve ter no mínimo 3 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras')
    .transform(sanitizeString),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos')
    .refine(validateCPF, 'CPF inválido'),
  phone: z
    .string()
    .regex(/^\d{10,11}$/, 'Telefone deve conter 10 ou 11 dígitos')
    .optional()
    .transform((val) => val ? val.replace(/\D/g, '') : val)
});

module.exports = {
  loginSchema,
  registerSchema
}; 