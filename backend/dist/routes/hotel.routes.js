"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hotel_controller_1 = require("../controllers/hotel.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rbac_middleware_1 = require("../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Floors
router.get('/floors', hotel_controller_1.HotelController.getFloors);
router.post('/floors', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.createFloor);
// Room Types
router.get('/room-types', hotel_controller_1.HotelController.getRoomTypes);
router.post('/room-types', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.createRoomType);
// Rooms & Status Board
router.get('/rooms', hotel_controller_1.HotelController.getRooms);
router.post('/rooms', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.createRoom);
router.patch('/rooms/:id/status', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.updateRoomStatus);
// Guests
router.get('/guests', hotel_controller_1.HotelController.getGuests);
router.post('/guests', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.createGuest);
// Bookings & Front Desk Workflow
router.get('/bookings', hotel_controller_1.HotelController.getBookings);
router.post('/bookings', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.createBooking);
router.post('/bookings/:id/check-in', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.checkInGuest);
router.post('/bookings/:id/folio-charge', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.postFolioCharge);
router.post('/bookings/:id/room-change', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.changeRoom);
router.post('/bookings/:id/check-out', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.checkOutGuest);
// Night Audit
router.post('/night-audit', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.runNightAudit);
// Housekeeping
router.get('/housekeeping', hotel_controller_1.HotelController.getHousekeepingTasks);
router.post('/housekeeping', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.createHousekeepingTask);
router.patch('/housekeeping/:id/status', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.updateHousekeepingStatus);
// Maintenance
router.get('/maintenance', hotel_controller_1.HotelController.getMaintenanceTickets);
router.post('/maintenance', (0, rbac_middleware_1.requirePermission)('hotel:manage'), hotel_controller_1.HotelController.createMaintenanceTicket);
exports.default = router;
