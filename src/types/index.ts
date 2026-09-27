export interface ApprovalThresholds {
  autoApprovalEnabled: boolean;
  autoApprovalLimit: number;
  requireVerifiedVendor: boolean;
  requireZeroValidationErrors: boolean;
  requirePoMatch: boolean;
  minGlConfidence: number;
  managerApprovalLimit: number;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  country: string;
  defaultCurrency: string;
  timezone: string;
  plan: 'Starter' | 'Growth' | 'Pro';
  monthlyQuota: number;
  invoicesThisMonth: number;
  approvalThresholds?: ApprovalThresholds;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Accountant' | 'Approver' | 'Read-Only';
  organizationId: string;
  avatarUrl?: string;
}

export interface Vendor {
  id: string;
  organizationId: string;
  name: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  country: string;
  paymentTerms: string;
  defaultCurrency: string;
  defaultGlAccountId?: string;
  contactEmail?: string;
  status: 'Active' | 'Inactive';
  totalSpend: number;
  invoiceCount: number;
  riskScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
}

export interface GlAccount {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: 'Expense' | 'Asset' | 'Liability' | 'Cost of Goods Sold';
  isActive: boolean;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  glAccountId: string;
  glAccountCode?: string;
  glAccountName?: string;
  glSuggestionConfidence?: number;
  glReasoning?: string;
  sourceConfidence?: number;
}

export interface ValidationIssue {
  rule: string;
  status: 'PASS' | 'WARNING' | 'ERROR';
  message: string;
  field?: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  vendorId?: string;
  vendorName: string;
  vendorTaxId?: string;
  vendorAddress?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  purchaseOrderNumber?: string;
  processingStatus: 'Uploaded' | 'Processing' | 'Completed' | 'Failed';
  businessStatus: 'Draft' | 'Needs Review' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Exported';
  lines: InvoiceLine[];
  validationIssues: ValidationIssue[];
  fieldConfidences: Record<string, number>;
  documentUrl?: string;
  documentType?: 'pdf' | 'image' | 'sample';
  documentName?: string;
  uploadedBy: string;
  uploaderName?: string;
  assignedApproverId?: string;
  assignedApproverName?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  exportBatchId?: string;
  exportedAt?: string;
  externalRecordId?: string;
  accountingProvider?: string;
  paymentConfirmationDate?: string;
  paymentReferenceNumber?: string;
  paymentMethod?: string;
  paymentStatus?: 'Unpaid' | 'Scheduled' | 'Confirmed Paid';
  isDuplicate?: boolean;
  duplicateWarning?: string;
  duplicateOfId?: string;
  duplicateOfInvoiceNumber?: string;
  comments?: InvoiceComment[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceComment {
  id: string;
  invoiceId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  timestamp: string;
  lineItemId?: string;
  lineItemDescription?: string;
  category?: 'general' | 'line_item' | 'coding_issue' | 'tax' | 'approval';
  resolved?: boolean;
  taggedUserIds?: string[];
  taggedUserNames?: string[];
}

export interface AccountingConnection {
  id: string;
  organizationId: string;
  provider: 'quickbooks' | 'xero' | 'netsuite';
  providerName: string;
  status: 'connected' | 'disconnected' | 'error';
  companyName?: string;
  externalCompanyId?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  autoSyncOnApproval: boolean;
  defaultApAccountId?: string;
  syncFrequency: 'instant' | 'hourly' | 'daily' | 'manual';
  syncedBillsCount: number;
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  actorName: string;
  actorRole: string;
  entityType: 'Invoice' | 'Vendor' | 'GLAccount' | 'Export' | 'Organization';
  entityId: string;
  action: string;
  description: string;
  timestamp: string;
}

export interface ExportRecord {
  id: string;
  organizationId: string;
  format: 'CSV' | 'XLSX';
  invoiceCount: number;
  totalAmount: number;
  currency: string;
  generatedBy: string;
  invoiceNumbers: string[];
  createdAt: string;
}
