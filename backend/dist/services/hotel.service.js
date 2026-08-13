"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelService = void 0;
const client_1 = require("@prisma/client");
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const audit_service_1 = require("./audit.service");
const accounting_service_1 = require("./accounting.service");
class HotelService {
    // ==========================================
    // FLOORS, ROOM TYPES & ROOMS
    // ==========================================
    static async getFloors(companyId, branchId) {
        return database_1.prisma.floor.findMany({
            where: { companyId, branchId, isActive: true },
            include: {
                rooms: {
                    include: {
                        roomType: true,
                        bookings: {
                            where: { status: 'CHECKED_IN' },
                            include: { guest: true },
                            take: 1
                        }
                    },
                    orderBy: { roomNumber: 'asc' }
                }
            },
            orderBy: { floorNumber: 'asc' }
        });
    }
    static async createFloor(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.floor.findUnique({
            where: {
                branchId_floorNumber: {
                    branchId: data.branchId,
                    floorNumber: data.floorNumber
                }
            }
        });
        if (existing)
            throw new response_utils_1.AppError(`Floor number ${data.floorNumber} already exists`, 409);
        const floor = await database_1.prisma.floor.create({
            data: {
                companyId,
                branchId: data.branchId,
                floorNumber: data.floorNumber,
                name: data.name,
                description: data.description
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'FLOOR_CREATED',
            entity: 'Floor',
            entityId: floor.id,
            details: { floorNumber: floor.floorNumber, name: floor.name },
            ipAddress,
            userAgent
        });
        return floor;
    }
    static async getRoomTypes(companyId, branchId) {
        return database_1.prisma.roomType.findMany({
            where: { companyId, branchId, isActive: true },
            include: {
                rooms: true,
                ratePlans: true
            },
            orderBy: { baseRate: 'asc' }
        });
    }
    static async createRoomType(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.roomType.findUnique({
            where: {
                branchId_code: {
                    branchId: data.branchId,
                    code: data.code.toUpperCase()
                }
            }
        });
        if (existing)
            throw new response_utils_1.AppError(`Room type with code ${data.code} already exists`, 409);
        const roomType = await database_1.prisma.roomType.create({
            data: {
                companyId,
                branchId: data.branchId,
                name: data.name,
                code: data.code.toUpperCase(),
                description: data.description,
                baseOccupancy: data.baseOccupancy || 2,
                maxOccupancy: data.maxOccupancy || 4,
                baseRate: new client_1.Prisma.Decimal(data.baseRate),
                amenities: data.amenities
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'ROOM_TYPE_CREATED',
            entity: 'RoomType',
            entityId: roomType.id,
            details: { code: roomType.code, baseRate: data.baseRate.toString() },
            ipAddress,
            userAgent
        });
        return roomType;
    }
    static async getRooms(companyId, branchId, status) {
        return database_1.prisma.room.findMany({
            where: {
                companyId,
                branchId,
                isActive: true,
                ...(status ? { status } : {})
            },
            include: {
                floor: true,
                roomType: true,
                bookings: {
                    where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
                    include: { guest: true },
                    orderBy: { checkInDate: 'asc' }
                },
                housekeepingTasks: {
                    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
                    take: 1
                }
            },
            orderBy: { roomNumber: 'asc' }
        });
    }
    static async createRoom(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.room.findUnique({
            where: {
                branchId_roomNumber: {
                    branchId: data.branchId,
                    roomNumber: data.roomNumber
                }
            }
        });
        if (existing)
            throw new response_utils_1.AppError(`Room number ${data.roomNumber} already exists in this branch`, 409);
        const room = await database_1.prisma.room.create({
            data: {
                companyId,
                branchId: data.branchId,
                floorId: data.floorId,
                roomTypeId: data.roomTypeId,
                roomNumber: data.roomNumber,
                status: 'AVAILABLE',
                notes: data.notes
            },
            include: { floor: true, roomType: true }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'ROOM_CREATED',
            entity: 'Room',
            entityId: room.id,
            details: { roomNumber: room.roomNumber },
            ipAddress,
            userAgent
        });
        return room;
    }
    static async updateRoomStatus(companyId, roomId, status, actorId, ipAddress, userAgent) {
        const room = await database_1.prisma.room.findFirst({ where: { id: roomId, companyId } });
        if (!room)
            throw new response_utils_1.AppError('Room not found', 404);
        const updated = await database_1.prisma.room.update({
            where: { id: roomId },
            data: { status }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'ROOM_STATUS_UPDATED',
            entity: 'Room',
            entityId: roomId,
            details: { before: room.status, after: status },
            ipAddress,
            userAgent
        });
        return updated;
    }
    // ==========================================
    // GUEST PROFILES
    // ==========================================
    static async getGuests(companyId, search) {
        return database_1.prisma.guestProfile.findMany({
            where: {
                companyId,
                ...(search
                    ? {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { email: { contains: search, mode: 'insensitive' } },
                            { phone: { contains: search, mode: 'insensitive' } },
                            { idNumber: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                    : {})
            },
            include: {
                bookings: {
                    orderBy: { checkInDate: 'desc' },
                    take: 5
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async createGuestProfile(companyId, data, actorId, ipAddress, userAgent) {
        const guest = await database_1.prisma.guestProfile.create({
            data: {
                companyId,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email || null,
                phone: data.phone || null,
                idType: data.idType || 'PASSPORT',
                idNumber: data.idNumber || null,
                nationality: data.nationality || null,
                address: data.address || null,
                vipStatus: data.vipStatus || 'NONE',
                preferences: data.preferences,
                notes: data.notes
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'GUEST_PROFILE_CREATED',
            entity: 'GuestProfile',
            entityId: guest.id,
            details: { name: `${guest.firstName} ${guest.lastName}`, email: guest.email },
            ipAddress,
            userAgent
        });
        return guest;
    }
    // ==========================================
    // RESERVATIONS & BOOKING WORKFLOW
    // ==========================================
    static async getBookings(companyId, params) {
        return database_1.prisma.booking.findMany({
            where: {
                companyId,
                ...(params.branchId ? { branchId: params.branchId } : {}),
                ...(params.status ? { status: params.status } : {}),
                ...(params.startDate || params.endDate
                    ? {
                        checkInDate: {
                            ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
                            ...(params.endDate ? { lte: new Date(params.endDate) } : {})
                        }
                    }
                    : {})
            },
            include: {
                guest: true,
                room: { include: { roomType: true, floor: true } },
                roomType: true,
                folioTransactions: true
            },
            orderBy: { checkInDate: 'desc' }
        });
    }
    static async createBooking(companyId, data, actorId, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const checkIn = new Date(data.checkInDate);
            const checkOut = new Date(data.checkOutDate);
            const diffTime = checkOut.getTime() - checkIn.getTime();
            const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            const nightlyRate = new client_1.Prisma.Decimal(data.roomRate);
            const totalRoomCharges = nightlyRate.times(nights);
            const taxAmount = totalRoomCharges.times(0.10); // 10% Hotel City Tax
            const grandTotal = totalRoomCharges.plus(taxAmount);
            const advancePaid = new client_1.Prisma.Decimal(data.advancePayment || 0);
            const balanceAmount = grandTotal.minus(advancePaid);
            const count = await tx.booking.count({ where: { companyId } });
            const bookingNumber = `BK-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
            // If room is specified, verify availability
            if (data.roomId) {
                const room = await tx.room.findUnique({ where: { id: data.roomId } });
                if (!room)
                    throw new response_utils_1.AppError('Specified room not found', 404);
                if (room.status === 'OUT_OF_SERVICE') {
                    throw new response_utils_1.AppError(`Room ${room.roomNumber} is currently out of service`, 400);
                }
            }
            const booking = await tx.booking.create({
                data: {
                    companyId,
                    branchId: data.branchId,
                    guestId: data.guestId,
                    roomId: data.roomId || null,
                    roomTypeId: data.roomTypeId,
                    ratePlanId: data.ratePlanId || null,
                    bookingNumber,
                    checkInDate: checkIn,
                    checkOutDate: checkOut,
                    adults: data.adults || 1,
                    children: data.children || 0,
                    roomRate: nightlyRate,
                    totalRoomCharges,
                    taxAmount,
                    grandTotal,
                    paidAmount: advancePaid,
                    balanceAmount,
                    status: 'CONFIRMED',
                    paymentStatus: advancePaid.greaterThanOrEqualTo(grandTotal) ? 'SUCCESS' : 'PENDING',
                    source: data.source || 'DIRECT_WALKIN',
                    notes: data.notes,
                    createdById: actorId || null
                },
                include: {
                    guest: true,
                    room: true,
                    roomType: true
                }
            });
            // If advance payment was collected, record folio transaction & GL entry
            if (advancePaid.greaterThan(0)) {
                await tx.folioTransaction.create({
                    data: {
                        bookingId: booking.id,
                        transactionType: 'PAYMENT',
                        description: `Advance Deposit / Booking Guarantee`,
                        amount: advancePaid,
                        recordedById: actorId
                    }
                });
            }
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'BOOKING_CREATED',
                entity: 'Booking',
                entityId: booking.id,
                details: { bookingNumber, nights, grandTotal: grandTotal.toString() },
                ipAddress,
                userAgent
            });
            return booking;
        }, { maxWait: 10000, timeout: 30000 });
    }
    // Check-In Guest
    static async checkInGuest(companyId, bookingId, data, actorId, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({
                where: { id: bookingId, companyId },
                include: { guest: true, room: true }
            });
            if (!booking)
                throw new response_utils_1.AppError('Booking not found', 404);
            if (booking.status === 'CHECKED_IN')
                throw new response_utils_1.AppError('Guest is already checked in', 400);
            if (booking.status === 'CANCELLED')
                throw new response_utils_1.AppError('Cannot check in cancelled booking', 400);
            // Verify Room Status: Cannot check into OCCUPIED, DIRTY_CLEANING, or OUT_OF_SERVICE
            const room = await tx.room.findFirst({ where: { id: data.roomId, companyId } });
            if (!room)
                throw new response_utils_1.AppError('Room not found', 404);
            if (room.status === 'OCCUPIED') {
                throw new response_utils_1.AppError(`Room ${room.roomNumber} is currently OCCUPIED by another guest`, 400);
            }
            if (room.status === 'DIRTY_CLEANING') {
                throw new response_utils_1.AppError(`Room ${room.roomNumber} is DIRTY and requires housekeeping inspection before check-in`, 400);
            }
            if (room.status === 'OUT_OF_SERVICE') {
                throw new response_utils_1.AppError(`Room ${room.roomNumber} is OUT OF SERVICE for maintenance`, 400);
            }
            // Update Booking to CHECKED_IN
            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    roomId: data.roomId,
                    actualCheckIn: new Date(),
                    status: 'CHECKED_IN',
                    notes: data.notes ? `${booking.notes || ''} | Check-in note: ${data.notes}` : booking.notes
                },
                include: { guest: true, room: true, roomType: true }
            });
            // Update Room to OCCUPIED
            await tx.room.update({
                where: { id: data.roomId },
                data: {
                    status: 'OCCUPIED',
                    isKeyIssued: true,
                    currentBookingId: booking.id
                }
            });
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'GUEST_CHECKED_IN',
                entity: 'Booking',
                entityId: bookingId,
                details: { bookingNumber: booking.bookingNumber, room: room.roomNumber, guest: `${booking.guest.firstName} ${booking.guest.lastName}` },
                ipAddress,
                userAgent
            });
            return updatedBooking;
        }, { maxWait: 10000, timeout: 30000 });
    }
    // Post Charge to Guest Folio (e.g. POS meal, room service, laundry)
    static async postFolioCharge(companyId, bookingId, data, actorId, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({ where: { id: bookingId, companyId } });
            if (!booking)
                throw new response_utils_1.AppError('Booking not found', 404);
            if (booking.status !== 'CHECKED_IN') {
                throw new response_utils_1.AppError(`Cannot post charge to booking with status ${booking.status}`, 400);
            }
            const chargeAmount = new client_1.Prisma.Decimal(data.amount);
            const folioTx = await tx.folioTransaction.create({
                data: {
                    bookingId,
                    transactionType: data.transactionType,
                    description: data.description,
                    amount: chargeAmount,
                    referenceId: data.referenceId,
                    recordedById: actorId
                }
            });
            // Recalculate Booking Extra Charges & Grand Total
            const newExtraCharges = booking.extraCharges.plus(chargeAmount);
            const newGrandTotal = booking.totalRoomCharges.plus(booking.taxAmount).plus(newExtraCharges).minus(booking.discountAmount);
            const newBalance = newGrandTotal.minus(booking.paidAmount);
            await tx.booking.update({
                where: { id: bookingId },
                data: {
                    extraCharges: newExtraCharges,
                    grandTotal: newGrandTotal,
                    balanceAmount: newBalance
                }
            });
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'FOLIO_CHARGE_POSTED',
                entity: 'FolioTransaction',
                entityId: folioTx.id,
                details: { bookingNumber: booking.bookingNumber, amount: chargeAmount.toString(), type: data.transactionType },
                ipAddress,
                userAgent
            });
            return folioTx;
        }, { maxWait: 10000, timeout: 30000 });
    }
    // Room Change / Upgrade
    static async changeRoom(companyId, bookingId, data, actorId, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({ where: { id: bookingId, companyId }, include: { room: true } });
            if (!booking || !booking.roomId)
                throw new response_utils_1.AppError('Active checked-in booking not found', 404);
            const newRoom = await tx.room.findFirst({ where: { id: data.newRoomId, companyId } });
            if (!newRoom)
                throw new response_utils_1.AppError('Target room not found', 404);
            if (newRoom.status !== 'AVAILABLE' && newRoom.status !== 'INSPECTED') {
                throw new response_utils_1.AppError(`Target room ${newRoom.roomNumber} is not available (Status: ${newRoom.status})`, 400);
            }
            // Log Room Change
            await tx.roomChangeLog.create({
                data: {
                    bookingId,
                    fromRoomId: booking.roomId,
                    toRoomId: data.newRoomId,
                    reason: data.reason,
                    authorizedById: actorId
                }
            });
            // Mark Old Room DIRTY_CLEANING
            await tx.room.update({
                where: { id: booking.roomId },
                data: { status: 'DIRTY_CLEANING', currentBookingId: null, isKeyIssued: false }
            });
            // Mark New Room OCCUPIED
            await tx.room.update({
                where: { id: data.newRoomId },
                data: { status: 'OCCUPIED', currentBookingId: booking.id, isKeyIssued: true }
            });
            // Update Booking
            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: { roomId: data.newRoomId },
                include: { room: true, guest: true }
            });
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'ROOM_CHANGE_EXECUTED',
                entity: 'Booking',
                entityId: bookingId,
                details: { fromRoom: booking.room?.roomNumber, toRoom: newRoom.roomNumber, reason: data.reason },
                ipAddress,
                userAgent
            });
            return updatedBooking;
        }, { maxWait: 10000, timeout: 30000 });
    }
    // Check-Out Guest, Settle Folio & Post Double-Entry General Ledger
    static async checkOutGuest(companyId, bookingId, data, actorId, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findFirst({
                where: { id: bookingId, companyId },
                include: { guest: true, room: true, folioTransactions: true }
            });
            if (!booking)
                throw new response_utils_1.AppError('Booking not found', 404);
            if (booking.status !== 'CHECKED_IN') {
                throw new response_utils_1.AppError(`Cannot check out booking with status ${booking.status}`, 400);
            }
            const discount = new client_1.Prisma.Decimal(data.discountAmount || 0);
            const paymentAmount = new client_1.Prisma.Decimal(data.amountPaid);
            const newPaid = booking.paidAmount.plus(paymentAmount);
            const newGrandTotal = booking.totalRoomCharges.plus(booking.taxAmount).plus(booking.extraCharges).minus(discount);
            // Record final checkout payment transaction on folio
            if (paymentAmount.greaterThan(0)) {
                await tx.folioTransaction.create({
                    data: {
                        bookingId,
                        transactionType: 'PAYMENT',
                        description: `Checkout Settlement via ${data.paymentMethod}`,
                        amount: paymentAmount,
                        recordedById: actorId
                    }
                });
            }
            // Update Booking Status to CHECKED_OUT
            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    actualCheckOut: new Date(),
                    status: 'CHECKED_OUT',
                    paidAmount: newPaid,
                    discountAmount: discount,
                    grandTotal: newGrandTotal,
                    balanceAmount: newGrandTotal.minus(newPaid)
                }
            });
            // Free Room and Mark DIRTY_CLEANING
            if (booking.roomId) {
                await tx.room.update({
                    where: { id: booking.roomId },
                    data: {
                        status: 'DIRTY_CLEANING',
                        currentBookingId: null,
                        isKeyIssued: false
                    }
                });
                // Automatically create Housekeeping Checkout Cleaning Task
                await tx.housekeepingTask.create({
                    data: {
                        companyId,
                        branchId: booking.branchId,
                        roomId: booking.roomId,
                        taskType: 'CHECKOUT_CLEAN',
                        status: 'PENDING',
                        priority: 'HIGH',
                        remarks: `Checkout clean for Room ${booking.room?.roomNumber}`
                    }
                });
            }
            // POST REAL BALANCED DOUBLE-ENTRY GENERAL LEDGER JOURNAL
            await accounting_service_1.AccountingService.recordHotelFolioJournal({
                companyId,
                branchId: booking.branchId,
                bookingId: booking.id,
                bookingNumber: booking.bookingNumber,
                totalAmount: newGrandTotal,
                roomRevenueAmount: booking.totalRoomCharges,
                taxAmount: booking.taxAmount,
                paymentMethod: data.paymentMethod,
                actorId
            });
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'GUEST_CHECKED_OUT',
                entity: 'Booking',
                entityId: bookingId,
                details: {
                    bookingNumber: booking.bookingNumber,
                    room: booking.room?.roomNumber,
                    settledAmount: newPaid.toString()
                },
                ipAddress,
                userAgent
            });
            return {
                booking: updatedBooking,
                message: `Booking #${booking.bookingNumber} checked out. Room marked DIRTY_CLEANING and Double-Entry GL Journal posted.`
            };
        }, { maxWait: 10000, timeout: 30000 });
    }
    // ==========================================
    // NIGHT AUDIT AUTOMATION
    // ==========================================
    static async runNightAudit(companyId, branchId, auditDateStr, actorId, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const auditDate = auditDateStr ? new Date(auditDateStr) : new Date();
            auditDate.setHours(0, 0, 0, 0);
            // Fetch all rooms & active checked-in bookings for this branch
            const [allRooms, activeBookings] = await Promise.all([
                tx.room.findMany({ where: { companyId, branchId, isActive: true } }),
                tx.booking.findMany({
                    where: { companyId, branchId, status: 'CHECKED_IN' },
                    include: { room: true }
                })
            ]);
            const totalRooms = allRooms.length;
            const occupiedRooms = activeBookings.length;
            const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
            let roomRevenue = new client_1.Prisma.Decimal(0);
            let taxRevenue = new client_1.Prisma.Decimal(0);
            for (const booking of activeBookings) {
                const nightlyRate = booking.roomRate;
                const nightlyTax = nightlyRate.times(0.10);
                roomRevenue = roomRevenue.plus(nightlyRate);
                taxRevenue = taxRevenue.plus(nightlyTax);
                // Record Daily Room Charge on Guest Folio
                await tx.folioTransaction.create({
                    data: {
                        bookingId: booking.id,
                        transactionType: 'ROOM_CHARGE',
                        description: `Night Audit Room Charge (${auditDate.toISOString().slice(0, 10)})`,
                        amount: nightlyRate,
                        recordedById: actorId
                    }
                });
            }
            const totalRevenue = roomRevenue.plus(taxRevenue);
            const adr = occupiedRooms > 0 ? roomRevenue.dividedBy(occupiedRooms) : new client_1.Prisma.Decimal(0);
            const revpar = totalRooms > 0 ? roomRevenue.dividedBy(totalRooms) : new client_1.Prisma.Decimal(0);
            const nightAudit = await tx.nightAudit.upsert({
                where: { branchId_auditDate: { branchId, auditDate } },
                update: {
                    totalRooms,
                    occupiedRooms,
                    occupancyRate: new client_1.Prisma.Decimal(occupancyRate),
                    roomRevenue,
                    totalRevenue,
                    adr,
                    revpar,
                    status: 'SUCCESS',
                    auditedById: actorId
                },
                create: {
                    companyId,
                    branchId,
                    auditDate,
                    totalRooms,
                    occupiedRooms,
                    occupancyRate: new client_1.Prisma.Decimal(occupancyRate),
                    roomRevenue,
                    fnbRevenue: new client_1.Prisma.Decimal(0),
                    otherRevenue: new client_1.Prisma.Decimal(0),
                    totalRevenue,
                    adr,
                    revpar,
                    status: 'SUCCESS',
                    auditedById: actorId
                }
            });
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'NIGHT_AUDIT_COMPLETED',
                entity: 'NightAudit',
                entityId: nightAudit.id,
                details: {
                    auditDate: auditDate.toISOString().slice(0, 10),
                    occupancyRate: `${occupancyRate.toFixed(1)}%`,
                    totalRevenue: totalRevenue.toString(),
                    adr: adr.toString(),
                    revpar: revpar.toString()
                },
                ipAddress,
                userAgent
            });
            return nightAudit;
        }, { maxWait: 10000, timeout: 30000 });
    }
    // ==========================================
    // HOUSEKEEPING & MAINTENANCE
    // ==========================================
    static async getHousekeepingTasks(companyId, branchId, status) {
        return database_1.prisma.housekeepingTask.findMany({
            where: {
                companyId,
                branchId,
                ...(status ? { status } : {})
            },
            include: {
                room: { include: { roomType: true, floor: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async createHousekeepingTask(companyId, data, actorId) {
        const task = await database_1.prisma.housekeepingTask.create({
            data: {
                companyId,
                branchId: data.branchId,
                roomId: data.roomId,
                taskType: data.taskType,
                priority: data.priority || 'MEDIUM',
                assignedToId: data.assignedToId || null,
                remarks: data.remarks
            },
            include: { room: true }
        });
        await database_1.prisma.room.update({
            where: { id: data.roomId },
            data: { status: 'DIRTY_CLEANING' }
        });
        return task;
    }
    static async updateHousekeepingStatus(companyId, taskId, status, remarks, actorId) {
        return database_1.prisma.$transaction(async (tx) => {
            const task = await tx.housekeepingTask.findFirst({
                where: { id: taskId, companyId },
                include: { room: true }
            });
            if (!task)
                throw new response_utils_1.AppError('Housekeeping task not found', 404);
            const timestamps = {};
            if (status === 'IN_PROGRESS')
                timestamps.startedAt = new Date();
            if (status === 'COMPLETED' || status === 'INSPECTED')
                timestamps.completedAt = new Date();
            const updated = await tx.housekeepingTask.update({
                where: { id: taskId },
                data: {
                    status,
                    remarks: remarks || task.remarks,
                    ...timestamps
                }
            });
            // When task is INSPECTED / COMPLETED, if room is not occupied, update room to AVAILABLE / INSPECTED
            if (status === 'INSPECTED') {
                const room = await tx.room.findUnique({ where: { id: task.roomId } });
                if (room && room.status === 'DIRTY_CLEANING') {
                    await tx.room.update({
                        where: { id: task.roomId },
                        data: { status: 'AVAILABLE' }
                    });
                }
            }
            return updated;
        }, { maxWait: 10000, timeout: 30000 });
    }
    static async getMaintenanceTickets(companyId, branchId) {
        return database_1.prisma.maintenanceTicket.findMany({
            where: { companyId, branchId },
            include: {
                room: true,
                assignedTo: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async createMaintenanceTicket(companyId, data) {
        return database_1.prisma.maintenanceTicket.create({
            data: {
                companyId,
                branchId: data.branchId,
                roomId: data.roomId || null,
                title: data.title,
                description: data.description,
                category: data.category || 'OTHER',
                priority: data.priority || 'MEDIUM',
                assignedToId: data.assignedToId || null
            }
        });
    }
}
exports.HotelService = HotelService;
