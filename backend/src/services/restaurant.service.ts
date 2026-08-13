import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { AccountingService } from './accounting.service';

export class RestaurantService {
  // ==========================================
  // MENU & MENU ITEMS
  // ==========================================

  public static async getMenus(companyId: string, branchId?: string) {
    return prisma.menu.findMany({
      where: {
        companyId,
        isActive: true,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {})
      },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItems: {
              where: { isAvailable: true },
              include: {
                recipe: {
                  include: {
                    ingredients: { include: { rawItem: true, unit: true } }
                  }
                },
                finishedItem: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async createMenu(
    companyId: string,
    data: { branchId?: string | null; name: string; code: string; description?: string },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.menu.findFirst({
      where: { companyId, code: data.code.toUpperCase() }
    });
    if (existing) {
      throw new AppError(`Menu with code "${data.code}" already exists`, 409);
    }

    const menu = await prisma.menu.create({
      data: {
        companyId,
        branchId: data.branchId || null,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'MENU_CREATE',
      entity: 'Menu',
      entityId: menu.id,
      details: { name: menu.name, code: menu.code },
      ipAddress,
      userAgent
    });

    return menu;
  }

  public static async createMenuCategory(
    companyId: string,
    data: { menuId: string; name: string; code: string; sortOrder?: number; icon?: string },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const menu = await prisma.menu.findFirst({ where: { id: data.menuId, companyId } });
    if (!menu) throw new AppError('Menu not found', 404);

    const category = await prisma.menuCategory.create({
      data: {
        menuId: data.menuId,
        name: data.name,
        code: data.code.toUpperCase(),
        sortOrder: data.sortOrder || 0,
        icon: data.icon
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'MENU_CATEGORY_CREATE',
      entity: 'MenuCategory',
      entityId: category.id,
      details: { name: category.name, menu: menu.name },
      ipAddress,
      userAgent
    });

    return category;
  }

  public static async getMenuItems(
    companyId: string,
    params: { menuId?: string; categoryId?: string; search?: string; station?: any }
  ) {
    return prisma.menuItem.findMany({
      where: {
        companyId,
        isAvailable: true,
        ...(params.menuId ? { menuId: params.menuId } : {}),
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.station ? { kitchenStation: params.station } : {}),
        ...(params.search
          ? {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { code: { contains: params.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: {
        category: true,
        recipe: {
          include: {
            ingredients: { include: { rawItem: true, unit: true } }
          }
        },
        finishedItem: true
      },
      orderBy: { name: 'asc' }
    });
  }

  public static async createMenuItem(
    companyId: string,
    data: {
      menuId: string;
      categoryId: string;
      finishedItemId?: string | null;
      recipeId?: string | null;
      name: string;
      code: string;
      description?: string;
      price: number;
      costPrice?: number;
      taxRate?: number;
      kitchenStation?: any;
      preparationMinutes?: number;
      imageUrl?: string;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.menuItem.findFirst({
      where: { companyId, code: data.code.toUpperCase() }
    });
    if (existing) {
      throw new AppError(`Menu item with code "${data.code}" already exists`, 409);
    }

    // If recipe is attached, calculate live costPrice from BOM
    let estimatedCost = data.costPrice ? new Prisma.Decimal(data.costPrice) : new Prisma.Decimal(0);
    if (data.recipeId) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: data.recipeId },
        include: { ingredients: { include: { rawItem: true } } }
      });
      if (recipe) {
        let totalCost = new Prisma.Decimal(0);
        for (const ing of recipe.ingredients) {
          totalCost = totalCost.plus(ing.quantity.times(ing.rawItem.costPrice));
        }
        estimatedCost = recipe.yieldQty.isZero() ? totalCost : totalCost.dividedBy(recipe.yieldQty);
      }
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        companyId,
        menuId: data.menuId,
        categoryId: data.categoryId,
        finishedItemId: data.finishedItemId || null,
        recipeId: data.recipeId || null,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        price: new Prisma.Decimal(data.price),
        costPrice: estimatedCost,
        taxRate: new Prisma.Decimal(data.taxRate || 0),
        kitchenStation: data.kitchenStation || 'MAIN_KITCHEN',
        preparationMinutes: data.preparationMinutes || 15,
        imageUrl: data.imageUrl
      },
      include: {
        category: true,
        recipe: true,
        finishedItem: true
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'MENU_ITEM_CREATE',
      entity: 'MenuItem',
      entityId: menuItem.id,
      details: { name: menuItem.name, price: data.price, costPrice: estimatedCost.toString() },
      ipAddress,
      userAgent
    });

    return menuItem;
  }

  // ==========================================
  // TABLE MANAGEMENT
  // ==========================================

  public static async getTables(companyId: string, branchId: string) {
    return prisma.diningTable.findMany({
      where: { companyId, branchId, isActive: true },
      include: {
        orders: {
          where: { status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY', 'SERVED'] } },
          include: {
            items: { include: { menuItem: true } },
            waiter: { select: { id: true, firstName: true, lastName: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: [{ section: 'asc' }, { tableNumber: 'asc' }]
    });
  }

  public static async createTable(
    companyId: string,
    data: { branchId: string; tableNumber: string; name?: string; capacity?: number; section?: string },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.diningTable.findUnique({
      where: {
        branchId_tableNumber: {
          branchId: data.branchId,
          tableNumber: data.tableNumber
        }
      }
    });
    if (existing) {
      throw new AppError(`Table number "${data.tableNumber}" already exists in this branch`, 409);
    }

    const table = await prisma.diningTable.create({
      data: {
        companyId,
        branchId: data.branchId,
        tableNumber: data.tableNumber,
        name: data.name || `Table ${data.tableNumber}`,
        capacity: data.capacity || 4,
        section: data.section || 'Main Dining',
        status: 'AVAILABLE'
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'DINING_TABLE_CREATE',
      entity: 'DiningTable',
      entityId: table.id,
      details: { tableNumber: table.tableNumber, section: table.section },
      ipAddress,
      userAgent
    });

    return table;
  }

  public static async updateTableStatus(
    companyId: string,
    tableId: string,
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'BLOCKED',
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const table = await prisma.diningTable.findFirst({ where: { id: tableId, companyId } });
    if (!table) throw new AppError('Dining table not found', 404);

    const updated = await prisma.diningTable.update({
      where: { id: tableId },
      data: { status }
    });

    await AuditService.log({
      userId: actorId,
      action: 'TABLE_STATUS_UPDATE',
      entity: 'DiningTable',
      entityId: tableId,
      details: { before: table.status, after: status },
      ipAddress,
      userAgent
    });

    return updated;
  }

  public static async mergeTables(
    companyId: string,
    sourceTableId: string,
    targetTableId: string,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const [sourceTable, targetTable] = await Promise.all([
        tx.diningTable.findFirst({
          where: { id: sourceTableId, companyId },
          include: {
            orders: {
              where: { status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY', 'SERVED'] } },
              include: { items: true }
            }
          }
        }),
        tx.diningTable.findFirst({
          where: { id: targetTableId, companyId },
          include: {
            orders: {
              where: { status: { in: ['OPEN', 'SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY', 'SERVED'] } },
              include: { items: true }
            }
          }
        })
      ]);

      if (!sourceTable || !targetTable) {
        throw new AppError('Invalid source or target table', 404);
      }

      const sourceOrder = sourceTable.orders[0];
      const targetOrder = targetTable.orders[0];

      if (!sourceOrder) {
        throw new AppError('Source table has no active order to merge', 400);
      }

      if (targetOrder) {
        // Move all items from sourceOrder to targetOrder
        for (const item of sourceOrder.items) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { orderId: targetOrder.id }
          });
        }
        // Cancel empty source order
        await tx.restaurantOrder.update({
          where: { id: sourceOrder.id },
          data: { status: 'CANCELLED', notes: `Merged into Order ${targetOrder.orderNumber}` }
        });

        // Recalculate target order totals
        const allItems = await tx.orderItem.findMany({ where: { orderId: targetOrder.id } });
        let subtotal = new Prisma.Decimal(0);
        for (const it of allItems) {
          subtotal = subtotal.plus(it.totalPrice);
        }
        const taxAmount = subtotal.times(0.05); // 5% default standard tax
        const grandTotal = subtotal.plus(taxAmount).minus(targetOrder.discountAmount);

        await tx.restaurantOrder.update({
          where: { id: targetOrder.id },
          data: { subtotal, taxAmount, grandTotal }
        });
      } else {
        // Just reassign sourceOrder to targetTable
        await tx.restaurantOrder.update({
          where: { id: sourceOrder.id },
          data: { tableId: targetTableId }
        });
      }

      // Mark source table AVAILABLE, target table OCCUPIED
      await tx.diningTable.update({
        where: { id: sourceTableId },
        data: { status: 'AVAILABLE', activeOrderId: null }
      });
      await tx.diningTable.update({
        where: { id: targetTableId },
        data: { status: 'OCCUPIED', activeOrderId: targetOrder ? targetOrder.id : sourceOrder.id }
      });

      await AuditService.log({
        userId: actorId,
        action: 'TABLE_MERGE',
        entity: 'DiningTable',
        entityId: targetTableId,
        details: { sourceTable: sourceTable.tableNumber, targetTable: targetTable.tableNumber },
        ipAddress,
        userAgent
      });

      return { message: `Tables ${sourceTable.tableNumber} and ${targetTable.tableNumber} merged successfully` };
    }, { maxWait: 10000, timeout: 30000 });
  }

  // ==========================================
  // POS ORDER LIFECYCLE & KDS
  // ==========================================

  public static async createOrder(
    companyId: string,
    branchId: string,
    data: {
      tableId?: string | null;
      orderType?: any;
      guestCount?: number;
      customerName?: string;
      customerPhone?: string;
      notes?: string;
      items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
    },
    waiterId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const orderCount = await tx.restaurantOrder.count({ where: { companyId } });
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

      // Fetch MenuItems with recipes for live cost & price calculations
      const itemIds = data.items.map((i) => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: itemIds }, companyId },
        include: {
          recipe: {
            include: { ingredients: { include: { rawItem: true } } }
          },
          finishedItem: true
        }
      });

      const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

      let subtotal = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);
      const orderItemsToCreate: any[] = [];

      for (const line of data.items) {
        const menuItem = menuItemMap.get(line.menuItemId);
        if (!menuItem) throw new AppError(`MenuItem not found: ${line.menuItemId}`, 404);

        const qty = new Prisma.Decimal(line.quantity);
        const linePrice = menuItem.price.times(qty);
        const lineTax = linePrice.times(menuItem.taxRate.dividedBy(100));

        // Compute COGS
        let lineCogs = new Prisma.Decimal(0);
        if (menuItem.recipe) {
          let recipeRawCost = new Prisma.Decimal(0);
          for (const ing of menuItem.recipe.ingredients) {
            recipeRawCost = recipeRawCost.plus(ing.quantity.times(ing.rawItem.costPrice));
          }
          const unitCost = menuItem.recipe.yieldQty.isZero() ? recipeRawCost : recipeRawCost.dividedBy(menuItem.recipe.yieldQty);
          lineCogs = unitCost.times(qty);
        } else if (menuItem.finishedItem) {
          lineCogs = menuItem.finishedItem.costPrice.times(qty);
        } else {
          lineCogs = menuItem.costPrice.times(qty);
        }

        subtotal = subtotal.plus(linePrice);
        totalTax = totalTax.plus(lineTax);

        orderItemsToCreate.push({
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: qty,
          unitPrice: menuItem.price,
          totalPrice: linePrice,
          cogsAmount: lineCogs,
          notes: line.notes,
          status: 'PENDING'
        });
      }

      const grandTotal = subtotal.plus(totalTax);

      const order = await tx.restaurantOrder.create({
        data: {
          companyId,
          branchId,
          orderNumber,
          tableId: data.tableId || null,
          orderType: data.orderType || 'DINE_IN',
          status: 'OPEN',
          guestCount: data.guestCount || 1,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          subtotal,
          taxAmount: totalTax,
          grandTotal,
          waiterId,
          notes: data.notes,
          items: {
            create: orderItemsToCreate
          }
        },
        include: {
          items: { include: { menuItem: true } },
          table: true
        }
      });

      if (data.tableId) {
        await tx.diningTable.update({
          where: { id: data.tableId },
          data: { status: 'OCCUPIED', activeOrderId: order.id }
        });
      }

      await AuditService.log({
        userId: waiterId,
        action: 'RESTAURANT_ORDER_CREATE',
        entity: 'RestaurantOrder',
        entityId: order.id,
        details: { orderNumber, total: grandTotal.toString(), itemCount: data.items.length },
        ipAddress,
        userAgent
      });

      return order;
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async sendOrderToKitchen(
    companyId: string,
    orderId: string,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.restaurantOrder.findFirst({
        where: { id: orderId, companyId },
        include: {
          items: {
            where: { status: 'PENDING' },
            include: { menuItem: true }
          },
          table: true
        }
      });

      if (!order) throw new AppError('Order not found', 404);
      if (order.items.length === 0) {
        throw new AppError('No pending items to send to kitchen', 400);
      }

      // Group items by Kitchen Station (Main Kitchen, Pizza, Grill, Bar, etc.)
      const stationMap = new Map<any, typeof order.items>();
      for (const item of order.items) {
        const station = item.menuItem.kitchenStation || 'MAIN_KITCHEN';
        if (!stationMap.has(station)) {
          stationMap.set(station, []);
        }
        stationMap.get(station)!.push(item);
      }

      const createdTickets: any[] = [];
      const ticketBaseCount = await tx.kitchenTicket.count({ where: { branchId: order.branchId } });
      let counter = ticketBaseCount + 1;

      for (const [station, items] of stationMap.entries()) {
        const ticketNumber = `KT-${new Date().getFullYear()}-${String(counter++).padStart(5, '0')}`;

        const ticket = await tx.kitchenTicket.create({
          data: {
            ticketNumber,
            orderId: order.id,
            branchId: order.branchId,
            station,
            status: 'PENDING',
            ticketType: 'NEW_ORDER',
            notes: order.notes,
            items: {
              create: items.map((it) => ({
                orderItemId: it.id,
                quantity: it.quantity,
                notes: it.notes,
                status: 'PENDING'
              }))
            }
          },
          include: {
            items: { include: { orderItem: true } }
          }
        });

        createdTickets.push(ticket);

        // Update items status to PREPARING
        await tx.orderItem.updateMany({
          where: { id: { in: items.map((i) => i.id) } },
          data: { status: 'PREPARING' }
        });
      }

      // Update Order Status
      await tx.restaurantOrder.update({
        where: { id: orderId },
        data: { status: 'IN_PREPARATION' }
      });

      if (order.tableId) {
        await tx.diningTable.update({
          where: { id: order.tableId },
          data: { status: 'OCCUPIED' }
        });
      }

      await AuditService.log({
        userId: actorId,
        action: 'KITCHEN_TICKETS_SENT',
        entity: 'RestaurantOrder',
        entityId: orderId,
        details: { orderNumber: order.orderNumber, ticketsGenerated: createdTickets.length },
        ipAddress,
        userAgent
      });

      return {
        orderId: order.id,
        tickets: createdTickets
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async getKitchenTickets(
    companyId: string,
    params: { branchId?: string; station?: any; status?: any }
  ) {
    return prisma.kitchenTicket.findMany({
      where: {
        order: { companyId },
        ...(params.branchId ? { branchId: params.branchId } : {}),
        ...(params.station ? { station: params.station } : {}),
        ...(params.status ? { status: params.status } : { status: { notIn: ['SERVED', 'CANCELLED'] } })
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            table: { select: { tableNumber: true, name: true, section: true } },
            waiter: { select: { firstName: true, lastName: true } },
            createdAt: true
          }
        },
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: { select: { name: true, code: true, preparationMinutes: true } }
              }
            }
          }
        }
      },
      orderBy: { sentAt: 'asc' }
    });
  }

  public static async updateKitchenTicketStatus(
    companyId: string,
    ticketId: string,
    status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED',
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.kitchenTicket.findFirst({
        where: { id: ticketId, order: { companyId } },
        include: { items: true, order: true }
      });
      if (!ticket) throw new AppError('Kitchen ticket not found', 404);

      const timestamps: any = {};
      if (status === 'PREPARING') timestamps.preparingAt = new Date();
      if (status === 'READY') timestamps.readyAt = new Date();
      if (status === 'SERVED') timestamps.servedAt = new Date();

      const updatedTicket = await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: {
          status,
          ...timestamps
        }
      });

      // Update related order items status
      const itemStatus = status === 'PREPARING' ? 'PREPARING' : status === 'READY' ? 'READY' : status === 'SERVED' ? 'SERVED' : 'CANCELLED';
      await tx.orderItem.updateMany({
        where: { id: { in: ticket.items.map((i) => i.orderItemId) } },
        data: { status: itemStatus }
      });

      // If all tickets for the order are READY or SERVED, update order overall status
      const otherTickets = await tx.kitchenTicket.findMany({
        where: { orderId: ticket.orderId, id: { not: ticketId } }
      });
      const allReady = otherTickets.every((t) => t.status === 'READY' || t.status === 'SERVED') && (status === 'READY' || status === 'SERVED');
      const allServed = otherTickets.every((t) => t.status === 'SERVED') && status === 'SERVED';

      if (allServed) {
        await tx.restaurantOrder.update({ where: { id: ticket.orderId }, data: { status: 'SERVED' } });
      } else if (allReady) {
        await tx.restaurantOrder.update({ where: { id: ticket.orderId }, data: { status: 'READY' } });
      }

      await AuditService.log({
        userId: actorId,
        action: 'KITCHEN_TICKET_STATUS_UPDATE',
        entity: 'KitchenTicket',
        entityId: ticketId,
        details: { ticketNumber: ticket.ticketNumber, station: ticket.station, status },
        ipAddress,
        userAgent
      });

      return updatedTicket;
    }, { maxWait: 10000, timeout: 30000 });
  }

  // ==========================================
  // DISCOUNTS & APPROVALS (SECTION 10 / PART 5 HOOK)
  // ==========================================

  public static async applyDiscount(
    companyId: string,
    orderId: string,
    data: {
      discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COUPON' | 'COMPLIMENTARY';
      rateOrAmount: number;
      reason: string;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.restaurantOrder.findFirst({
        where: { id: orderId, companyId }
      });
      if (!order) throw new AppError('Order not found', 404);
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        throw new AppError(`Cannot apply discount to order with status ${order.status}`, 400);
      }

      let discountAmount = new Prisma.Decimal(0);
      if (data.discountType === 'PERCENTAGE') {
        discountAmount = order.subtotal.times(new Prisma.Decimal(data.rateOrAmount).dividedBy(100));
      } else {
        discountAmount = new Prisma.Decimal(data.rateOrAmount);
      }

      // If discount > 15% or complimentary, flag approval requirement for Manager/Admin
      const approvalRequired = (data.discountType === 'PERCENTAGE' && data.rateOrAmount > 15) || data.discountType === 'COMPLIMENTARY';
      const approvalStatus = approvalRequired ? 'PENDING' : 'APPROVED';

      const discountRecord = await tx.orderDiscount.create({
        data: {
          orderId,
          discountType: data.discountType,
          rateOrAmount: new Prisma.Decimal(data.rateOrAmount),
          amount: discountAmount,
          reason: data.reason,
          authorizedById: actorId || null,
          approvalRequired,
          approvalStatus
        }
      });

      if (approvalStatus === 'APPROVED') {
        const grandTotal = order.subtotal.plus(order.taxAmount).plus(order.serviceCharge).minus(discountAmount);
        await tx.restaurantOrder.update({
          where: { id: orderId },
          data: {
            discountAmount,
            grandTotal: grandTotal.isNegative() ? new Prisma.Decimal(0) : grandTotal
          }
        });
      }

      await AuditService.log({
        userId: actorId,
        action: 'ORDER_DISCOUNT_APPLIED',
        entity: 'OrderDiscount',
        entityId: discountRecord.id,
        details: {
          orderNumber: order.orderNumber,
          discountAmount: discountAmount.toString(),
          approvalRequired
        },
        ipAddress,
        userAgent
      });

      if (approvalRequired) {
        try {
          const { ApprovalService } = await import('./approval.service');
          await ApprovalService.createApprovalRequest(
            companyId,
            {
              branchId: order.branchId,
              transactionType: 'DISCOUNT',
              referenceId: discountRecord.id,
              amount: discountAmount.toNumber(),
              title: `POS Order #${order.orderNumber} Discount Approval (${data.discountType})`,
              description: `High discount of ${data.rateOrAmount} requested. Reason: ${data.reason}`
            },
            actorId || 'system',
            ipAddress,
            userAgent
          );
        } catch (appErr) {
          console.warn('Auto approval request notice:', appErr);
        }
      }

      return {
        discount: discountRecord,
        approvalRequired,
        message: approvalRequired ? 'Discount exceeds threshold and is pending manager approval' : 'Discount applied successfully'
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  // ==========================================
  // FAST POS CHECKOUT, INVENTORY SYNC & ACCOUNTING (SECTION 10)
  // ==========================================

  public static async completeOrderCheckout(params: {
    companyId: string;
    orderId: string;
    paymentMethod: any;
    amount: number;
    receivedAmount?: number;
    transactionRef?: string;
    cardLast4?: string;
    notes?: string;
    cashierId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const {
      companyId,
      orderId,
      paymentMethod,
      amount,
      receivedAmount,
      transactionRef,
      cardLast4,
      notes,
      cashierId,
      ipAddress,
      userAgent
    } = params;

    return prisma.$transaction(async (tx) => {
      // 1. Fetch Order with Items, MenuItems, Recipes and Finished Goods
      const order = await tx.restaurantOrder.findFirst({
        where: { id: orderId, companyId },
        include: {
          items: {
            include: {
              menuItem: {
                include: {
                  recipe: {
                    include: {
                      ingredients: { include: { rawItem: true, unit: true } }
                    }
                  },
                  finishedItem: true
                }
              }
            }
          },
          table: true,
          branch: true
        }
      });

      if (!order) throw new AppError('Order not found', 404);
      if (order.status === 'COMPLETED') {
        throw new AppError('Order is already completed and settled', 400);
      }
      if (order.status === 'CANCELLED') {
        throw new AppError('Cannot settle a cancelled order', 400);
      }

      // 2. Record Payment & calculate change
      const paymentAmount = new Prisma.Decimal(amount);
      const cashReceived = receivedAmount ? new Prisma.Decimal(receivedAmount) : paymentAmount;
      const changeAmount = cashReceived.greaterThan(paymentAmount) ? cashReceived.minus(paymentAmount) : new Prisma.Decimal(0);

      const payment = await tx.payment.create({
        data: {
          orderId,
          amount: paymentAmount,
          method: paymentMethod,
          status: 'SUCCESS',
          receivedAmount: cashReceived,
          changeAmount,
          transactionRef,
          cardLast4
        }
      });

      // 3. Find Kitchen Warehouse for the Branch to decrement ingredients / inventory
      let kitchenWarehouse = await tx.warehouse.findFirst({
        where: { branchId: order.branchId, isActive: true, code: { contains: 'KITCHEN' } }
      });
      if (!kitchenWarehouse) {
        kitchenWarehouse = await tx.warehouse.findFirst({
          where: { branchId: order.branchId, isActive: true }
        });
      }
      if (!kitchenWarehouse) {
        kitchenWarehouse = await tx.warehouse.findFirst({
          where: { companyId, isCentral: true }
        });
      }

      // 4. AUTOMATED RECIPE INGREDIENT & INVENTORY CONSUMPTION (Section 10 Requirement)
      let totalCogs = new Prisma.Decimal(0);

      for (const orderItem of order.items) {
        const menuItem = orderItem.menuItem;
        const itemQty = orderItem.quantity;

        if (menuItem.recipe && kitchenWarehouse) {
          // Consume raw materials from Recipe BOM
          const recipe = menuItem.recipe;
          const recipeMultiplier = itemQty.dividedBy(recipe.yieldQty.isZero() ? 1 : recipe.yieldQty);

          for (const ingredient of recipe.ingredients) {
            const rawQtyToDeduct = ingredient.quantity.times(recipeMultiplier);
            const rawCost = ingredient.rawItem.costPrice.times(rawQtyToDeduct);
            totalCogs = totalCogs.plus(rawCost);

            // Decrement Raw Material Stock Balance in Kitchen Warehouse
            const currentStock = await tx.stockBalance.upsert({
              where: {
                warehouseId_itemId: {
                  warehouseId: kitchenWarehouse.id,
                  itemId: ingredient.rawItemId
                }
              },
              update: {
                quantity: { decrement: rawQtyToDeduct }
              },
              create: {
                warehouseId: kitchenWarehouse.id,
                itemId: ingredient.rawItemId,
                quantity: new Prisma.Decimal(0).minus(rawQtyToDeduct)
              }
            });

            // Write Immutable Stock Ledger entry
            await tx.stockLedger.create({
              data: {
                warehouseId: kitchenWarehouse.id,
                itemId: ingredient.rawItemId,
                movementType: 'POS_SALE',
                changeQty: new Prisma.Decimal(0).minus(rawQtyToDeduct),
                balanceQty: currentStock.quantity,
                unitCost: ingredient.rawItem.costPrice,
                totalCost: rawCost,
                referenceType: 'POS_SALE',
                referenceId: order.id,
                notes: `POS Sale auto-consumption for Order ${order.orderNumber} (${menuItem.name} x ${itemQty})`,
                createdById: cashierId
              }
            });
          }
        } else if (menuItem.finishedItemId && kitchenWarehouse) {
          // Direct finished good retail item (e.g. bottled beverage, retail pack)
          const itemCost = menuItem.finishedItem!.costPrice.times(itemQty);
          totalCogs = totalCogs.plus(itemCost);

          const currentStock = await tx.stockBalance.upsert({
            where: {
              warehouseId_itemId: {
                warehouseId: kitchenWarehouse.id,
                itemId: menuItem.finishedItemId
              }
            },
            update: {
              quantity: { decrement: itemQty }
            },
            create: {
              warehouseId: kitchenWarehouse.id,
              itemId: menuItem.finishedItemId,
              quantity: new Prisma.Decimal(0).minus(itemQty)
            }
          });

          await tx.stockLedger.create({
            data: {
              warehouseId: kitchenWarehouse.id,
              itemId: menuItem.finishedItemId,
              movementType: 'POS_SALE',
              changeQty: new Prisma.Decimal(0).minus(itemQty),
              balanceQty: currentStock.quantity,
              unitCost: menuItem.finishedItem!.costPrice,
              totalCost: itemCost,
              referenceType: 'POS_SALE',
              referenceId: order.id,
              notes: `POS Sale direct retail for Order ${order.orderNumber}`,
              createdById: cashierId
            }
          });
        } else {
          totalCogs = totalCogs.plus(menuItem.costPrice.times(itemQty));
        }
      }

      // 5. Update Order Status to COMPLETED
      await tx.restaurantOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          paidAmount: paymentAmount,
          cashierId
        }
      });

      // 6. Free up Table and mark CLEANING
      if (order.tableId) {
        await tx.diningTable.update({
          where: { id: order.tableId },
          data: { status: 'CLEANING', activeOrderId: null }
        });
      }

      // 7. Create SalesRecord
      const invoiceNumber = `INV-${order.orderNumber}`;
      const netSales = order.subtotal.minus(order.discountAmount);
      const grossProfit = netSales.minus(totalCogs);

      const salesRecord = await tx.salesRecord.create({
        data: {
          companyId,
          branchId: order.branchId,
          orderId: order.id,
          invoiceNumber,
          orderType: order.orderType,
          grossSales: order.subtotal,
          discountAmount: order.discountAmount,
          netSales,
          taxAmount: order.taxAmount,
          serviceCharge: order.serviceCharge,
          grandTotal: order.grandTotal,
          totalCogs,
          grossProfit,
          paymentMethod
        }
      });

      // 8. Create Accounting Entry Stub (Journal Hook ready for Part 4 Full Accounting Module)
      const accountingStubCount = await tx.accountingEntryStub.count({ where: { companyId } });
      const entryNumber = `JE-POS-${new Date().getFullYear()}-${String(accountingStubCount + 1).padStart(6, '0')}`;

      await tx.accountingEntryStub.create({
        data: {
          companyId,
          branchId: order.branchId,
          orderId: order.id,
          entryNumber,
          referenceType: 'POS_SALE',
          referenceId: order.id,
          debitAccountCode: paymentMethod === 'CASH' ? '1010' : '1020',
          debitAccountName: paymentMethod === 'CASH' ? 'Cash on Hand (POS)' : 'Bank / Card Clearing Account',
          creditAccountCode: '4010',
          creditAccountName: 'Food & Beverage Sales Revenue',
          amount: order.grandTotal,
          narration: `POS Sale settlement for Order ${order.orderNumber} (Invoice: ${invoiceNumber})`
        }
      });

      // 8.1 Post Real Double-Entry General Ledger Journal Entry via AccountingService
      try {
        await AccountingService.recordPosSaleJournal({
          companyId,
          branchId: order.branchId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          grandTotal: order.grandTotal,
          taxAmount: order.taxAmount,
          totalCogs,
          paymentMethod,
          actorId: cashierId
        });
      } catch (accErr) {
        console.warn('Auto GL Posting non-fatal notice:', accErr);
      }

      // 9. Write AuditLog
      await AuditService.log({
        userId: cashierId,
        action: 'ORDER_CHECKOUT_COMPLETED',
        entity: 'RestaurantOrder',
        entityId: order.id,
        details: {
          orderNumber: order.orderNumber,
          grandTotal: order.grandTotal.toString(),
          paymentMethod,
          totalCogs: totalCogs.toString(),
          grossProfit: grossProfit.toString()
        },
        ipAddress,
        userAgent
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber,
        grandTotal: order.grandTotal,
        payment,
        salesRecord,
        changeAmount,
        message: 'Order completed, inventory deducted per recipe, and sales recorded successfully!'
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  // ==========================================
  // SALES REPORTS & AGGREGATES
  // ==========================================

  public static async getSalesAnalytics(
    companyId: string,
    params: { branchId?: string; startDate?: string; endDate?: string }
  ) {
    const start = params.startDate ? new Date(params.startDate) : new Date(Date.now() - 30 * 86400000);
    const end = params.endDate ? new Date(params.endDate) : new Date();

    const sales = await prisma.salesRecord.findMany({
      where: {
        companyId,
        ...(params.branchId ? { branchId: params.branchId } : {}),
        saleDate: { gte: start, lte: end }
      },
      include: {
        order: {
          include: {
            items: { include: { menuItem: true } }
          }
        },
        branch: { select: { id: true, name: true, code: true } }
      },
      orderBy: { saleDate: 'desc' }
    });

    let totalRevenue = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);
    let totalCogs = new Prisma.Decimal(0);
    let totalProfit = new Prisma.Decimal(0);

    const paymentBreakdown: Record<string, number> = {};
    const itemSalesCount: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const s of sales) {
      totalRevenue = totalRevenue.plus(s.grandTotal);
      totalDiscount = totalDiscount.plus(s.discountAmount);
      totalTax = totalTax.plus(s.taxAmount);
      totalCogs = totalCogs.plus(s.totalCogs);
      totalProfit = totalProfit.plus(s.grossProfit);

      paymentBreakdown[s.paymentMethod] = (paymentBreakdown[s.paymentMethod] || 0) + Number(s.grandTotal);

      if (s.order?.items) {
        for (const it of s.order.items) {
          const key = it.menuItemId;
          if (!itemSalesCount[key]) {
            itemSalesCount[key] = { name: it.name, quantity: 0, revenue: 0 };
          }
          itemSalesCount[key].quantity += Number(it.quantity);
          itemSalesCount[key].revenue += Number(it.totalPrice);
        }
      }
    }

    const topSellingItems = Object.values(itemSalesCount)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      summary: {
        totalOrders: sales.length,
        totalRevenue,
        totalDiscount,
        totalTax,
        totalCogs,
        totalProfit,
        foodCostPercentage: totalRevenue.isZero() ? 0 : Number(totalCogs.dividedBy(totalRevenue).times(100).toFixed(2)),
        averageTicketSize: sales.length > 0 ? Number(totalRevenue.dividedBy(sales.length).toFixed(2)) : 0
      },
      paymentBreakdown,
      topSellingItems,
      recentSales: sales.slice(0, 20)
    };
  }
}
