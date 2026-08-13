import { Router } from 'express';
import { HotelController } from '../controllers/hotel.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Floors
router.get('/floors', HotelController.getFloors);
router.post('/floors', requirePermission('hotel:manage'), HotelController.createFloor);

// Room Types
router.get('/room-types', HotelController.getRoomTypes);
router.post('/room-types', requirePermission('hotel:manage'), HotelController.createRoomType);

// Rooms & Status Board
router.get('/rooms', HotelController.getRooms);
router.post('/rooms', requirePermission('hotel:manage'), HotelController.createRoom);
router.patch('/rooms/:id/status', requirePermission('hotel:manage'), HotelController.updateRoomStatus);

// Guests
router.get('/guests', HotelController.getGuests);
router.post('/guests', requirePermission('hotel:manage'), HotelController.createGuest);

// Bookings & Front Desk Workflow
router.get('/bookings', HotelController.getBookings);
router.post('/bookings', requirePermission('hotel:manage'), HotelController.createBooking);
router.post('/bookings/:id/check-in', requirePermission('hotel:manage'), HotelController.checkInGuest);
router.post('/bookings/:id/folio-charge', requirePermission('hotel:manage'), HotelController.postFolioCharge);
router.post('/bookings/:id/room-change', requirePermission('hotel:manage'), HotelController.changeRoom);
router.post('/bookings/:id/check-out', requirePermission('hotel:manage'), HotelController.checkOutGuest);

// Night Audit
router.post('/night-audit', requirePermission('hotel:manage'), HotelController.runNightAudit);

// Housekeeping
router.get('/housekeeping', HotelController.getHousekeepingTasks);
router.post('/housekeeping', requirePermission('hotel:manage'), HotelController.createHousekeepingTask);
router.patch('/housekeeping/:id/status', requirePermission('hotel:manage'), HotelController.updateHousekeepingStatus);

// Maintenance
router.get('/maintenance', HotelController.getMaintenanceTickets);
router.post('/maintenance', requirePermission('hotel:manage'), HotelController.createMaintenanceTicket);

export default router;
