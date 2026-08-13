import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AIService } from '../services/ai.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';
import { z } from 'zod';

const aiQuerySchema = z.object({
  query: z.string().min(2, 'Query is required'),
  branchId: z.string().optional()
});

const resolveCompanyId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.companyId) return req.user.companyId;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new AppError('No active company found in system', 400);
  return company.id;
};

export class AIController {
  public static async queryAssistant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { query, branchId } = aiQuerySchema.parse(req.body);
      const result = await AIService.queryEnterpriseAssistant(companyId, query, req.user!.userId, branchId);
      return sendSuccess(res, result, 'AI assistant insight generated', 200);
    } catch (err) {
      next(err);
    }
  }
}
