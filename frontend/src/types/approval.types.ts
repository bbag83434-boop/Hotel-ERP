export type ApprovalType =
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_ORDER'
  | 'EXPENSE'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_TRANSFER'
  | 'DISCOUNT'
  | 'REFUND'
  | 'SALARY_CHANGE'
  | 'PERMISSION_CHANGE';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApprovalRule {
  id: string;
  companyId: string;
  branchId?: string | null;
  transactionType: ApprovalType;
  minAmount: number | string;
  requiredRole: string;
  stepNumber: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string; code: string } | null;
}

export interface ApprovalRequest {
  id: string;
  companyId: string;
  branchId?: string | null;
  requestNumber: string;
  transactionType: ApprovalType;
  referenceId: string;
  amount?: number | string | null;
  title: string;
  description?: string | null;
  status: ApprovalStatus;
  requestedById: string;
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string; code: string } | null;
  requestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: { name: string };
  };
  actions?: ApprovalAction[];
}

export interface ApprovalAction {
  id: string;
  approvalRequestId: string;
  userId: string;
  userRole: string;
  action: ApprovalStatus;
  previousStatus: ApprovalStatus;
  newStatus: ApprovalStatus;
  comment?: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string };
}

export interface ApprovalSummary {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalRules: number;
  pendingByType: Array<{ type: ApprovalType; count: number }>;
}

export interface CreateApprovalRulePayload {
  branchId?: string;
  transactionType: ApprovalType;
  minAmount: number;
  requiredRole: string;
  stepNumber: number;
}

export interface UpdateApprovalRulePayload {
  branchId?: string;
  minAmount?: number;
  requiredRole?: string;
  stepNumber?: number;
  isActive?: boolean;
}

export interface ActOnApprovalPayload {
  action: ApprovalStatus;
  comment?: string;
}
