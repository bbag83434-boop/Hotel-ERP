"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelController = void 0;
const hotel_service_1 = require("../services/hotel.service");
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const hotel_schema_1 = require("../schemas/hotel.schema");
const resolveCompanyId = async (req) => {
    if (req.user?.companyId)
        return req.user.companyId;
    const company = await database_1.prisma.company.findFirst({ where: { isActive: true } });
    if (!company)
        throw new response_utils_1.AppError('No active company found in system', 400);
    return company.id;
};
const getClientIp = (req) => {
    const xf = req.headers['x-forwarded-for'];
    if (Array.isArray(xf))
        return xf[0] || '';
    if (typeof xf === 'string')
        return xf.split(',')[0].trim();
    return req.ip || '';
};
class HotelController {
    // FLOORS & ROOMS
    static async getFloors(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || '';
            const floors = await hotel_service_1.HotelService.getFloors(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, floors, 'Floors retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createFloor(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.createFloorSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const floor = await hotel_service_1.HotelService.createFloor(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, floor, 'Floor created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async getRoomTypes(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || '';
            const roomTypes = await hotel_service_1.HotelService.getRoomTypes(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, roomTypes, 'Room types retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createRoomType(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.createRoomTypeSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const roomType = await hotel_service_1.HotelService.createRoomType(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, roomType, 'Room type created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async getRooms(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || '';
            const status = req.query.status;
            const rooms = await hotel_service_1.HotelService.getRooms(companyId, branchId, status);
            return (0, response_utils_1.sendSuccess)(res, rooms, 'Rooms retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createRoom(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.createRoomSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const room = await hotel_service_1.HotelService.createRoom(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, room, 'Room created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async updateRoomStatus(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const { status } = hotel_schema_1.updateRoomStatusSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const room = await hotel_service_1.HotelService.updateRoomStatus(companyId, String(id), status, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, room, 'Room status updated successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    // GUESTS
    static async getGuests(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const search = req.query.search || undefined;
            const guests = await hotel_service_1.HotelService.getGuests(companyId, search);
            return (0, response_utils_1.sendSuccess)(res, guests, 'Guests retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createGuest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.createGuestProfileSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const guest = await hotel_service_1.HotelService.createGuestProfile(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, guest, 'Guest profile created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    // BOOKINGS & FRONT DESK WORKFLOW
    static async getBookings(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const status = req.query.status || undefined;
            const startDate = req.query.startDate || undefined;
            const endDate = req.query.endDate || undefined;
            const bookings = await hotel_service_1.HotelService.getBookings(companyId, {
                branchId,
                status,
                startDate,
                endDate
            });
            return (0, response_utils_1.sendSuccess)(res, bookings, 'Bookings retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createBooking(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.createBookingSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const booking = await hotel_service_1.HotelService.createBooking(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, booking, 'Booking created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async checkInGuest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const data = hotel_schema_1.checkInSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const booking = await hotel_service_1.HotelService.checkInGuest(companyId, String(id), data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, booking, 'Guest checked in successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async postFolioCharge(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const data = hotel_schema_1.postFolioChargeSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const charge = await hotel_service_1.HotelService.postFolioCharge(companyId, String(id), data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, charge, 'Folio charge posted successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async changeRoom(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const data = hotel_schema_1.roomChangeSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const booking = await hotel_service_1.HotelService.changeRoom(companyId, String(id), data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, booking, 'Room change executed successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async checkOutGuest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const data = hotel_schema_1.checkOutSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const result = await hotel_service_1.HotelService.checkOutGuest(companyId, String(id), data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, result.booking, result.message, 200);
        }
        catch (err) {
            next(err);
        }
    }
    // NIGHT AUDIT
    static async runNightAudit(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.runNightAuditSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const audit = await hotel_service_1.HotelService.runNightAudit(companyId, data.branchId, data.auditDate, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, audit, 'Night Audit executed successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    // HOUSEKEEPING & MAINTENANCE
    static async getHousekeepingTasks(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || '';
            const status = req.query.status;
            const tasks = await hotel_service_1.HotelService.getHousekeepingTasks(companyId, branchId, status);
            return (0, response_utils_1.sendSuccess)(res, tasks, 'Housekeeping tasks retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createHousekeepingTask(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.createHousekeepingTaskSchema.parse(req.body);
            const task = await hotel_service_1.HotelService.createHousekeepingTask(companyId, data, req.user?.userId);
            return (0, response_utils_1.sendSuccess)(res, task, 'Housekeeping task created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async updateHousekeepingStatus(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const { status, remarks } = hotel_schema_1.updateHousekeepingStatusSchema.parse(req.body);
            const task = await hotel_service_1.HotelService.updateHousekeepingStatus(companyId, String(id), status, remarks, req.user?.userId);
            return (0, response_utils_1.sendSuccess)(res, task, 'Housekeeping status updated successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async getMaintenanceTickets(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || '';
            const tickets = await hotel_service_1.HotelService.getMaintenanceTickets(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, tickets, 'Maintenance tickets retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createMaintenanceTicket(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hotel_schema_1.createMaintenanceTicketSchema.parse(req.body);
            const ticket = await hotel_service_1.HotelService.createMaintenanceTicket(companyId, data);
            return (0, response_utils_1.sendSuccess)(res, ticket, 'Maintenance ticket created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.HotelController = HotelController;
