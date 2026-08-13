"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const database_1 = require("../config/database");
class DashboardService {
    static async getUnifiedExecutiveMetrics(companyId, filters) {
        const { branchId, startDate, endDate } = filters || {};
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const hasDateFilter = Boolean(startDate || endDate);
        // 1. Parallel Database-Level Aggregations
        const [salesAgg, hotelBookingsAgg, totalRoomsCount, occupiedRoomsCount, dirtyRoomsCount, ordersCount, inventoryBalances, itemsCount, purchaseAgg, accountsPayableAgg, employeesCount, pendingLeavesCount, pendingApprovalsCount, openMaintenanceCount, dirtyHkCount, recentAuditLogs] = await Promise.all([
            // POS Sales Aggregation
            database_1.prisma.salesRecord.aggregate({
                where: {
                    companyId,
                    ...(branchId ? { branchId } : {}),
                    ...(hasDateFilter ? { createdAt: dateFilter } : {})
                },
                _sum: { netSales: true, grossSales: true, totalCogs: true, taxAmount: true },
                _count: { _all: true }
            }),
            // Hotel Bookings & Revenue Aggregation
            database_1.prisma.booking.aggregate({
                where: {
                    companyId,
                    ...(branchId ? { branchId } : {}),
                    ...(hasDateFilter ? { createdAt: dateFilter } : {})
                },
                _sum: { totalRoomCharges: true, extraCharges: true, grandTotal: true, paidAmount: true },
                _count: { _all: true }
            }),
            // Hotel Room Inventory
            database_1.prisma.room.count({
                where: {
                    companyId,
                    isActive: true,
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Occupied Rooms
            database_1.prisma.room.count({
                where: {
                    companyId,
                    status: 'OCCUPIED',
                    isActive: true,
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Dirty Cleaning Rooms
            database_1.prisma.room.count({
                where: {
                    companyId,
                    status: 'DIRTY_CLEANING',
                    isActive: true,
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Restaurant Orders Today
            database_1.prisma.restaurantOrder.count({
                where: {
                    companyId,
                    ...(branchId ? { branchId } : {}),
                    ...(hasDateFilter ? { createdAt: dateFilter } : {})
                }
            }),
            // Inventory Balances (Total stock asset value)
            database_1.prisma.stockBalance.findMany({
                where: {
                    warehouse: {
                        companyId,
                        ...(branchId ? { branchId } : {})
                    }
                },
                include: {
                    item: { select: { costPrice: true, minStockLevel: true } }
                }
            }),
            // Total Items Master
            database_1.prisma.item.count({
                where: {
                    companyId,
                    isActive: true
                }
            }),
            // Purchase Invoices
            database_1.prisma.purchaseInvoice.aggregate({
                where: {
                    companyId,
                    ...(hasDateFilter ? { createdAt: dateFilter } : {})
                },
                _sum: { totalAmount: true, paidAmount: true },
                _count: { _all: true }
            }),
            // Accounts Payable Outstanding
            database_1.prisma.accountsPayable.aggregate({
                where: {
                    companyId,
                    status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
                    ...(branchId ? { branchId } : {})
                },
                _sum: { balance: true }
            }),
            // Staff Count
            database_1.prisma.employee.count({
                where: {
                    companyId,
                    status: 'ACTIVE',
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Pending Leaves
            database_1.prisma.leaveRequest.count({
                where: {
                    companyId,
                    status: 'PENDING',
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Pending Approvals Inbox
            database_1.prisma.approvalRequest.count({
                where: {
                    companyId,
                    status: 'PENDING',
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Open Maintenance Tickets
            database_1.prisma.maintenanceTicket.count({
                where: {
                    companyId,
                    status: { in: ['OPEN', 'IN_PROGRESS'] },
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Pending Housekeeping Tasks
            database_1.prisma.housekeepingTask.count({
                where: {
                    companyId,
                    status: { in: ['PENDING', 'IN_PROGRESS'] },
                    ...(branchId ? { branchId } : {})
                }
            }),
            // Recent Activity Log
            database_1.prisma.auditLog.findMany({
                take: 8,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { firstName: true, lastName: true, role: { select: { name: true } } } }
                }
            })
        ]);
        // Compute Totals
        const posRevenue = Number(salesAgg._sum?.netSales || 0);
        const posCost = Number(salesAgg._sum?.totalCogs || 0);
        const hotelRevenue = Number(hotelBookingsAgg._sum?.grandTotal || 0);
        const roomRevenue = Number(hotelBookingsAgg._sum?.totalRoomCharges || 0);
        const totalRevenue = posRevenue + hotelRevenue;
        const occupancyRate = totalRoomsCount > 0 ? (occupiedRoomsCount / totalRoomsCount) * 100 : 0;
        const adr = occupiedRoomsCount > 0 ? roomRevenue / occupiedRoomsCount : 0;
        const revpar = totalRoomsCount > 0 ? roomRevenue / totalRoomsCount : 0;
        let totalInventoryValuation = 0;
        let lowStockCount = 0;
        for (const sb of inventoryBalances) {
            const qty = Number(sb.quantity || 0);
            const cost = Number(sb.item?.costPrice || 0);
            const minStock = Number(sb.item?.minStockLevel || sb.minStockLevel || 0);
            totalInventoryValuation += qty * cost;
            if (qty <= minStock) {
                lowStockCount++;
            }
        }
        const totalPurchases = Number(purchaseAgg._sum?.totalAmount || 0);
        const apOutstanding = Number(accountsPayableAgg._sum?.balance || 0);
        const salesCount = salesAgg._count?._all || 0;
        return {
            revenue: {
                total: totalRevenue,
                posRevenue,
                hotelRevenue,
                roomRevenue,
                posCostOfGoods: posCost,
                grossProfit: totalRevenue - posCost
            },
            hospitality: {
                totalRooms: totalRoomsCount,
                occupiedRooms: occupiedRoomsCount,
                dirtyRooms: dirtyRoomsCount,
                occupancyRate: Math.round(occupancyRate * 10) / 10,
                adr: Math.round(adr * 100) / 100,
                revpar: Math.round(revpar * 100) / 100,
                totalBookings: hotelBookingsAgg._count?._all || 0
            },
            fnb: {
                totalOrders: ordersCount,
                salesCount,
                averageCheck: salesCount > 0 ? Math.round((posRevenue / salesCount) * 100) / 100 : 0
            },
            inventory: {
                totalValuation: Math.round(totalInventoryValuation * 100) / 100,
                lowStockItems: lowStockCount,
                totalPurchases,
                apOutstanding,
                totalItemsCount: itemsCount
            },
            operations: {
                activeStaff: employeesCount,
                pendingLeaves: pendingLeavesCount,
                pendingApprovals: pendingApprovalsCount,
                openMaintenance: openMaintenanceCount,
                pendingHousekeeping: dirtyHkCount
            },
            activityFeed: recentAuditLogs.map((log) => ({
                id: log.id,
                user: log.user ? `${log.user.firstName} ${log.user.lastName || ''}`.trim() : 'System',
                role: log.user?.role?.name || 'SYSTEM',
                action: log.action,
                entity: log.entity,
                createdAt: log.createdAt
            }))
        };
    }
}
exports.DashboardService = DashboardService;
