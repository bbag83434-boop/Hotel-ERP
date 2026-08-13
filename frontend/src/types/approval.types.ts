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
  transactionType: ApprovalType;
  minAmount: number;
  requiredRole: string;
  stepNumber: number;
  isActive: boolean;
}

export interface ApprovalRequest {
  id: string;
  requestNumber: string;
  transactionType: ApprovalType;
  referenceId: string;
  amount?: number;
  title: string;
  description?: string;
  status: ApprovalStatus;
  requestedById: string;
  currentStep: number;
  totalSteps: number;
  createdAt: string;
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
  comment?: string;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string };
}
