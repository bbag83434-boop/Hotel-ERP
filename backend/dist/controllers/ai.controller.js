"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIController = void 0;
const ai_service_1 = require("../services/ai.service");
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const zod_1 = require("zod");
const aiQuerySchema = zod_1.z.object({
    query: zod_1.z.string().min(2, 'Query is required'),
    branchId: zod_1.z.string().optional()
});
const resolveCompanyId = async (req) => {
    if (req.user?.companyId)
        return req.user.companyId;
    const company = await database_1.prisma.company.findFirst({ where: { isActive: true } });
    if (!company)
        throw new response_utils_1.AppError('No active company found in system', 400);
    return company.id;
};
class AIController {
    static async queryAssistant(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { query, branchId } = aiQuerySchema.parse(req.body);
            const result = await ai_service_1.AIService.queryEnterpriseAssistant(companyId, query, req.user.userId, branchId);
            return (0, response_utils_1.sendSuccess)(res, result, 'AI assistant insight generated', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AIController = AIController;
