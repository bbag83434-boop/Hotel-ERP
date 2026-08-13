"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const dashboard_service_1 = require("../services/dashboard.service");
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const resolveCompanyId = async (req) => {
    if (req.user?.companyId)
        return req.user.companyId;
    const company = await database_1.prisma.company.findFirst({ where: { isActive: true } });
    if (!company)
        throw new response_utils_1.AppError('No active company found in system', 400);
    return company.id;
};
class DashboardController {
    static async getMetrics(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, startDate, endDate } = req.query;
            const metrics = await dashboard_service_1.DashboardService.getUnifiedExecutiveMetrics(companyId, {
                branchId: branchId,
                startDate: startDate,
                endDate: endDate
            });
            return (0, response_utils_1.sendSuccess)(res, metrics, 'Executive dashboard metrics retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DashboardController = DashboardController;
