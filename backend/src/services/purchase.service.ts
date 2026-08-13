import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { AccountingService } from './accounting.service';
import { ApprovalService } from './approval.service';
import { Prisma, PRStatus, PRPriority, POStatus, GRNStatus, QCStatus, SupplierTxType } from '@prisma/client';

export class PurchaseService {
  // -------------------------------------------------------------
  // SUPPLIER MANAGEMENT & SUPPLIER LEDGER
  // -------------------------------------------------------------

  public static async getSuppliers(
    companyId: string,
    params: { search?: string; isActive?: boolean; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      companyId,
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { contactPerson: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { purchaseOrders: true, grns: true } }
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      })
    ]);

    return {
      suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public static async createSupplier(
    companyId: string,
    data: {
      name: string;
      code: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      taxNumber?: string;
      paymentTerms?: string;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.supplier.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) {
      throw new AppError(`Supplier with code "${data.code}" already exists`, 400);
    }

    const supplier = await prisma.supplier.create({
      data: {
        companyId,
        name: data.name,
        code: data.code.toUpperCase(),
        contactPerson: data.contactPerson,
        email: data.email || null,
        phone: data.phone,
        address: data.address,
        taxNumber: data.taxNumber,
        paymentTerms: data.paymentTerms || 'Net 30'
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'SUPPLIER_CREATE',
      entity: 'Supplier',
      entityId: supplier.id,
      details: { name: supplier.name, code: supplier.code },
      ipAddress,
      userAgent
    });

    return supplier;
  }

  public static async updateSupplier(
    companyId: string,
    id: string,
    data: Partial<{
      name: string;
      code: string;
      contactPerson: string;
      email: string;
      phone: string;
      address: string;
      taxNumber: string;
      paymentTerms: string;
      isActive: boolean;
    }>,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.supplier.findFirst({ where: { id, companyId } });
    if (!existing) {
      throw new AppError('Supplier not found', 404);
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.code ? { code: data.code.toUpperCase() } : {}),
        ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.taxNumber !== undefined ? { taxNumber: data.taxNumber } : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'SUPPLIER_UPDATE',
      entity: 'Supplier',
      entityId: id,
      details: { before: existing, after: updated },
      ipAddress,
      userAgent
    });

    return updated;
  }

  public static async getSupplierLedger(
    companyId: string,
    supplierId: string,
    params: { page?: number; limit?: number }
  ) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId }
    });
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 30));
    const skip = (page - 1) * limit;

    const [total, entries] = await Promise.all([
      prisma.supplierLedger.count({ where: { supplierId } }),
      prisma.supplierLedger.findMany({
        where: { supplierId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      supplier,
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // -------------------------------------------------------------
  // PURCHASE REQUESTS (PR)
  // -------------------------------------------------------------

  public static async getPurchaseRequests(
    companyId: string,
    params: { branchId?: string; status?: PRStatus; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseRequestWhereInput = {
      companyId,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.status ? { status: params.status } : {})
    };

    const [total, requests] = await Promise.all([
      prisma.purchaseRequest.count({ where }),
      prisma.purchaseRequest.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  costPrice: true,
                  unit: { select: { symbol: true } }
                }
              }
            }
          },
          purchaseOrders: { select: { id: true, poNumber: true, status: true } }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public static async createPurchaseRequest(
    companyId: string,
    branchId: string,
    data: {
      requiredDate: string;
      priority?: PRPriority;
      notes?: string;
      items: Array<{ itemId: string; requestedQty: number; estimatedPrice?: number; notes?: string }>;
    },
    requesterId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const count = await prisma.purchaseRequest.count({ where: { companyId } });
    const requestNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const request = await prisma.purchaseRequest.create({
      data: {
        companyId,
        branchId,
        requestNumber,
        requestedById: requesterId,
        requiredDate: new Date(data.requiredDate),
        priority: data.priority || 'MEDIUM',
        status: 'PENDING_APPROVAL',
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            itemId: item.itemId,
            requestedQty: new Prisma.Decimal(item.requestedQty),
            estimatedPrice: new Prisma.Decimal(item.estimatedPrice || 0),
            notes: item.notes
          }))
        }
      },
      include: {
        items: { include: { item: true } }
      }
    });

    await AuditService.log({
      userId: requesterId,
      action: 'PURCHASE_REQUEST_CREATE',
      entity: 'PurchaseRequest',
      entityId: request.id,
      details: { requestNumber, itemCount: data.items.length, priority: request.priority },
      ipAddress,
      userAgent
    });

    // Wire Real Approval Center (Section 13)
    try {
      await ApprovalService.createApprovalRequest(
        companyId,
        {
          branchId: request.branchId,
          transactionType: 'PURCHASE_REQUEST',
          referenceId: request.id,
          title: `Purchase Request #${requestNumber} (${data.priority})`,
          description: `PR with ${data.items.length} items requested by staff`
        },
        requesterId,
        ipAddress,
        userAgent
      );
    } catch (appErr) {
      console.warn('Auto approval request notice:', appErr);
    }

    return request;
  }

  public static async approvePurchaseRequest(
    companyId: string,
    requestId: string,
    approverId: string,
    options: { autoCreatePO?: boolean; supplierId?: string; notes?: string },
    ipAddress?: string,
    userAgent?: string
  ) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, companyId },
      include: { items: { include: { item: true } } }
    });

    if (!pr) {
      throw new AppError('Purchase request not found', 404);
    }
    if (pr.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Cannot approve request with status "${pr.status}"`, 400);
    }

    return prisma.$transaction(async (tx) => {
      let createdPO = null;

      if (options.autoCreatePO && options.supplierId) {
        const poCount = await tx.purchaseOrder.count({ where: { companyId } });
        const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, '0')}`;

        const totalAmount = pr.items.reduce((sum, item) => {
          const price = item.estimatedPrice.isZero() ? item.item.costPrice : item.estimatedPrice;
          return sum.plus(item.requestedQty.times(price));
        }, new Prisma.Decimal(0));

        createdPO = await tx.purchaseOrder.create({
          data: {
            companyId,
            branchId: pr.branchId,
            supplierId: options.supplierId,
            requestId: pr.id,
            poNumber,
            status: 'ISSUED',
            totalAmount,
            taxAmount: new Prisma.Decimal(0),
            grandTotal: totalAmount,
            notes: `Auto-generated from ${pr.requestNumber}. ${options.notes || ''}`,
            createdById: approverId,
            items: {
              create: pr.items.map((it) => {
                const unitPrice = it.estimatedPrice.isZero() ? it.item.costPrice : it.estimatedPrice;
                return {
                  itemId: it.itemId,
                  orderedQty: it.requestedQty,
                  unitPrice,
                  totalPrice: it.requestedQty.times(unitPrice),
                  notes: it.notes
                };
              })
            }
          },
          include: {
            items: true
          }
        });
      }

      const updatedPR = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: createdPO ? 'ORDERED' : 'APPROVED',
          approvedById: approverId,
          approvedAt: new Date()
        },
        include: {
          items: true,
          purchaseOrders: true
        }
      });

      await AuditService.log({
        userId: approverId,
        action: 'PURCHASE_REQUEST_APPROVED',
        entity: 'PurchaseRequest',
        entityId: requestId,
        details: {
          requestNumber: pr.requestNumber,
          autoCreatedPO: createdPO ? createdPO.poNumber : null
        },
        ipAddress,
        userAgent
      });

      return {
        purchaseRequest: updatedPR,
        purchaseOrder: createdPO
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async rejectPurchaseRequest(
    companyId: string,
    requestId: string,
    approverId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: requestId, companyId }
    });
    if (!pr) {
      throw new AppError('Purchase request not found', 404);
    }
    if (pr.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Cannot reject request with status "${pr.status}"`, 400);
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approvedById: approverId,
        approvedAt: new Date(),
        rejectionReason: reason
      }
    });

    await AuditService.log({
      userId: approverId,
      action: 'PURCHASE_REQUEST_REJECTED',
      entity: 'PurchaseRequest',
      entityId: requestId,
      details: { requestNumber: pr.requestNumber, reason },
      ipAddress,
      userAgent
    });

    return updated;
  }

  // -------------------------------------------------------------
  // PURCHASE ORDERS (PO)
  // -------------------------------------------------------------

  public static async getPurchaseOrders(
    companyId: string,
    params: { branchId?: string; supplierId?: string; status?: POStatus; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.status ? { status: params.status } : {})
    };

    const [total, orders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          supplier: { select: { id: true, name: true, code: true, phone: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  unit: { select: { symbol: true } }
                }
              }
            }
          },
          grns: { select: { id: true, grnNumber: true, status: true, receiveDate: true } }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public static async getPurchaseOrderById(companyId: string, poId: string) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, companyId },
      include: {
        branch: true,
        supplier: true,
        createdBy: true,
        items: {
          include: {
            item: { include: { unit: true, category: true } }
          }
        },
        grns: {
          include: {
            warehouse: true,
            items: true
          }
        }
      }
    });

    if (!po) {
      throw new AppError('Purchase Order not found', 404);
    }

    return po;
  }

  public static async createPurchaseOrder(
    companyId: string,
    branchId: string,
    data: {
      supplierId: string;
      requestId?: string | null;
      deliveryDate?: string;
      taxAmount?: number;
      notes?: string;
      items: Array<{ itemId: string; orderedQty: number; unitPrice: number; notes?: string }>;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const poCount = await prisma.purchaseOrder.count({ where: { companyId } });
    const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, '0')}`;

    const totalAmount = data.items.reduce((sum, it) => {
      return sum.plus(new Prisma.Decimal(it.orderedQty).times(new Prisma.Decimal(it.unitPrice)));
    }, new Prisma.Decimal(0));

    const taxAmount = new Prisma.Decimal(data.taxAmount || 0);
    const grandTotal = totalAmount.plus(taxAmount);

    const po = await prisma.purchaseOrder.create({
      data: {
        companyId,
        branchId,
        supplierId: data.supplierId,
        requestId: data.requestId || null,
        poNumber,
        status: 'ISSUED',
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        totalAmount,
        taxAmount,
        grandTotal,
        notes: data.notes,
        createdById: actorId,
        items: {
          create: data.items.map((it) => {
            const qty = new Prisma.Decimal(it.orderedQty);
            const price = new Prisma.Decimal(it.unitPrice);
            return {
              itemId: it.itemId,
              orderedQty: qty,
              unitPrice: price,
              totalPrice: qty.times(price),
              notes: it.notes
            };
          })
        }
      },
      include: {
        items: { include: { item: true } },
        supplier: true
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'PURCHASE_ORDER_CREATE',
      entity: 'PurchaseOrder',
      entityId: po.id,
      details: { poNumber, supplier: po.supplier.name, grandTotal: grandTotal.toString() },
      ipAddress,
      userAgent
    });

    return po;
  }

  // -------------------------------------------------------------
  // GOODS RECEIVE NOTE (GRN) & AUTOMATED INVENTORY & LEDGER UPDATE
  // -------------------------------------------------------------

  public static async createGoodsReceiveNote(params: {
    companyId: string;
    branchId: string;
    warehouseId: string;
    supplierId: string;
    poId?: string | null;
    receiveDate?: string;
    invoiceNumber?: string;
    notes?: string;
    items: Array<{
      poItemId?: string | null;
      itemId: string;
      receivedQty: number;
      acceptedQty: number;
      rejectedQty?: number;
      unitPrice: number;
      batchNumber?: string;
      expiryDate?: string;
      qcStatus?: QCStatus;
      qcNotes?: string;
    }>;
    receiverId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { companyId, branchId, warehouseId, supplierId, poId, receiverId, ipAddress, userAgent } = params;

    const [wh, supplier] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
      prisma.supplier.findFirst({ where: { id: supplierId, companyId } })
    ]);

    if (!wh || !supplier) {
      throw new AppError('Invalid warehouse or supplier', 404);
    }

    // Execute in Prisma Atomic Transaction
    return prisma.$transaction(async (tx) => {
      const grnCount = await tx.goodsReceiveNote.count({ where: { companyId } });
      const grnNumber = `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(5, '0')}`;

      // Calculate total accepted amount
      let totalAmount = new Prisma.Decimal(0);
      for (const item of params.items) {
        const acceptedQty = new Prisma.Decimal(item.acceptedQty);
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        totalAmount = totalAmount.plus(acceptedQty.times(unitPrice));
      }

      // 1. Create GRN Header
      const grn = await tx.goodsReceiveNote.create({
        data: {
          companyId,
          branchId,
          warehouseId,
          supplierId,
          poId: poId || null,
          grnNumber,
          receiveDate: params.receiveDate ? new Date(params.receiveDate) : new Date(),
          invoiceNumber: params.invoiceNumber,
          status: 'QC_PASSED',
          totalAmount,
          notes: params.notes,
          receivedById: receiverId
        }
      });

      // 2. Process each received item
      for (const item of params.items) {
        const receivedQty = new Prisma.Decimal(item.receivedQty);
        const acceptedQty = new Prisma.Decimal(item.acceptedQty);
        const rejectedQty = new Prisma.Decimal(item.rejectedQty || 0);
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const itemTotalPrice = acceptedQty.times(unitPrice);

        // Create GRN Item record
        await tx.goodsReceiveItem.create({
          data: {
            grnId: grn.id,
            poItemId: item.poItemId || null,
            itemId: item.itemId,
            receivedQty,
            acceptedQty,
            rejectedQty,
            unitPrice,
            totalPrice: itemTotalPrice,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            qcStatus: item.qcStatus || 'PASSED',
            qcNotes: item.qcNotes
          }
        });

        if (acceptedQty.greaterThan(0)) {
          // A. Update Stock Balance in target Warehouse (Section 8 automation)
          const stockBalance = await tx.stockBalance.upsert({
            where: {
              warehouseId_itemId: {
                warehouseId,
                itemId: item.itemId
              }
            },
            update: {
              quantity: { increment: acceptedQty }
            },
            create: {
              warehouseId,
              itemId: item.itemId,
              quantity: acceptedQty
            }
          });

          // B. Update Item cost price to latest purchase price
          await tx.item.update({
            where: { id: item.itemId },
            data: { costPrice: unitPrice }
          });

          // C. Create immutable StockLedger record
          await tx.stockLedger.create({
            data: {
              warehouseId,
              itemId: item.itemId,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              movementType: 'GRN',
              changeQty: acceptedQty,
              balanceQty: stockBalance.quantity,
              unitCost: unitPrice,
              totalCost: itemTotalPrice,
              referenceType: 'GRN',
              referenceId: grn.id,
              notes: `Goods received from ${supplier.name} (${grnNumber})`,
              createdById: receiverId
            }
          });
        }

        // D. Update PO Item received quantity if linked to PO
        if (item.poItemId) {
          await tx.purchaseOrderItem.update({
            where: { id: item.poItemId },
            data: {
              receivedQty: { increment: acceptedQty }
            }
          });
        }
      }

      // 3. Update PO status if linked
      if (poId) {
        const poItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
        const allReceived = poItems.every((poi) => poi.receivedQty.greaterThanOrEqualTo(poi.orderedQty));
        const someReceived = poItems.some((poi) => poi.receivedQty.greaterThan(0));

        await tx.purchaseOrder.update({
          where: { id: poId },
          data: {
            status: allReceived ? 'RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : 'ISSUED'
          }
        });
      }

      // 4. Update Supplier Payable Balance & record in Supplier Ledger
      const updatedSupplier = await tx.supplier.update({
        where: { id: supplierId },
        data: {
          balance: { increment: totalAmount }
        }
      });

      await tx.supplierLedger.create({
        data: {
          supplierId,
          transactionType: 'INVOICE',
          debit: new Prisma.Decimal(0),
          credit: totalAmount,
          balance: updatedSupplier.balance,
          referenceType: 'GRN',
          referenceId: grn.id,
          description: `Goods received on ${grnNumber}${params.invoiceNumber ? ` (Inv: ${params.invoiceNumber})` : ''}`
        }
      });

      // 5. Create Purchase Invoice record
      const invoiceNumber = `INV-${grnNumber}`;
      await tx.purchaseInvoice.create({
        data: {
          companyId,
          supplierId,
          grnId: grn.id,
          invoiceNumber,
          totalAmount,
          paidAmount: new Prisma.Decimal(0),
          status: 'UNPAID',
          notes: params.invoiceNumber ? `Supplier Invoice: ${params.invoiceNumber}` : undefined
        }
      });

      // 6. Post Double-Entry General Ledger & Accounts Payable via AccountingService
      try {
        await AccountingService.recordPurchaseGrnJournal({
          companyId,
          branchId: wh.branchId,
          supplierId,
          grnId: grn.id,
          grnNumber,
          totalAmount,
          actorId: receiverId
        });
      } catch (accErr) {
        console.warn('Auto AP/GL Posting non-fatal notice:', accErr);
      }

      await AuditService.log({
        userId: receiverId,
        action: 'GOODS_RECEIVE_COMPLETED',
        entity: 'GoodsReceiveNote',
        entityId: grn.id,
        details: {
          grnNumber,
          warehouse: wh.name,
          supplier: supplier.name,
          totalAmount: totalAmount.toString(),
          itemCount: params.items.length
        },
        ipAddress,
        userAgent
      });

      return grn;
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async getGoodsReceiveNotes(
    companyId: string,
    params: { branchId?: string; warehouseId?: string; supplierId?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GoodsReceiveNoteWhereInput = {
      companyId,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {})
    };

    const [total, grns] = await Promise.all([
      prisma.goodsReceiveNote.count({ where }),
      prisma.goodsReceiveNote.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          supplier: { select: { id: true, name: true, code: true } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: {
              item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } }
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      grns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
