const { z } = require('zod');

// Schema para filtros do histórico
const historyFilterSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  type: z.enum(['DEPOSIT', 'WITHDRAW', 'BET', 'PRIZE', 'REFUND']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).refine(data => {
  // Se uma data for fornecida, a outra também deve ser
  if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
    return false;
  }
  // Se ambas as datas forem fornecidas, startDate deve ser menor que endDate
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: "Datas inválidas. Forneça ambas as datas e certifique-se que a data inicial é menor ou igual à data final"
});

// Schema para operações financeiras
const financialOperationSchema = z.object({
  amount: z.number().positive('O valor deve ser maior que zero'),
  description: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres').optional()
});

module.exports = {
  historyFilterSchema,
  financialOperationSchema
}; 