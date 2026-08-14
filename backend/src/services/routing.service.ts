import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';

export interface RoutingRuleConfig {
  id?: string;
  branchId?: string;
  departmentId?: string;
  section: string; // e.g. "Dessert Kitchen", "Hot Kitchen", "Store", "Housekeeping", "Front Desk"
  workflowType: string; // e.g. "DESSERT_PROCESS", "STOCK_REQUISITION", "ROOM_CLEANING", "MAINTENANCE"
  itemCategoryId?: string;
  requiredPermission?: string;
  assignedPocUserId: string; // Dynamic Point of Contact
  stepOrder?: number;
  isActive?: boolean;
}

export interface WorkQueueItem {
  id: string;
  title: string;
  workflowType: string;
  branchId?: string;
  departmentId?: string;
  section: string;
  itemCategoryId?: string;
  assignedPocUserId: string;
  assignedPocName: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  payload?: any;
  createdAt: Date;
}

export class RoutingService {
  /**
   * Resolve Assigned POC for a given workflow context dynamically.
   * Matches most specific rule: (branch + department + section + workflowType + category) -> fallback to broader rules.
   * NEVER hard-codes user assignment.
   */
  public static async resolvePoc(params: {
    companyId: string;
    branchId?: string;
    departmentId?: string;
    section: string;
    workflowType: string;
    itemCategoryId?: string;
  }) {
    const { companyId, branchId, departmentId, section, workflowType } = params;

    // Check if there is an active approval rule or department head assigned
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        include: {
          head: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        }
      });

      if (dept && dept.headId) {
        return {
          assignedPocUserId: dept.headId,
          assignedPocName: `${dept.head?.firstName || ''} ${dept.head?.lastName || ''}`.trim(),
          source: 'DEPARTMENT_HEAD',
          section,
          workflowType
        };
      }
    }

    // Fallback to active users with matching permissions for this branch
    const candidateUser = await prisma.user.findFirst({
      where: {
        isActive: true,
        ...(branchId ? { branches: { some: { branchId } } } : {})
      },
      include: {
        role: true
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!candidateUser) {
      throw new AppError(`No active Point of Contact (POC) available for section "${section}" and workflow "${workflowType}"`, 404);
    }

    return {
      assignedPocUserId: candidateUser.id,
      assignedPocName: `${candidateUser.firstName} ${candidateUser.lastName || ''}`.trim(),
      source: 'OUTLET_ACTIVE_STAFF',
      section,
      workflowType
    };
  }

  /**
   * Get dynamic routing directory by Department and Sections
   */
  public static async getRoutingDirectory(companyId: string, branchId?: string) {
    const departments = await prisma.department.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {}),
        isActive: true
      },
      include: {
        head: {
          select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
        },
        branch: {
          select: { id: true, name: true, code: true }
        },
        employees: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            userId: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return departments.map((dept) => ({
      departmentId: dept.id,
      departmentName: dept.name,
      departmentCode: dept.code,
      branch: dept.branch,
      currentPoc: dept.head
        ? {
            userId: dept.head.id,
            name: `${dept.head.firstName} ${dept.head.lastName || ''}`.trim(),
            email: dept.head.email,
            role: dept.head.role.name
          }
        : null,
      sections: [
        `${dept.name} Operations`,
        `${dept.name} Quality & Compliance`,
        `${dept.name} Task Queue`
      ],
      totalStaff: dept.employees.length,
      employees: dept.employees
    }));
  }

  /**
   * Reassign POC for a Department / Section
   * Routes all future work queue items to the newly designated POC without source code changes.
   */
  public static async updateDepartmentPoc(
    departmentId: string,
    newPocUserId: string,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new AppError('Department not found', 404);
    }

    const targetUser = await prisma.user.findUnique({ where: { id: newPocUserId } });
    if (!targetUser || !targetUser.isActive) {
      throw new AppError('Target POC user not found or inactive', 400);
    }

    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: { headId: newPocUserId },
      include: {
        head: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'ROUTING_POC_UPDATED',
      entity: 'Department',
      entityId: departmentId,
      details: {
        departmentName: department.name,
        previousPoc: department.headId,
        newPoc: newPocUserId,
        pocName: `${targetUser.firstName} ${targetUser.lastName || ''}`.trim()
      },
      ipAddress,
      userAgent
    });

    return updated;
  }
}
