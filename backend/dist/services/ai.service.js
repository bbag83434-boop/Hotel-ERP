"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const dashboard_service_1 = require("./dashboard.service");
const database_1 = require("../config/database");
class AIService {
    static formatINR(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        }).format(amount);
    }
    static async queryEnterpriseAssistant(companyId, query, userId, branchId) {
        const cleanQuery = query.toLowerCase().trim();
        // Fetch live ERP aggregates for context
        const metrics = await dashboard_service_1.DashboardService.getUnifiedExecutiveMetrics(companyId, { branchId });
        // Section 15 Safety Guard: Check if query is attempting to write/modify data directly
        const writeKeywords = ['delete', 'remove', 'drop', 'approve', 'reject', 'cancel', 'update salary', 'pay', 'transfer money'];
        const isAttemptingWrite = writeKeywords.some((kw) => cleanQuery.includes(kw));
        if (isAttemptingWrite && !cleanQuery.includes('summary') && !cleanQuery.includes('report') && !cleanQuery.includes('status')) {
            return {
                answer: `⚠️ **Security Policy Enforced (Section 15):** The AI Assistant operates in **Strict Read-Only Mode** against financial and business-critical records. To execute actions such as approving transactions, modifying records, or cancelling bookings, please navigate to the **Approval Center** or use the respective authorized module screen.`,
                suggestedActions: [
                    { label: 'Go to Approval Center', path: '/approvals' },
                    { label: 'View Dashboard Metrics', path: '/dashboard' }
                ],
                intent: 'MUTATION_BLOCKED',
                timestamp: new Date().toISOString()
            };
        }
        // 1. Low Stock & Inventory Query
        if (cleanQuery.includes('stock') || cleanQuery.includes('inventory') || cleanQuery.includes('store') || cleanQuery.includes('low')) {
            const items = await database_1.prisma.item.findMany({
                where: {
                    companyId,
                    isActive: true
                },
                take: 5,
                select: { name: true, code: true, minStockLevel: true }
            });
            const listStr = items.length > 0
                ? items.map((it) => `• **${it.name}** (Code: ${it.code})`).join('\n')
                : 'All store inventory items are currently tracked in system.';
            return {
                answer: `📦 **Stores & Inventory Analysis:**\n- **Total Stores Valuation:** ${this.formatINR(metrics.inventory.totalValuation)}\n- **Low Stock Alerts:** ${metrics.inventory.lowStockItems} items flagged below safety threshold.\n- **Accounts Payable (Vendors):** ${this.formatINR(metrics.inventory.apOutstanding)}\n\n**Sample Catalog Items:**\n${listStr}`,
                suggestedActions: [
                    { label: 'Open Stores Inventory', path: '/inventory' },
                    { label: 'Create Purchase Request', path: '/purchasing' }
                ],
                intent: 'INVENTORY_QUERY',
                timestamp: new Date().toISOString()
            };
        }
        // 2. Hotel & Occupancy Query
        if (cleanQuery.includes('hotel') || cleanQuery.includes('room') || cleanQuery.includes('occupancy') || cleanQuery.includes('adr')) {
            return {
                answer: `🏨 **Hotel PMS Performance Summary:**\n- **Occupancy Rate:** ${metrics.hospitality.occupancyRate}%\n- **In-House Occupied Rooms:** ${metrics.hospitality.occupiedRooms} of ${metrics.hospitality.totalRooms}\n- **Rooms in Cleaning / Turnover:** ${metrics.hospitality.dirtyRooms}\n- **Average Daily Rate (ADR):** ${this.formatINR(metrics.hospitality.adr)}\n- **Revenue Per Available Room (RevPAR):** ${this.formatINR(metrics.hospitality.revpar)}\n- **Total Room Tariff Revenue:** ${this.formatINR(metrics.revenue.roomRevenue)}`,
                suggestedActions: [
                    { label: 'View Room Map', path: '/hotel' },
                    { label: 'Housekeeping Tasks', path: '/hotel' }
                ],
                intent: 'HOTEL_QUERY',
                timestamp: new Date().toISOString()
            };
        }
        // 3. Sales & Restaurant Query
        if (cleanQuery.includes('pos') || cleanQuery.includes('sales') || cleanQuery.includes('food') || cleanQuery.includes('restaurant') || cleanQuery.includes('revenue') || cleanQuery.includes('gst')) {
            return {
                answer: `🍽️ **Sales & Financial Overview:**\n- **Total Consolidated Revenue:** ${this.formatINR(metrics.revenue.total)}\n- **Restaurant POS Dining Revenue:** ${this.formatINR(metrics.revenue.posRevenue)}\n- **Hotel Accommodation Revenue:** ${this.formatINR(metrics.revenue.hotelRevenue)}\n- **Kitchen Food Cost (COGS - BOM):** ${this.formatINR(metrics.revenue.posCostOfGoods)}\n- **Gross Profit Margin:** ${this.formatINR(metrics.revenue.grossProfit)}\n- **Restaurant Average Check:** ${this.formatINR(metrics.fnb.averageCheck)}`,
                suggestedActions: [
                    { label: 'Restaurant POS', path: '/restaurant' },
                    { label: 'Profit & Loss Statement', path: '/accounting' }
                ],
                intent: 'SALES_QUERY',
                timestamp: new Date().toISOString()
            };
        }
        // 4. Pending Approvals & Operations Query
        if (cleanQuery.includes('approval') || cleanQuery.includes('pending') || cleanQuery.includes('task') || cleanQuery.includes('staff')) {
            return {
                answer: `⚡ **Operations & Approval Health:**\n- **Pending Approval Requests:** ${metrics.operations.pendingApprovals} items waiting in queue\n- **Active Employees:** ${metrics.operations.activeStaff} staff members\n- **Pending Leave Requests:** ${metrics.operations.pendingLeaves}\n- **Open Maintenance Tickets:** ${metrics.operations.openMaintenance}\n- **Pending Housekeeping Cleanings:** ${metrics.operations.pendingHousekeeping}`,
                suggestedActions: [
                    { label: 'Open Approval Center', path: '/approvals' },
                    { label: 'Staff & Attendance', path: '/hr' }
                ],
                intent: 'OPERATIONS_QUERY',
                timestamp: new Date().toISOString()
            };
        }
        // Default: Executive Daily Briefing
        return {
            answer: `📊 **Hospitality Executive Daily Summary:**\n- **Total Revenue:** ${this.formatINR(metrics.revenue.total)} (Hotel: ${this.formatINR(metrics.revenue.hotelRevenue)} | Dining: ${this.formatINR(metrics.revenue.posRevenue)})\n- **Hotel Occupancy:** ${metrics.hospitality.occupancyRate}% (${metrics.hospitality.occupiedRooms}/${metrics.hospitality.totalRooms} rooms)\n- **Stores Valuation:** ${this.formatINR(metrics.inventory.totalValuation)} (${metrics.inventory.lowStockItems} low stock items)\n- **Pending Approvals:** ${metrics.operations.pendingApprovals} items in queue\n- **Staff on Duty:** ${metrics.operations.activeStaff} employees`,
            suggestedActions: [
                { label: 'Unified Dashboard', path: '/dashboard' },
                { label: 'View Reports Hub', path: '/reports' }
            ],
            intent: 'EXECUTIVE_BRIEFING',
            timestamp: new Date().toISOString()
        };
    }
}
exports.AIService = AIService;
