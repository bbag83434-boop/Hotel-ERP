import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { AccountingService } from './accounting.service';
import { ApprovalService } from './approval.service';
import { Prisma, PRStatus, PRPriority, POStatus, GRNStatus, QCStatus, SupplierTxType } from '@prisma/client';

export class PurchaseService {
  // -------------------------------------------------------------
  // INVOICE FILE STORAGE & VALIDATION
  // -------------------------------------------------------------

  public static validateAndSaveInvoiceFile(params: {
    companyId: string;
    fileName: string;
    fileType: string;
    fileBase64: string;
  }) {
    const { companyId, fileName, fileType, fileBase64 } = params;

    // 1. Allowed MIME Types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(fileType)) {
      throw new AppError(`Unsupported file type: "${fileType}". Only JPEG, PNG, WebP, and PDF are allowed.`, 400);
    }

    // 2. Decode Base64 & validate size
    let cleanBase64 = fileBase64;
    if (cleanBase64.includes(';base64,')) {
      cleanBase64 = cleanBase64.split(';base64,')[1];
    }
    const buffer = Buffer.from(cleanBase64, 'base64');
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length === 0) {
      throw new AppError('Uploaded file is empty or corrupted', 400);
    }
    if (buffer.length > maxSize) {
      throw new AppError('File size exceeds the 10MB limit', 400);
    }

    // 3. File Header & Magic Bytes Integrity Validation
    const isPDF = fileType === 'application/pdf' && buffer.subarray(0, 4).toString() === '%PDF';
    const isPNG = fileType === 'image/png' && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJPEG = fileType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebP = fileType === 'image/webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';

    if (!isPDF && !isPNG && !isJPEG && !isWebP) {
      throw new AppError('File integrity validation failed. File content does not match the claimed MIME type.', 400);
    }

    // 4. Safe Storage Reference on Disk
    const safeBaseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetDir = path.join(process.cwd(), 'uploads', 'invoices', companyId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const storedFileName = `${Date.now()}_${safeBaseName}`;
    const fullPath = path.join(targetDir, storedFileName);
    fs.writeFileSync(fullPath, buffer, { mode: 0o644 });

    const storageRef = `/uploads/invoices/${companyId}/${storedFileName}`;

    return {
      fileName: safeBaseName,
      fileType,
      fileSize: buffer.length,
      uploadTime: new Date().toISOString(),
      storageRef
    };
  }

  public static async uploadSupplierInvoice(params: {
    companyId: string;
    branchId: string;
    warehouseId: string;
    supplierId: string;
    poId?: string | null;
    invoiceNumber: string;
    invoiceDate?: string;
    invoiceAmount: number;
    fileName: string;
    fileType: string;
    fileBase64: string;
    actorId?: string;
    userBranchIds?: string[];
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { companyId, branchId, warehouseId, supplierId, poId, invoiceNumber, invoiceDate, invoiceAmount, actorId, userBranchIds } = params;

    // Check branch authorization
    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(branchId)) {
      throw new AppError('Unauthorized: You do not have access to upload invoices for this branch', 403);
    }

    // Verify supplier & warehouse exist
    const [supplier, wh] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: supplierId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } })
    ]);
    if (!supplier) throw new AppError('Supplier not found', 404);
    if (!wh) throw new AppError('Warehouse not found', 404);

    // Check for duplicate invoice
    const cleanInvoiceNumber = invoiceNumber.trim();
    const existing = await prisma.goodsReceiveNote.findFirst({
      where: {
        companyId,
        supplierId,
        invoiceNumber: { equals: cleanInvoiceNumber, mode: 'insensitive' }
      }
    });
    if (existing) {
      throw new AppError('Duplicate supplier invoice detected.', 400);
    }

    // Validate and save file securely
    const fileMeta = PurchaseService.validateAndSaveInvoiceFile({
      companyId,
      fileName: params.fileName,
      fileType: params.fileType,
      fileBase64: params.fileBase64
    });

    const fullMetadata = {
      ...fileMeta,
      uploadedBy: actorId || 'Authorized User',
      invoiceNumber: cleanInvoiceNumber,
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      invoiceAmount,
      supplier: { id: supplier.id, name: supplier.name, code: supplier.code },
      outletId: branchId,
      warehouseId,
      poId: poId || null
    };

    await AuditService.log({
      userId: actorId,
      action: 'SUPPLIER_INVOICE_UPLOADED',
      entity: 'SupplierInvoice',
      entityId: cleanInvoiceNumber,
      details: fullMetadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });

    return fullMetadata;
  }
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

    const itemsWithMetrics = po.items.map((it) => {
      const ordered = Number(it.orderedQty);
      const received = Number(it.receivedQty);
      const outstanding = Math.max(0, ordered - received);
      return {
        ...it,
        orderedQty: ordered,
        receivedQty: received,
        outstandingQty: outstanding,
        isFullyReceived: received >= ordered
      };
    });

    const totalOrderedQty = itemsWithMetrics.reduce((sum, it) => sum + it.orderedQty, 0);
    const totalReceivedQty = itemsWithMetrics.reduce((sum, it) => sum + it.receivedQty, 0);
    const totalOutstandingQty = itemsWithMetrics.reduce((sum, it) => sum + it.outstandingQty, 0);

    return {
      ...po,
      items: itemsWithMetrics,
      metrics: {
        totalOrderedQty,
        totalReceivedQty,
        totalOutstandingQty,
        isFullyReceived: totalOutstandingQty === 0 && totalOrderedQty > 0
      }
    };
  }

  public static async updatePurchaseOrder(
    companyId: string,
    poId: string,
    data: {
      supplierId?: string;
      deliveryDate?: string;
      taxAmount?: number;
      notes?: string;
      items?: Array<{ itemId: string; orderedQty: number; unitPrice: number; notes?: string }>;
    },
    actorId?: string,
    userBranchIds?: string[],
    ipAddress?: string,
    userAgent?: string
  ) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, companyId },
      include: { items: true }
    });
    if (!po) {
      throw new AppError('Purchase Order not found', 404);
    }
    if (po.status !== 'DRAFT') {
      throw new AppError(`Cannot update Purchase Order with status "${po.status}". Only DRAFT purchase orders can be edited.`, 400);
    }
    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(po.branchId)) {
      throw new AppError('Unauthorized: You do not have access to edit purchase orders for this branch', 403);
    }

    const updatedPO = await prisma.$transaction(async (tx) => {
      let totalAmount = po.totalAmount;
      const taxAmount = data.taxAmount !== undefined ? new Prisma.Decimal(data.taxAmount) : po.taxAmount;

      if (data.items && data.items.length > 0) {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: po.id } });
        totalAmount = new Prisma.Decimal(0);
        const preparedItems = [];
        for (const it of data.items) {
          const itemRecord = await tx.item.findFirst({ where: { id: it.itemId, companyId } });
          if (!itemRecord) {
            throw new AppError(`Item "${it.itemId}" not found in Item Master`, 404);
          }
          const qty = new Prisma.Decimal(it.orderedQty);
          if (qty.lessThanOrEqualTo(0)) {
            throw new AppError(`Ordered quantity for "${itemRecord.name}" must be greater than 0`, 400);
          }
          const price = new Prisma.Decimal(it.unitPrice >= 0 ? it.unitPrice : itemRecord.costPrice.toNumber());
          const lineTotal = qty.times(price);
          totalAmount = totalAmount.plus(lineTotal);
          preparedItems.push({
            itemId: it.itemId,
            orderedQty: qty,
            unitPrice: price,
            totalPrice: lineTotal,
            notes: it.notes
          });
        }
        await tx.purchaseOrderItem.createMany({
          data: preparedItems.map((pi) => ({
            poId: po.id,
            itemId: pi.itemId,
            orderedQty: pi.orderedQty,
            unitPrice: pi.unitPrice,
            totalPrice: pi.totalPrice,
            notes: pi.notes
          }))
        });
      }

      const grandTotal = totalAmount.plus(taxAmount);

      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          supplierId: data.supplierId || po.supplierId,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : po.deliveryDate,
          totalAmount,
          taxAmount,
          grandTotal,
          notes: data.notes !== undefined ? data.notes : po.notes
        },
        include: {
          items: { include: { item: true } },
          supplier: true,
          branch: true
        }
      });
    });

    await AuditService.log({
      userId: actorId,
      action: 'PURCHASE_ORDER_UPDATE',
      entity: 'PurchaseOrder',
      entityId: po.id,
      details: { poNumber: po.poNumber, updatedFields: Object.keys(data) },
      ipAddress,
      userAgent
    });

    return updatedPO;
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
      status?: POStatus;
      items: Array<{ itemId: string; orderedQty: number; unitPrice: number; notes?: string }>;
    },
    actorId?: string,
    userBranchIds?: string[],
    ipAddress?: string,
    userAgent?: string
  ) {
    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(branchId)) {
      throw new AppError('Unauthorized: You do not have access to create purchase orders for this branch', 403);
    }

    const [supplier, branch] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: data.supplierId, companyId } }),
      prisma.branch.findFirst({ where: { id: branchId, companyId } })
    ]);

    if (!supplier) {
      throw new AppError('Invalid supplier selected. Supplier does not exist.', 404);
    }
    if (!branch) {
      throw new AppError('Invalid branch selected.', 404);
    }

    // Verify linked Purchase Request / Requisition if provided
    let linkedPR = null;
    if (data.requestId) {
      linkedPR = await prisma.purchaseRequest.findFirst({
        where: { id: data.requestId, companyId },
        include: { items: true }
      });
      if (!linkedPR) {
        throw new AppError('Referenced purchase requisition does not exist in this company', 404);
      }
    }

    const poCount = await prisma.purchaseOrder.count({ where: { companyId } });
    const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, '0')}`;

    // Verify items and calculate totals strictly on backend
    let totalAmount = new Prisma.Decimal(0);
    const preparedItems: Array<{ itemId: string; orderedQty: Prisma.Decimal; unitPrice: Prisma.Decimal; totalPrice: Prisma.Decimal; notes?: string }> = [];

    for (const it of data.items) {
      const itemRecord = await prisma.item.findFirst({ where: { id: it.itemId, companyId } });
      if (!itemRecord) {
        throw new AppError(`Item with ID "${it.itemId}" not found in Item Master`, 404);
      }
      const qty = new Prisma.Decimal(it.orderedQty);
      if (qty.lessThanOrEqualTo(0)) {
        throw new AppError(`Ordered quantity for "${itemRecord.name}" must be greater than 0`, 400);
      }
      const price = new Prisma.Decimal(it.unitPrice >= 0 ? it.unitPrice : itemRecord.costPrice.toNumber());
      const lineTotal = qty.times(price);
      totalAmount = totalAmount.plus(lineTotal);

      preparedItems.push({
        itemId: it.itemId,
        orderedQty: qty,
        unitPrice: price,
        totalPrice: lineTotal,
        notes: it.notes
      });
    }

    const taxAmount = new Prisma.Decimal(Math.max(0, data.taxAmount || 0));
    const grandTotal = totalAmount.plus(taxAmount);
    const poStatus: POStatus = data.status || 'ISSUED';

    const po = await prisma.$transaction(async (tx) => {
      const createdPO = await tx.purchaseOrder.create({
        data: {
          companyId,
          branchId,
          supplierId: data.supplierId,
          requestId: data.requestId || null,
          poNumber,
          status: poStatus,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          totalAmount,
          taxAmount,
          grandTotal,
          notes: data.notes,
          createdById: actorId,
          items: {
            create: preparedItems.map((pi) => ({
              itemId: pi.itemId,
              orderedQty: pi.orderedQty,
              unitPrice: pi.unitPrice,
              totalPrice: pi.totalPrice,
              notes: pi.notes
            }))
          }
        },
        include: {
          items: { include: { item: { include: { unit: true } } } },
          supplier: true,
          branch: true
        }
      });

      // Update linked requisition status to ORDERED if linked
      if (data.requestId) {
        await tx.purchaseRequest.update({
          where: { id: data.requestId },
          data: { status: 'ORDERED' }
        });
      }

      return createdPO;
    }, { maxWait: 10000, timeout: 30000 });

    await AuditService.log({
      userId: actorId,
      action: 'PURCHASE_ORDER_CREATE',
      entity: 'PurchaseOrder',
      entityId: po.id,
      details: {
        poNumber,
        supplier: supplier.name,
        grandTotal: grandTotal.toString(),
        itemCount: data.items.length,
        status: poStatus,
        requestId: data.requestId
      },
      ipAddress,
      userAgent
    });

    return po;
  }

  public static async updatePurchaseOrderStatus(
    companyId: string,
    poId: string,
    newStatus: POStatus,
    reason?: string,
    actorId?: string,
    userBranchIds?: string[],
    ipAddress?: string,
    userAgent?: string
  ) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, companyId },
      include: { grns: true, branch: true }
    });

    if (!po) {
      throw new AppError('Purchase Order not found', 404);
    }

    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(po.branchId)) {
      throw new AppError('Unauthorized: You do not have access to modify purchase orders for this branch', 403);
    }

    // Guard against invalid status transitions
    if (newStatus === 'CANCELLED') {
      if (po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED' || po.grns.length > 0) {
        throw new AppError('Cannot cancel a Purchase Order that has already received goods', 400);
      }
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: newStatus,
        notes: reason ? `${po.notes ? po.notes + ' | ' : ''}Status update: ${reason}` : po.notes
      },
      include: {
        items: { include: { item: true } },
        supplier: true,
        branch: true
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'PURCHASE_ORDER_STATUS_UPDATE',
      entity: 'PurchaseOrder',
      entityId: poId,
      details: { poNumber: po.poNumber, oldStatus: po.status, newStatus, reason },
      ipAddress,
      userAgent
    });

    return updated;
  }

  // -------------------------------------------------------------
  // GOODS RECEIVE NOTE (GRN) & AUTOMATED INVENTORY & LEDGER UPDATE
  // -------------------------------------------------------------

  public static async createGoodsReceiveNote(params: {
    companyId: string;
    branchId: string;
    warehouseId: string;
    supplierId?: string;
    poId?: string | null;
    receiveDate?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount?: number;
    taxAmount?: number;
    freightAmount?: number;
    allowPriceVariance?: boolean;
    invoiceAttachment?: {
      fileName: string;
      fileType: string;
      fileBase64: string;
      fileSize?: number;
    };
    notes?: string;
    status?: GRNStatus;
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
    userBranchIds?: string[];
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { companyId, branchId, warehouseId, receiverId, userBranchIds, ipAddress, userAgent } = params;
    const isImmediateConfirm = (params.status || 'QC_PASSED') === 'QC_PASSED';

    // 1. Validate Warehouse & Branch Isolation
    const wh = await prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!wh) {
      throw new AppError('Invalid warehouse specified', 404);
    }
    if (wh.branchId && !wh.isCentral && wh.branchId !== branchId) {
      throw new AppError('Warehouse does not belong to the specified branch', 400);
    }
    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(branchId)) {
      throw new AppError('Unauthorized: You do not have access to receive goods at this branch', 403);
    }

    // 2. Resolve & Validate PO and Supplier
    let resolvedSupplierId = params.supplierId;
    let linkedPO: any = null;

    if (params.poId) {
      linkedPO = await prisma.purchaseOrder.findFirst({
        where: { id: params.poId, companyId },
        include: { items: true, supplier: true }
      });
      if (!linkedPO) {
        throw new AppError('Referenced Purchase Order not found', 404);
      }
      if (linkedPO.status === 'CANCELLED') {
        throw new AppError('Cannot receive goods against a CANCELLED Purchase Order', 400);
      }
      // Supplier inherited directly from PO to enforce reference consistency
      resolvedSupplierId = linkedPO.supplierId;
    }

    if (!resolvedSupplierId) {
      throw new AppError('Supplier must be specified directly or referenced through a Purchase Order', 400);
    }

    const supplier = await prisma.supplier.findFirst({ where: { id: resolvedSupplierId, companyId } });
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    // 3. Duplicate Supplier Invoice Check
    if (params.invoiceNumber && params.invoiceNumber.trim() !== '') {
      const cleanInvoiceNumber = params.invoiceNumber.trim();
      const existingInvoice = await prisma.goodsReceiveNote.findFirst({
        where: {
          companyId,
          supplierId: resolvedSupplierId,
          invoiceNumber: { equals: cleanInvoiceNumber, mode: 'insensitive' }
        }
      });
      if (existingInvoice) {
        throw new AppError('Duplicate supplier invoice detected.', 400);
      }
    }

    // 4. Execute in Prisma Atomic Transaction with Concurrency Row-Locking
    return prisma.$transaction(async (tx) => {
      // Row lock the PurchaseOrder to prevent concurrent duplicate receiving races
      if (params.poId) {
        await tx.$queryRaw`
          SELECT "id", "status"::text FROM "purchase_orders"
          WHERE "id" = ${params.poId}
          FOR UPDATE
        `;
      }

      // Row lock target warehouse
      await tx.$queryRaw`
        SELECT "id" FROM "warehouses"
        WHERE "id" = ${warehouseId}
        FOR UPDATE
      `;

      const grnCount = await tx.goodsReceiveNote.count({ where: { companyId } });
      const grnNumber = `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(5, '0')}`;

      // Calculate base values, tax, freight, and validate QC balancing & over-receiving
      let poBaseTotal = new Prisma.Decimal(0);
      let invoiceBaseTotal = new Prisma.Decimal(0);

      for (const item of params.items) {
        const itemRecord = await tx.item.findFirst({ where: { id: item.itemId, companyId } });
        if (!itemRecord) {
          throw new AppError(`Item "${item.itemId}" not found in Item Master`, 404);
        }

        const receivedQty = new Prisma.Decimal(item.receivedQty);
        const acceptedQty = new Prisma.Decimal(item.acceptedQty);
        const rejectedQty = new Prisma.Decimal(item.rejectedQty || 0);
        const unitPrice = new Prisma.Decimal(item.unitPrice >= 0 ? item.unitPrice : itemRecord.costPrice.toNumber());

        if (receivedQty.lessThanOrEqualTo(0)) {
          throw new AppError(`Received quantity for item "${itemRecord.name}" must be greater than 0`, 400);
        }
        if (acceptedQty.lessThan(0) || rejectedQty.lessThan(0)) {
          throw new AppError(`Accepted and rejected quantities for item "${itemRecord.name}" cannot be negative`, 400);
        }

        // Strict Quality Check (QC) balancing rule
        if (!acceptedQty.plus(rejectedQty).equals(receivedQty)) {
          throw new AppError(
            `QC validation failed for "${itemRecord.name}": Accepted quantity (${acceptedQty}) + Rejected quantity (${rejectedQty}) must equal total Received quantity (${receivedQty})`,
            400
          );
        }

        // Strict PO item over-receiving prevention & price verification
        if (item.poItemId && params.poId) {
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: { id: item.poItemId, poId: params.poId }
          });
          if (!poItem) {
            throw new AppError(`PO Line Item "${item.poItemId}" does not belong to Purchase Order "${linkedPO.poNumber}"`, 400);
          }

          const newTotalReceived = poItem.receivedQty.plus(acceptedQty);
          if (newTotalReceived.greaterThan(poItem.orderedQty)) {
            throw new AppError(
              `Over-receiving blocked for item "${itemRecord.name}": Total received (${newTotalReceived}) cannot exceed ordered quantity (${poItem.orderedQty})`,
              400
            );
          }

          const poLineBase = acceptedQty.times(poItem.unitPrice);
          const invoiceLineBase = acceptedQty.times(unitPrice);
          poBaseTotal = poBaseTotal.plus(poLineBase);
          invoiceBaseTotal = invoiceBaseTotal.plus(invoiceLineBase);
        } else {
          invoiceBaseTotal = invoiceBaseTotal.plus(acceptedQty.times(unitPrice));
          poBaseTotal = poBaseTotal.plus(acceptedQty.times(unitPrice));
        }
      }

      const taxAmount = new Prisma.Decimal(params.taxAmount || 0);
      const freightAmount = new Prisma.Decimal(params.freightAmount || 0);
      const calculatedGrandTotal = invoiceBaseTotal.plus(taxAmount).plus(freightAmount);
      const totalAmount = params.invoiceAmount !== undefined && params.invoiceAmount > 0
        ? new Prisma.Decimal(params.invoiceAmount)
        : calculatedGrandTotal;

      const variance = invoiceBaseTotal.minus(poBaseTotal);
      const isPOValueExceeded = variance.greaterThan(0);
      const variancePercentage = poBaseTotal.greaterThan(0)
        ? variance.dividedBy(poBaseTotal).times(100).toFixed(2)
        : '0.00';

      // When PO value is exceeded without pre-approval, block immediate confirm and require variance approval
      const effectiveStatus: GRNStatus = isPOValueExceeded && !params.allowPriceVariance
        ? 'RECEIVED'
        : isImmediateConfirm
        ? 'QC_PASSED'
        : 'RECEIVED';

      const effectiveIsImmediateConfirm = effectiveStatus === 'QC_PASSED';

      const priceVerificationStatus = isPOValueExceeded
        ? (params.allowPriceVariance ? 'PO_VALUE_EXCEEDED (VARIANCE_APPROVED)' : 'PO_VALUE_EXCEEDED (PENDING_VARIANCE_APPROVAL)')
        : 'AMOUNT_MATCHED';

      const notesWithAudit = params.notes
        ? `${params.notes} | Verification: ${priceVerificationStatus} (PO Base: ${poBaseTotal}, Inv Base: ${invoiceBaseTotal}${isPOValueExceeded ? `, Excess: +${variance} (+${variancePercentage}%)` : ''})`
        : `Verification: ${priceVerificationStatus} (PO Base: ${poBaseTotal}, Inv Base: ${invoiceBaseTotal}${isPOValueExceeded ? `, Excess: +${variance} (+${variancePercentage}%)` : ''})`;

      // 1. Create GRN Header
      const grn = await tx.goodsReceiveNote.create({
        data: {
          companyId,
          branchId,
          warehouseId,
          supplierId: resolvedSupplierId,
          poId: params.poId || null,
          grnNumber,
          receiveDate: params.receiveDate ? new Date(params.receiveDate) : new Date(),
          invoiceNumber: params.invoiceNumber,
          status: effectiveStatus,
          totalAmount,
          notes: notesWithAudit,
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
            qcStatus: item.qcStatus || (rejectedQty.greaterThan(0) && acceptedQty.isZero() ? 'FAILED' : 'PASSED'),
            qcNotes: item.qcNotes
          }
        });

        // Only increase stock and ledger when CONFIRMED (effectiveIsImmediateConfirm = true)
        if (effectiveIsImmediateConfirm && acceptedQty.greaterThan(0)) {
          // A. Increase Stock Balance in target Warehouse atomically
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

          // B. Update Item Master cost price to latest purchase price
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

        // D. Update PO Item received quantity if confirmed and linked to PO
        if (effectiveIsImmediateConfirm && item.poItemId && params.poId) {
          await tx.purchaseOrderItem.update({
            where: { id: item.poItemId },
            data: {
              receivedQty: { increment: acceptedQty }
            }
          });
        }
      }

      // 3. Update PO status accurately based on cumulative received quantities
      if (effectiveIsImmediateConfirm && params.poId) {
        const poItems = await tx.purchaseOrderItem.findMany({ where: { poId: params.poId } });
        const allReceived = poItems.length > 0 && poItems.every((poi) => poi.receivedQty.greaterThanOrEqualTo(poi.orderedQty));
        const someReceived = poItems.some((poi) => poi.receivedQty.greaterThan(0));

        const updatedPOStatus: POStatus = allReceived ? 'RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : 'ISSUED';

        await tx.purchaseOrder.update({
          where: { id: params.poId },
          data: { status: updatedPOStatus }
        });
      }

      // 4. Update Supplier Payable Balance & record in Supplier Ledger if confirmed
      if (effectiveIsImmediateConfirm && totalAmount.greaterThan(0)) {
        const updatedSupplier = await tx.supplier.update({
          where: { id: resolvedSupplierId },
          data: {
            balance: { increment: totalAmount }
          }
        });

        await tx.supplierLedger.create({
          data: {
            supplierId: resolvedSupplierId,
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
            supplierId: resolvedSupplierId,
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
            supplierId: resolvedSupplierId,
            grnId: grn.id,
            grnNumber,
            totalAmount,
            actorId: receiverId
          });
        } catch (accErr) {
          console.warn('Auto AP/GL Posting non-fatal notice:', accErr);
        }
      }

      await AuditService.log({
        userId: receiverId,
        action: effectiveIsImmediateConfirm ? 'GOODS_RECEIVE_COMPLETED' : 'GOODS_RECEIVE_DRAFT_CREATED',
        entity: 'GoodsReceiveNote',
        entityId: grn.id,
        details: {
          grnNumber,
          warehouse: wh.name,
          supplier: supplier.name,
          poId: params.poId,
          totalAmount: totalAmount.toString(),
          itemCount: params.items.length,
          status: grn.status,
          priceVerification: priceVerificationStatus
        },
        ipAddress,
        userAgent
      });

      return grn;
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async approveGoodsReceiveVariance(
    companyId: string,
    grnId: string,
    actorId?: string,
    userBranchIds?: string[],
    ipAddress?: string,
    userAgent?: string
  ) {
    const grn = await prisma.goodsReceiveNote.findFirst({
      where: { id: grnId, companyId }
    });
    if (!grn) {
      throw new AppError('Goods Receive Note not found', 404);
    }
    if (grn.status !== 'RECEIVED') {
      throw new AppError(`GRN cannot be variance-approved. Current status is "${grn.status}".`, 400);
    }
    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(grn.branchId)) {
      throw new AppError('Unauthorized: You do not have access to approve variance for this branch', 403);
    }

    await prisma.goodsReceiveNote.update({
      where: { id: grnId },
      data: {
        notes: grn.notes ? `${grn.notes} | VARIANCE APPROVED by manager` : 'VARIANCE APPROVED by manager'
      }
    });

    return PurchaseService.confirmGoodsReceiveNote(companyId, grnId, actorId, userBranchIds, ipAddress, userAgent);
  }

  public static async rejectGoodsReceiveVariance(
    companyId: string,
    grnId: string,
    reason: string,
    actorId?: string,
    userBranchIds?: string[],
    ipAddress?: string,
    userAgent?: string
  ) {
    const grn = await prisma.goodsReceiveNote.findFirst({
      where: { id: grnId, companyId }
    });
    if (!grn) {
      throw new AppError('Goods Receive Note not found', 404);
    }
    if (grn.status !== 'RECEIVED') {
      throw new AppError(`GRN cannot be variance-rejected. Current status is "${grn.status}".`, 400);
    }
    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(grn.branchId)) {
      throw new AppError('Unauthorized: You do not have access to reject variance for this branch', 403);
    }

    const updated = await prisma.goodsReceiveNote.update({
      where: { id: grnId },
      data: {
        status: 'REJECTED',
        notes: grn.notes ? `${grn.notes} | VARIANCE REJECTED: ${reason}` : `VARIANCE REJECTED: ${reason}`
      },
      include: { items: true, warehouse: true, supplier: true }
    });

    await AuditService.log({
      userId: actorId,
      action: 'GOODS_RECEIVE_VARIANCE_REJECTED',
      entity: 'GoodsReceiveNote',
      entityId: grn.id,
      details: { grnNumber: grn.grnNumber, reason },
      ipAddress,
      userAgent
    });

    return updated;
  }

  public static async confirmGoodsReceiveNote(
    companyId: string,
    grnId: string,
    actorId?: string,
    userBranchIds?: string[],
    ipAddress?: string,
    userAgent?: string
  ) {
    const grn = await prisma.goodsReceiveNote.findFirst({
      where: { id: grnId, companyId },
      include: { items: true, warehouse: true, supplier: true }
    });

    if (!grn) {
      throw new AppError('Goods Receive Note not found', 404);
    }
    if (grn.status !== 'RECEIVED') {
      throw new AppError(`GRN cannot be confirmed. Current status is already "${grn.status}".`, 400);
    }
    if (userBranchIds && userBranchIds.length > 0 && !userBranchIds.includes(grn.branchId)) {
      throw new AppError('Unauthorized: You do not have access to confirm goods receiving at this branch', 403);
    }

    return prisma.$transaction(async (tx) => {
      // Row lock GRN, PO, and Warehouse
      await tx.$queryRaw`
        SELECT "id", "status"::text FROM "goods_receive_notes"
        WHERE "id" = ${grnId}
        FOR UPDATE
      `;
      if (grn.poId) {
        await tx.$queryRaw`
          SELECT "id", "status"::text FROM "purchase_orders"
          WHERE "id" = ${grn.poId}
          FOR UPDATE
        `;
      }
      await tx.$queryRaw`
        SELECT "id" FROM "warehouses"
        WHERE "id" = ${grn.warehouseId}
        FOR UPDATE
      `;

      // Process stock increments
      for (const item of grn.items) {
        const acceptedQty = item.acceptedQty;
        const unitPrice = item.unitPrice;
        const itemTotalPrice = acceptedQty.times(unitPrice);

        if (acceptedQty.greaterThan(0)) {
          // Increase stock balance
          const stockBalance = await tx.stockBalance.upsert({
            where: {
              warehouseId_itemId: {
                warehouseId: grn.warehouseId,
                itemId: item.itemId
              }
            },
            update: {
              quantity: { increment: acceptedQty }
            },
            create: {
              warehouseId: grn.warehouseId,
              itemId: item.itemId,
              quantity: acceptedQty
            }
          });

          // Update Item Master cost price
          await tx.item.update({
            where: { id: item.itemId },
            data: { costPrice: unitPrice }
          });

          // Create immutable StockLedger record
          await tx.stockLedger.create({
            data: {
              warehouseId: grn.warehouseId,
              itemId: item.itemId,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              movementType: 'GRN',
              changeQty: acceptedQty,
              balanceQty: stockBalance.quantity,
              unitCost: unitPrice,
              totalCost: itemTotalPrice,
              referenceType: 'GRN',
              referenceId: grn.id,
              notes: `Goods received from ${grn.supplier.name} (${grn.grnNumber})`,
              createdById: actorId
            }
          });
        }

        // Update PO Item receivedQty
        if (item.poItemId && grn.poId) {
          await tx.purchaseOrderItem.update({
            where: { id: item.poItemId },
            data: { receivedQty: { increment: acceptedQty } }
          });
        }
      }

      // Update PO overall status
      if (grn.poId) {
        const poItems = await tx.purchaseOrderItem.findMany({ where: { poId: grn.poId } });
        const allReceived = poItems.length > 0 && poItems.every((poi) => poi.receivedQty.greaterThanOrEqualTo(poi.orderedQty));
        const someReceived = poItems.some((poi) => poi.receivedQty.greaterThan(0));

        const updatedPOStatus: POStatus = allReceived ? 'RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : 'ISSUED';
        await tx.purchaseOrder.update({
          where: { id: grn.poId },
          data: { status: updatedPOStatus }
        });
      }

      // Update Supplier balance & create SupplierLedger & invoice
      if (grn.totalAmount.greaterThan(0)) {
        const updatedSupplier = await tx.supplier.update({
          where: { id: grn.supplierId },
          data: { balance: { increment: grn.totalAmount } }
        });

        await tx.supplierLedger.create({
          data: {
            supplierId: grn.supplierId,
            transactionType: 'INVOICE',
            debit: new Prisma.Decimal(0),
            credit: grn.totalAmount,
            balance: updatedSupplier.balance,
            referenceType: 'GRN',
            referenceId: grn.id,
            description: `Goods received on ${grn.grnNumber}${grn.invoiceNumber ? ` (Inv: ${grn.invoiceNumber})` : ''}`
          }
        });

        const invoiceNumber = `INV-${grn.grnNumber}`;
        await tx.purchaseInvoice.create({
          data: {
            companyId,
            supplierId: grn.supplierId,
            grnId: grn.id,
            invoiceNumber,
            totalAmount: grn.totalAmount,
            paidAmount: new Prisma.Decimal(0),
            status: 'UNPAID',
            notes: grn.invoiceNumber ? `Supplier Invoice: ${grn.invoiceNumber}` : undefined
          }
        });
      }

      const updatedGRN = await tx.goodsReceiveNote.update({
        where: { id: grnId },
        data: { status: 'QC_PASSED' },
        include: { items: true, warehouse: true, supplier: true }
      });

      await AuditService.log({
        userId: actorId,
        action: 'GOODS_RECEIVE_CONFIRMED',
        entity: 'GoodsReceiveNote',
        entityId: grn.id,
        details: { grnNumber: grn.grnNumber, totalAmount: grn.totalAmount.toString() },
        ipAddress,
        userAgent
      });

      return updatedGRN;
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async getGoodsReceiveNoteById(companyId: string, id: string) {
    const grn = await prisma.goodsReceiveNote.findFirst({
      where: { id, companyId },
      include: {
        branch: true,
        warehouse: true,
        supplier: true,
        po: { include: { items: { include: { item: true } } } },
        receivedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            item: { include: { unit: true, category: true } }
          }
        }
      }
    });

    if (!grn) {
      throw new AppError('Goods Receive Note not found', 404);
    }

    return grn;
  }

  public static async getGoodsReceiveNotes(
    companyId: string,
    params: { branchId?: string; warehouseId?: string; supplierId?: string; poId?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GoodsReceiveNoteWhereInput = {
      companyId,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.poId ? { poId: params.poId } : {})
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
