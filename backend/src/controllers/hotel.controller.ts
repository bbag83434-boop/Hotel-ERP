import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { HotelService } from '../services/hotel.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';
import {
  createFloorSchema,
  createRoomTypeSchema,
  createRoomSchema,
  updateRoomStatusSchema,
  createGuestProfileSchema,
  createBookingSchema,
  checkInSchema,
  checkOutSchema,
  postFolioChargeSchema,
  roomChangeSchema,
  createHousekeepingTaskSchema,
  updateHousekeepingStatusSchema,
  createMaintenanceTicketSchema,
  runNightAuditSchema
} from '../schemas/hotel.schema';

const resolveCompanyId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.companyId) return req.user.companyId;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new AppError('No active company found in system', 400);
  return company.id;
};

const getClientIp = (req: AuthenticatedRequest): string => {
  const xf = req.headers['x-forwarded-for'];
  if (Array.isArray(xf)) return xf[0] || '';
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || '';
};

export class HotelController {
  // FLOORS & ROOMS
  public static async getFloors(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || '';
      const floors = await HotelService.getFloors(companyId, branchId);
      return sendSuccess(res, floors, 'Floors retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createFloor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createFloorSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const floor = await HotelService.createFloor(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, floor, 'Floor created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getRoomTypes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || '';
      const roomTypes = await HotelService.getRoomTypes(companyId, branchId);
      return sendSuccess(res, roomTypes, 'Room types retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createRoomType(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createRoomTypeSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const roomType = await HotelService.createRoomType(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, roomType, 'Room type created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getRooms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || '';
      const status = req.query.status as any;
      const rooms = await HotelService.getRooms(companyId, branchId, status);
      return sendSuccess(res, rooms, 'Rooms retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createRoomSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const room = await HotelService.createRoom(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, room, 'Room created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateRoomStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const { status } = updateRoomStatusSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const room = await HotelService.updateRoomStatus(
        companyId,
        String(id),
        status,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, room, 'Room status updated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  // GUESTS
  public static async getGuests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const search = (req.query.search as string) || undefined;
      const guests = await HotelService.getGuests(companyId, search);
      return sendSuccess(res, guests, 'Guests retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createGuest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createGuestProfileSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const guest = await HotelService.createGuestProfile(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, guest, 'Guest profile created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  // BOOKINGS & FRONT DESK WORKFLOW
  public static async getBookings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const status = (req.query.status as any) || undefined;
      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;
      const bookings = await HotelService.getBookings(companyId, {
        branchId,
        status,
        startDate,
        endDate
      });
      return sendSuccess(res, bookings, 'Bookings retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createBooking(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createBookingSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const booking = await HotelService.createBooking(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, booking, 'Booking created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async checkInGuest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const data = checkInSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const booking = await HotelService.checkInGuest(
        companyId,
        String(id),
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, booking, 'Guest checked in successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async postFolioCharge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const data = postFolioChargeSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const charge = await HotelService.postFolioCharge(
        companyId,
        String(id),
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, charge, 'Folio charge posted successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async changeRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const data = roomChangeSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const booking = await HotelService.changeRoom(
        companyId,
        String(id),
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, booking, 'Room change executed successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async checkOutGuest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const data = checkOutSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const result = await HotelService.checkOutGuest(
        companyId,
        String(id),
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, result.booking, result.message, 200);
    } catch (err) {
      next(err);
    }
  }

  // NIGHT AUDIT
  public static async runNightAudit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = runNightAuditSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const audit = await HotelService.runNightAudit(
        companyId,
        data.branchId,
        data.auditDate,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, audit, 'Night Audit executed successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  // HOUSEKEEPING & MAINTENANCE
  public static async getHousekeepingTasks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || '';
      const status = req.query.status as any;
      const tasks = await HotelService.getHousekeepingTasks(companyId, branchId, status);
      return sendSuccess(res, tasks, 'Housekeeping tasks retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createHousekeepingTask(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createHousekeepingTaskSchema.parse(req.body);
      const task = await HotelService.createHousekeepingTask(companyId, data, req.user?.userId);
      return sendSuccess(res, task, 'Housekeeping task created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateHousekeepingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const { status, remarks } = updateHousekeepingStatusSchema.parse(req.body);
      const task = await HotelService.updateHousekeepingStatus(companyId, String(id), status, remarks, req.user?.userId);
      return sendSuccess(res, task, 'Housekeeping status updated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getMaintenanceTickets(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || '';
      const tickets = await HotelService.getMaintenanceTickets(companyId, branchId);
      return sendSuccess(res, tickets, 'Maintenance tickets retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createMaintenanceTicket(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createMaintenanceTicketSchema.parse(req.body);
      const ticket = await HotelService.createMaintenanceTicket(companyId, data);
      return sendSuccess(res, ticket, 'Maintenance ticket created successfully', 201);
    } catch (err) {
      next(err);
    }
  }
}
