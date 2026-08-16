import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { RestaurantService } from './restaurant.service';
import { Prisma, OnlineOrderStatus } from '@prisma/client';
import crypto from 'crypto';

export class OnlineOrderService {
  // ==========================================
  // 1. GENERATE / RETRIEVE TABLE QR SESSION
  // ==========================================
  public static async generateTableQR(
    companyId: string,
    branchId: string,
    data: { tableId: string; guestName?: string; guestPhone?: string }
  ) {
    const table = await prisma.diningTable.findFirst({
      where: { id: data.tableId, branchId, companyId }
    });

    if (!table) throw new AppError('Dining table not found in this branch', 404);

    // Look for active existing QR session or create a new token
    let session = await prisma.qRSession.findFirst({
      where: {
        tableId: table.id,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() }
      }
    });

    if (!session) {
      const sessionToken = `QR-${table.tableNumber.replace(/\s+/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 12); // Active for 12 hours

      session = await prisma.qRSession.create({
        data: {
          tableId: table.id,
          sessionToken,
          status: 'ACTIVE',
          guestName: data.guestName || null,
          guestPhone: data.guestPhone || null,
          expiresAt
        }
      });
    }

    return {
      sessionToken: session.sessionToken,
      tableNumber: table.tableNumber,
      tableName: table.name || `Table ${table.tableNumber}`,
      section: table.section,
      capacity: table.capacity,
      branchId,
      expiresAt: session.expiresAt
    };
  }

  // ==========================================
  // 2. GET PUBLIC DIGITAL MENU & SESSION DETAILS
  // ==========================================
  public static async getSessionDetails(sessionToken: string) {
    const session = await prisma.qRSession.findUnique({
      where: { sessionToken },
      include: {
        table: {
          include: {
            branch: {
              select: { id: true, name: true, code: true, address: true, companyId: true }
            }
          }
        }
      }
    });

    if (!session) {
      throw new AppError('Invalid or expired QR ordering session', 404);
    }

    if (session.status !== 'ACTIVE' || new Date() > session.expiresAt) {
      throw new AppError('This QR code session has expired. Please ask staff for a fresh QR code.', 400);
    }

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      tableId: session.table.id,
      tableNumber: session.table.tableNumber,
      tableName: session.table.name,
      section: session.table.section,
      branch: session.table.branch,
      companyId: session.table.branch.companyId
    };
  }

  public static async getPublicMenu(branchId?: string, sessionToken?: string) {
    let targetBranchId = branchId;
    let companyId: string | undefined;

    if (sessionToken) {
      const session = await prisma.qRSession.findUnique({
        where: { sessionToken },
        include: { table: { select: { branchId: true, companyId: true } } }
      });
      if (session) {
        targetBranchId = session.table.branchId;
        companyId = session.table.companyId;
      }
    }

    if (!companyId) {
      const company = await prisma.company.findFirst({ where: { isActive: true } });
      if (!company) throw new AppError('No active company available', 400);
      companyId = company.id;
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        companyId,
        isAvailable: true
      },
      include: {
        category: { select: { id: true, name: true, code: true } }
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
    });

    // Group items by category
    const categoriesMap = new Map<string, { categoryName: string; items: any[] }>();

    for (const item of menuItems) {
      const catName = item.category?.name || 'Chef Specials';
      if (!categoriesMap.has(catName)) {
        categoriesMap.set(catName, { categoryName: catName, items: [] });
      }
      categoriesMap.get(catName)!.items.push({
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        kitchenStation: item.kitchenStation,
        preparationMinutes: item.preparationMinutes,
        imageUrl: item.imageUrl,
        category: catName
      });
    }

    return Array.from(categoriesMap.values());
  }

  // ==========================================
  // 3. PLACE ONLINE / QR ORDER
  // ==========================================
  public static async placeOnlineOrder(
    data: {
      sessionToken: string;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      orderType?: 'DINE_IN' | 'TAKEAWAY' | 'ROOM_SERVICE';
      roomNumber?: string;
      notes?: string;
      items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const sessionDetails = await this.getSessionDetails(data.sessionToken);
    const { companyId, branch, tableId } = sessionDetails;

    // 1. Fetch and validate menu items
    const itemIds = data.items.map((i) => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, companyId, isAvailable: true }
    });

    if (dbMenuItems.length !== itemIds.length) {
      throw new AppError('One or more selected menu items are currently unavailable', 400);
    }

    const itemsMap = new Map(dbMenuItems.map((m) => [m.id, m]));

    let subTotal = new Prisma.Decimal(0);
    const orderItemsData = data.items.map((item) => {
      const menuItem = itemsMap.get(item.menuItemId)!;
      const unitPrice = menuItem.price;
      const qty = item.quantity;
      const lineTotal = unitPrice.times(qty);
      subTotal = subTotal.plus(lineTotal);

      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: qty,
        unitPrice,
        totalPrice: lineTotal,
        notes: item.notes || null,
        kitchenStation: menuItem.kitchenStation
      };
    });

    // 5% GST tax calculation for restaurant food orders
    const taxAmount = subTotal.times(0.05);
    const totalAmount = subTotal.plus(taxAmount);

    return prisma.$transaction(async (tx) => {
      // 2. Upsert / Sync Customer Profile
      let customer = await tx.customer.findUnique({
        where: { companyId_phone: { companyId, phone: data.customerPhone } }
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            companyId,
            phone: data.customerPhone,
            name: data.customerName,
            email: data.customerEmail || null,
            totalVisits: 1,
            totalSpend: totalAmount,
            tags: ['QR_ORDER']
          }
        });
      } else {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            totalVisits: { increment: 1 },
            totalSpend: { increment: totalAmount },
            name: data.customerName
          }
        });
      }

      // 3. Generate sequential Online Order Number
      const count = await tx.onlineOrder.count({ where: { companyId } });
      const orderNumber = `ONL-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

      // 4. Create Online Order Record
      const onlineOrder = await tx.onlineOrder.create({
        data: {
          companyId,
          branchId: branch.id,
          customerId: customer.id,
          qrSessionId: sessionDetails.sessionId,
          orderNumber,
          channel: data.orderType === 'DINE_IN' ? 'QR_DINE_IN' : data.orderType === 'TAKEAWAY' ? 'ONLINE_TAKEAWAY' : 'ROOM_SERVICE',
          status: 'RECEIVED',
          subTotal,
          taxAmount,
          totalAmount,
          notes: data.notes || null,
          items: {
            create: orderItemsData.map((oi) => ({
              menuItemId: oi.menuItemId,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              totalPrice: oi.totalPrice,
              notes: oi.notes
            }))
          }
        },
        include: {
          items: { include: { menuItem: true } },
          customer: true
        }
      });

      // 5. UNIFIED POS & KDS ARCHITECTURE BRIDGE:
      // Auto-create/sync RestaurantOrder so cashier sees it on POS and kitchen sees it on KDS
      const posOrderCount = await tx.restaurantOrder.count({ where: { companyId } });
      const posOrderNumber = `ORD-QR-${new Date().getFullYear()}-${String(posOrderCount + 1).padStart(5, '0')}`;

      const restaurantOrder = await tx.restaurantOrder.create({
        data: {
          companyId,
          branchId: branch.id,
          orderNumber: posOrderNumber,
          tableId: data.orderType === 'DINE_IN' ? tableId : null,
          orderType: data.orderType || 'DINE_IN',
          status: 'OPEN',
          guestCount: 1,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          subtotal: subTotal,
          taxAmount,
          grandTotal: totalAmount,
          notes: `[QR Online #${orderNumber}] ${data.notes || ''}`.trim(),
          items: {
            create: orderItemsData.map((oi) => ({
              menuItemId: oi.menuItemId,
              name: oi.name,
              quantity: new Prisma.Decimal(oi.quantity),
              unitPrice: oi.unitPrice,
              totalPrice: oi.totalPrice,
              notes: oi.notes,
              status: 'PENDING'
            }))
          }
        },
        include: { items: true }
      });

      // Update Dining Table status to OCCUPIED
      if (data.orderType === 'DINE_IN' && tableId) {
        await tx.diningTable.update({
          where: { id: tableId },
          data: {
            status: 'OCCUPIED',
            activeOrderId: restaurantOrder.id
          }
        });
      }

      // Auto-generate KDS Kitchen Ticket (KOT)
      const kotCount = await tx.kitchenTicket.count({ where: { branchId: branch.id } });
      const ticketNumber = `KOT-QR-${String(kotCount + 1).padStart(4, '0')}`;

      await tx.kitchenTicket.create({
        data: {
          ticketNumber,
          orderId: restaurantOrder.id,
          branchId: branch.id,
          status: 'PENDING',
          ticketType: 'NEW_ORDER',
          station: 'MAIN_KITCHEN',
          items: {
            create: restaurantOrder.items.map((ri) => ({
              orderItemId: ri.id,
              quantity: ri.quantity,
              notes: ri.notes,
              status: 'PENDING'
            }))
          }
        }
      });

      await AuditService.log({
        userId: customer.id,
        action: 'ONLINE_ORDER_PLACED',
        entity: 'OnlineOrder',
        entityId: onlineOrder.id,
        details: {
          orderNumber,
          posOrderNumber,
          totalAmount: totalAmount.toString(),
          itemsCount: orderItemsData.length,
          customerName: data.customerName,
          channel: onlineOrder.channel
        },
        ipAddress,
        userAgent
      });

      return {
        onlineOrder,
        restaurantOrderId: restaurantOrder.id,
        posOrderNumber,
        ticketNumber
      };
    }, { timeout: 20000, maxWait: 10000 });
  }

  // ==========================================
  // 4. SETTLE DIGITAL PAYMENT (PAY NOW / PAY AT COUNTER)
  // ==========================================
  public static async settleOnlinePayment(
    companyId: string,
    data: {
      orderId: string;
      paymentMethod: 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'PAY_AT_COUNTER' | 'ROOM_POSTING';
      transactionRef?: string;
      roomBookingId?: string;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const onlineOrder = await prisma.onlineOrder.findUnique({
      where: { id: data.orderId },
      include: {
        customer: true,
        branch: true
      }
    });

    if (!onlineOrder || onlineOrder.companyId !== companyId) {
      throw new AppError('Online order not found', 404);
    }

    if (onlineOrder.status === 'COMPLETED') {
      throw new AppError('This order is already settled and completed', 400);
    }

    // Find linked RestaurantOrder
    const posOrder = await prisma.restaurantOrder.findFirst({
      where: {
        companyId,
        notes: { contains: `[QR Online #${onlineOrder.orderNumber}]` }
      }
    });

    // If Pay Now (UPI / Card): complete full checkout cycle
    if (data.paymentMethod === 'UPI' || data.paymentMethod === 'CREDIT_CARD' || data.paymentMethod === 'DEBIT_CARD') {
      if (posOrder && posOrder.status !== 'PAID') {
        await RestaurantService.completeOrderCheckout({
          companyId,
          orderId: posOrder.id,
          paymentMethod: data.paymentMethod,
          amount: Number(onlineOrder.totalAmount),
          transactionRef: data.transactionRef,
          cashierId: actorId,
          ipAddress,
          userAgent
        });
      }

      const updated = await prisma.onlineOrder.update({
        where: { id: onlineOrder.id },
        data: { status: 'COMPLETED' },
        include: { items: { include: { menuItem: true } } }
      });

      await AuditService.log({
        userId: actorId,
        action: 'ONLINE_ORDER_SETTLED',
        entity: 'OnlineOrder',
        entityId: onlineOrder.id,
        details: {
          orderNumber: onlineOrder.orderNumber,
          paymentMethod: data.paymentMethod,
          amount: onlineOrder.totalAmount.toString(),
          transactionRef: data.transactionRef
        },
        ipAddress,
        userAgent
      });

      return {
        onlineOrder: updated,
        isSettled: true,
        invoiceNumber: `INV-${posOrder?.orderNumber || onlineOrder.orderNumber}`
      };
    } else {
      // Pay at counter / Room charge -> Mark CONFIRMED in kitchen
      const updated = await prisma.onlineOrder.update({
        where: { id: onlineOrder.id },
        data: { status: 'CONFIRMED' }
      });

      return {
        onlineOrder: updated,
        isSettled: false,
        message: 'Order confirmed. Please pay at counter or charge to room during checkout.'
      };
    }
  }

  // ==========================================
  // 5. LIVE ORDER TRACKING
  // ==========================================
  public static async trackOrder(orderNumber: string) {
    const order = await prisma.onlineOrder.findUnique({
      where: { orderNumber },
      include: {
        items: { include: { menuItem: true } },
        customer: true,
        branch: { select: { id: true, name: true, code: true, address: true } }
      }
    });

    if (!order) throw new AppError('Order not found', 404);

    // Get linked KDS ticket status if available
    const linkedKds = await prisma.kitchenTicket.findFirst({
      where: {
        order: { notes: { contains: `[QR Online #${order.orderNumber}]` } }
      },
      include: { items: true }
    });

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      channel: order.channel,
      subTotal: Number(order.subTotal),
      taxAmount: Number(order.taxAmount),
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt,
      customer: {
        name: order.customer?.name,
        phone: order.customer?.phone
      },
      branch: order.branch,
      items: order.items.map((i) => ({
        name: i.menuItem.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        notes: i.notes
      })),
      kdsTicket: linkedKds
        ? {
            ticketNumber: linkedKds.ticketNumber,
            status: linkedKds.status,
            station: linkedKds.station
          }
        : null
    };
  }

  // ==========================================
  // 6. BRANCH TABLES QR LIST (ADMIN VIEW)
  // ==========================================
  public static async getBranchTablesQR(companyId: string, branchId: string) {
    const tables = await prisma.diningTable.findMany({
      where: { companyId, branchId, isActive: true },
      include: {
        qrSessions: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          take: 1
        }
      },
      orderBy: [{ section: 'asc' }, { tableNumber: 'asc' }]
    });

    return tables.map((t) => {
      const activeSession = t.qrSessions[0];
      const token = activeSession ? activeSession.sessionToken : `QR-${t.tableNumber.replace(/\s+/g, '')}`;
      return {
        tableId: t.id,
        tableNumber: t.tableNumber,
        tableName: t.name || `Table ${t.tableNumber}`,
        section: t.section,
        capacity: t.capacity,
        status: t.status,
        sessionToken: token,
        orderUrl: `/order?token=${token}`,
        hasActiveSession: !!activeSession
      };
    });
  }

  // ==========================================
  // 7. ONLINE ORDERS STREAM
  // ==========================================
  public static async getOnlineOrders(
    companyId: string,
    filters?: {
      branchId?: string;
      status?: OnlineOrderStatus;
    }
  ) {
    return prisma.onlineOrder.findMany({
      where: {
        companyId,
        ...(filters?.branchId ? { branchId: filters.branchId } : {}),
        ...(filters?.status ? { status: filters.status } : {})
      },
      include: {
        items: { include: { menuItem: true } },
        customer: true,
        branch: { select: { id: true, name: true, code: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
