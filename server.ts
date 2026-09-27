import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialise Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Types & Interfaces
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

// In-Memory Database (Organized by Tenant)
const organizations: Organization[] = [
  {
    id: 'org-acme',
    name: 'Acme Technologies Inc.',
    country: 'United States',
    defaultCurrency: 'USD',
    timezone: 'America/New_York',
    plan: 'Growth',
    monthlyQuota: 250,
    invoicesThisMonth: 0,
    approvalThresholds: {
      autoApprovalEnabled: true,
      autoApprovalLimit: 750,
      requireVerifiedVendor: true,
      requireZeroValidationErrors: true,
      requirePoMatch: false,
      minGlConfidence: 85,
      managerApprovalLimit: 5000,
      lastUpdatedBy: 'Alex Vance (Admin)',
      lastUpdatedAt: '2026-09-20T10:00:00Z',
    },
  },
  {
    id: 'org-nexus',
    name: 'Nexus BioLabs Global',
    country: 'United Kingdom',
    defaultCurrency: 'GBP',
    timezone: 'Europe/London',
    plan: 'Starter',
    monthlyQuota: 50,
    invoicesThisMonth: 0,
    approvalThresholds: {
      autoApprovalEnabled: false,
      autoApprovalLimit: 250,
      requireVerifiedVendor: true,
      requireZeroValidationErrors: true,
      requirePoMatch: true,
      minGlConfidence: 90,
      managerApprovalLimit: 3000,
      lastUpdatedBy: 'Admin',
      lastUpdatedAt: '2026-09-15T08:00:00Z',
    },
  },
];

let currentUser: User = {
  id: 'usr-1',
  name: 'Alex Vance',
  email: 'alex.vance@acmetech.com',
  role: 'Admin',
  organizationId: 'org-acme',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
};

const users: User[] = [
  currentUser,
  {
    id: 'usr-2',
    name: 'Sarah Chen',
    email: 'sarah.chen@acmetech.com',
    role: 'Accountant',
    organizationId: 'org-acme',
  },
  {
    id: 'usr-3',
    name: 'Marcus Brody',
    email: 'marcus.brody@acmetech.com',
    role: 'Approver',
    organizationId: 'org-acme',
  },
  {
    id: 'usr-4',
    name: 'Elena Rostova',
    email: 'elena.r@acmetech.com',
    role: 'Read-Only',
    organizationId: 'org-acme',
  },
];

let glAccounts: GlAccount[] = [
  { id: 'gl-6010', organizationId: 'org-acme', code: '6010', name: 'Software & Cloud Infrastructure', type: 'Expense', isActive: true },
  { id: 'gl-6020', organizationId: 'org-acme', code: '6020', name: 'Office Rent & Facilities', type: 'Expense', isActive: true },
  { id: 'gl-6030', organizationId: 'org-acme', code: '6030', name: 'Hardware & Tech Equipment', type: 'Expense', isActive: true },
  { id: 'gl-6040', organizationId: 'org-acme', code: '6040', name: 'Professional & Legal Advisory', type: 'Expense', isActive: true },
  { id: 'gl-6050', organizationId: 'org-acme', code: '6050', name: 'Travel, Lodging & Client Meals', type: 'Expense', isActive: true },
  { id: 'gl-6060', organizationId: 'org-acme', code: '6060', name: 'Marketing & Digital Advertising', type: 'Expense', isActive: true },
  { id: 'gl-2000', organizationId: 'org-acme', code: '2000', name: 'Accounts Payable Clearing', type: 'Liability', isActive: true },
  { id: 'gl-5010', organizationId: 'org-acme', code: '5010', name: 'Hosting & Server Subscriptions', type: 'Cost of Goods Sold', isActive: true },
];

let vendors: Vendor[] = [];

let invoices: Invoice[] = [];

let auditEvents: AuditEvent[] = [];

let exportRecords: ExportRecord[] = [];

let accountingConnections: AccountingConnection[] = [
  {
    id: 'conn-qbo-1',
    organizationId: 'org-acme',
    provider: 'quickbooks',
    providerName: 'QuickBooks Online',
    status: 'disconnected',
    companyName: undefined,
    externalCompanyId: undefined,
    autoSyncOnApproval: false,
    defaultApAccountId: 'gl-2000',
    syncFrequency: 'manual',
    syncedBillsCount: 0,
  },
  {
    id: 'conn-xero-1',
    organizationId: 'org-acme',
    provider: 'xero',
    providerName: 'Xero Cloud Accounting',
    status: 'disconnected',
    companyName: undefined,
    externalCompanyId: undefined,
    autoSyncOnApproval: false,
    defaultApAccountId: 'gl-2000',
    syncFrequency: 'manual',
    syncedBillsCount: 0,
  },
  {
    id: 'conn-netsuite-1',
    organizationId: 'org-acme',
    provider: 'netsuite',
    providerName: 'Oracle NetSuite SuiteTalk',
    status: 'disconnected',
    companyName: undefined,
    externalCompanyId: undefined,
    autoSyncOnApproval: false,
    defaultApAccountId: 'gl-2000',
    syncFrequency: 'manual',
    syncedBillsCount: 0,
  },
  {
    id: 'conn-nexus-qbo',
    organizationId: 'org-nexus',
    provider: 'quickbooks',
    providerName: 'QuickBooks Online',
    status: 'disconnected',
    companyName: undefined,
    externalCompanyId: undefined,
    autoSyncOnApproval: false,
    defaultApAccountId: undefined,
    syncFrequency: 'manual',
    syncedBillsCount: 0,
  },
  {
    id: 'conn-nexus-xero',
    organizationId: 'org-nexus',
    provider: 'xero',
    providerName: 'Xero Cloud Accounting',
    status: 'disconnected',
    companyName: undefined,
    externalCompanyId: undefined,
    autoSyncOnApproval: false,
    defaultApAccountId: undefined,
    syncFrequency: 'manual',
    syncedBillsCount: 0,
  },
];

// ==========================================
// Duplicate Detection Service
// Checks if an invoice with the same vendor, date, and amount has already been processed
// or if a duplicate invoice number exists for the vendor.
// ==========================================
export interface DuplicateMatchResult {
  isDuplicate: boolean;
  matchType?: 'SAME_VENDOR_DATE_AMOUNT' | 'SAME_INVOICE_NUMBER' | 'BOTH';
  confidence: number;
  duplicateOfId?: string;
  duplicateOfInvoiceNumber?: string;
  duplicateOfStatus?: string;
  matchedVendor?: string;
  matchedDate?: string;
  matchedAmount?: number;
  message?: string;
}

function normalizeVendorName(name: string = ''): string {
  return name
    .toLowerCase()
    .replace(/[,\.\-\/\\_\(\)]/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|limited|co|company|solutions|technologies|services|gmbh|sa|bv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(d: string = ''): string {
  if (!d) return '';
  return d.trim().split('T')[0];
}

function detectDuplicateInvoice(
  inv: Partial<Invoice>,
  allInvoices: Invoice[],
  orgId: string
): DuplicateMatchResult {
  if (!inv) return { isDuplicate: false, confidence: 0 };

  const targetOrg = orgId || inv.organizationId;
  const currentVendorNorm = normalizeVendorName(inv.vendorName || '');
  const currentInvoiceNumNorm = (inv.invoiceNumber || '').replace(/[\s\-_]/g, '').toLowerCase();
  const currentDate = normalizeDate(inv.invoiceDate || '');
  const currentTotal = Number(inv.totalAmount || 0);

  // Candidates in the same organization, excluding this specific record
  const candidates = allInvoices.filter(i => i.organizationId === targetOrg && i.id !== inv.id);

  // 1. Primary Requirement: Check if an invoice with the same vendor, date, and amount has already been processed
  if (currentVendorNorm && currentDate && currentTotal > 0) {
    const matchedInvoice = candidates.find(existing => {
      // Vendor match
      const existingVendorNorm = normalizeVendorName(existing.vendorName || '');
      const vendorMatches = (Boolean(inv.vendorId) && Boolean(existing.vendorId) && inv.vendorId === existing.vendorId) ||
        existingVendorNorm === currentVendorNorm ||
        (existingVendorNorm.length > 3 && currentVendorNorm.length > 3 && (
          existingVendorNorm.includes(currentVendorNorm) || currentVendorNorm.includes(existingVendorNorm)
        ));

      if (!vendorMatches) return false;

      // Date match
      const existingDate = normalizeDate(existing.invoiceDate || '');
      const dateMatches = existingDate === currentDate;
      if (!dateMatches) return false;

      // Amount match (within 0.01 tolerance)
      const existingTotal = Number(existing.totalAmount || 0);
      const amountMatches = Math.abs(existingTotal - currentTotal) < 0.01;
      return amountMatches;
    });

    if (matchedInvoice) {
      const isSameNum = Boolean(currentInvoiceNumNorm) &&
        (matchedInvoice.invoiceNumber || '').replace(/[\s\-_]/g, '').toLowerCase() === currentInvoiceNumNorm;

      return {
        isDuplicate: true,
        matchType: isSameNum ? 'BOTH' : 'SAME_VENDOR_DATE_AMOUNT',
        confidence: isSameNum ? 0.99 : 0.95,
        duplicateOfId: matchedInvoice.id,
        duplicateOfInvoiceNumber: matchedInvoice.invoiceNumber,
        duplicateOfStatus: matchedInvoice.businessStatus,
        matchedVendor: matchedInvoice.vendorName,
        matchedDate: matchedInvoice.invoiceDate,
        matchedAmount: matchedInvoice.totalAmount,
        message: `Duplicate detected: Invoice #${matchedInvoice.invoiceNumber} with the same vendor ('${matchedInvoice.vendorName}'), date (${matchedInvoice.invoiceDate}), and amount ($${matchedInvoice.totalAmount.toFixed(2)}) has already been processed (Status: ${matchedInvoice.businessStatus}).`,
      };
    }
  }

  // 2. Secondary Check: Same Vendor and Same Invoice Number
  if (currentVendorNorm && currentInvoiceNumNorm) {
    const matchedNumber = candidates.find(existing => {
      const existingVendorNorm = normalizeVendorName(existing.vendorName || '');
      const existingInvoiceNumNorm = (existing.invoiceNumber || '').replace(/[\s\-_]/g, '').toLowerCase();
      const vendorMatches = (Boolean(inv.vendorId) && Boolean(existing.vendorId) && inv.vendorId === existing.vendorId) ||
        existingVendorNorm === currentVendorNorm ||
        (existingVendorNorm.length > 3 && currentVendorNorm.length > 3 && (
          existingVendorNorm.includes(currentVendorNorm) || currentVendorNorm.includes(existingVendorNorm)
        ));

      return vendorMatches && existingInvoiceNumNorm === currentInvoiceNumNorm;
    });

    if (matchedNumber) {
      return {
        isDuplicate: true,
        matchType: 'SAME_INVOICE_NUMBER',
        confidence: 0.98,
        duplicateOfId: matchedNumber.id,
        duplicateOfInvoiceNumber: matchedNumber.invoiceNumber,
        duplicateOfStatus: matchedNumber.businessStatus,
        matchedVendor: matchedNumber.vendorName,
        matchedDate: matchedNumber.invoiceDate,
        matchedAmount: matchedNumber.totalAmount,
        message: `Duplicate invoice number: #${matchedNumber.invoiceNumber} from '${matchedNumber.vendorName}' already exists (Status: ${matchedNumber.businessStatus}).`,
      };
    }
  }

  return { isDuplicate: false, confidence: 0 };
}

// Deterministic Validation Helper Function
function validateInvoice(inv: Partial<Invoice>, orgId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Required Fields
  if (!inv.vendorName?.trim()) {
    issues.push({ rule: 'required_vendor', status: 'ERROR', message: 'Vendor name is missing or empty.', field: 'vendorName' });
  }
  if (!inv.invoiceNumber?.trim()) {
    issues.push({ rule: 'required_number', status: 'ERROR', message: 'Invoice number is required.', field: 'invoiceNumber' });
  }
  if (!inv.invoiceDate?.trim()) {
    issues.push({ rule: 'required_date', status: 'ERROR', message: 'Invoice date is missing.', field: 'invoiceDate' });
  }
  if (!inv.totalAmount || inv.totalAmount <= 0) {
    issues.push({ rule: 'required_total', status: 'ERROR', message: 'Valid positive total amount is required.', field: 'totalAmount' });
  }

  // 2. Arithmetic Check
  const subtotal = inv.subtotal || 0;
  const tax = inv.taxAmount || 0;
  const discount = inv.discountAmount || 0;
  const total = inv.totalAmount || 0;
  const computedTotal = Math.round((subtotal + tax - discount) * 100) / 100;
  const diff = Math.abs(computedTotal - total);

  if (diff > 0.05) {
    issues.push({
      rule: 'arithmetic_check',
      status: 'ERROR',
      message: `Subtotal ($${subtotal.toFixed(2)}) + Tax ($${tax.toFixed(2)}) - Discount ($${discount.toFixed(2)}) = $${computedTotal.toFixed(2)}, which does not match total amount ($${total.toFixed(2)}). Variance: $${diff.toFixed(2)}.`,
    });
  } else {
    issues.push({
      rule: 'arithmetic_check',
      status: 'PASS',
      message: `Invoice arithmetic balances accurately ($${total.toFixed(2)}).`,
    });
  }

  // 3. Line Items Validation
  if (inv.lines && inv.lines.length > 0) {
    const linesSum = Math.round(inv.lines.reduce((sum, line) => sum + (line.lineTotal || 0), 0) * 100) / 100;
    const lineDiff = Math.abs(linesSum - subtotal);
    if (lineDiff > 0.05) {
      issues.push({
        rule: 'line_items_sum',
        status: 'WARNING',
        message: `Sum of line item totals ($${linesSum.toFixed(2)}) deviates from stated subtotal ($${subtotal.toFixed(2)}).`,
      });
    } else {
      issues.push({
        rule: 'line_items_sum',
        status: 'PASS',
        message: `All ${inv.lines.length} line items sum exactly to subtotal ($${subtotal.toFixed(2)}).`,
      });
    }

    const unassignedLines = inv.lines.filter(l => !l.glAccountId);
    if (unassignedLines.length > 0) {
      issues.push({
        rule: 'gl_account_check',
        status: 'WARNING',
        message: `${unassignedLines.length} line item(s) are missing general ledger (GL) account assignment.`,
      });
    } else {
      issues.push({
        rule: 'gl_account_check',
        status: 'PASS',
        message: `All line items are coded to approved GL accounts.`,
      });
    }
  }

  // 4. Duplicate Check (Vendor, Date, and Amount Service)
  const dupCheck = detectDuplicateInvoice(inv, invoices, orgId);
  if (dupCheck.isDuplicate) {
    issues.push({
      rule: 'duplicate_check',
      status: 'WARNING',
      message: dupCheck.message || 'Duplicate invoice detected with matching vendor, date, and amount.',
      field: 'totalAmount',
    });
  } else {
    issues.push({
      rule: 'duplicate_check',
      status: 'PASS',
      message: 'Duplicate check passed: No previous invoices found with matching vendor, date, and amount.',
    });
  }

  // 5. Vendor Match Check
  const currentVendorName = (inv.vendorName || '').trim().toLowerCase();
  const matchedVendor = currentVendorName
    ? vendors.find(
        v =>
          v.organizationId === orgId &&
          (v.name || '').trim().toLowerCase() === currentVendorName
      )
    : undefined;
  if (matchedVendor) {
    issues.push({
      rule: 'vendor_match',
      status: 'PASS',
      message: `Verified vendor profile: ${matchedVendor.name} (${matchedVendor.paymentTerms}).`,
    });
  } else if (inv.vendorName) {
    issues.push({
      rule: 'vendor_match',
      status: 'WARNING',
      message: `Vendor '${inv.vendorName}' is not currently in the organization directory. Review or create vendor profile.`,
    });
  }

  return issues;
}

// REST API Endpoints
// Organization & User Session
app.get('/api/session', (req, res) => {
  const currentOrg = organizations.find(o => o.id === currentUser.organizationId) || organizations[0];
  res.json({
    user: currentUser,
    organization: currentOrg,
    organizations,
    users: users.filter(u => u.organizationId === currentOrg.id),
  });
});

app.post('/api/session/switch-org', (req, res) => {
  const { organizationId } = req.body;
  const org = organizations.find(o => o.id === organizationId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  currentUser.organizationId = org.id;
  res.json({ success: true, organization: org, user: currentUser });
});

app.post('/api/session/switch-role', (req, res) => {
  const { role } = req.body;
  if (['Admin', 'Accountant', 'Approver', 'Read-Only'].includes(role)) {
    currentUser.role = role;
    res.json({ success: true, user: currentUser });
  } else {
    res.status(400).json({ error: 'Invalid role' });
  }
});

// Invoices CRUD & Workflow
app.get('/api/invoices', (req, res) => {
  const orgInvoices = invoices.filter(i => i.organizationId === currentUser.organizationId);
  // Dynamically evaluate duplicate status and payment confirmation data for every invoice
  orgInvoices.forEach(inv => {
    const dup = detectDuplicateInvoice(inv, invoices, currentUser.organizationId);
    inv.isDuplicate = dup.isDuplicate;
    inv.duplicateWarning = dup.isDuplicate ? dup.message : undefined;
    inv.duplicateOfId = dup.isDuplicate ? dup.duplicateOfId : undefined;
    inv.duplicateOfInvoiceNumber = dup.isDuplicate ? dup.duplicateOfInvoiceNumber : undefined;

    // Payment Confirmation & Remittance data
    if (inv.businessStatus === 'Exported') {
      inv.paymentStatus = 'Confirmed Paid';
      inv.paymentConfirmationDate = inv.paymentConfirmationDate || inv.exportedAt || '2026-06-25T14:30:00Z';
      inv.paymentReferenceNumber = inv.paymentReferenceNumber || `ACH-${(inv.invoiceNumber || '').replace(/[^a-zA-Z0-9]/g, '') || Math.floor(100000 + Math.random() * 900000)}`;
      inv.paymentMethod = inv.paymentMethod || 'ACH Direct Deposit';
    } else if (inv.businessStatus === 'Approved') {
      inv.paymentStatus = 'Scheduled';
      inv.paymentMethod = inv.paymentMethod || 'ACH Direct Deposit';
      inv.paymentReferenceNumber = inv.paymentReferenceNumber || `SCHED-${(inv.invoiceNumber || '').replace(/[^a-zA-Z0-9]/g, '') || 'BATCH'}`;
    } else {
      inv.paymentStatus = 'Unpaid';
    }
  });
  res.json({ invoices: orgInvoices });
});

app.get('/api/invoices/:id', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const dup = detectDuplicateInvoice(invoice, invoices, currentUser.organizationId);
  invoice.isDuplicate = dup.isDuplicate;
  invoice.duplicateWarning = dup.isDuplicate ? dup.message : undefined;
  invoice.duplicateOfId = dup.isDuplicate ? dup.duplicateOfId : undefined;
  invoice.duplicateOfInvoiceNumber = dup.isDuplicate ? dup.duplicateOfInvoiceNumber : undefined;

  if (invoice.businessStatus === 'Exported') {
    invoice.paymentStatus = 'Confirmed Paid';
    invoice.paymentConfirmationDate = invoice.paymentConfirmationDate || invoice.exportedAt || '2026-06-25T14:30:00Z';
    invoice.paymentReferenceNumber = invoice.paymentReferenceNumber || `ACH-${(invoice.invoiceNumber || '').replace(/[^a-zA-Z0-9]/g, '') || Math.floor(100000 + Math.random() * 900000)}`;
    invoice.paymentMethod = invoice.paymentMethod || 'ACH Direct Deposit';
  } else if (invoice.businessStatus === 'Approved') {
    invoice.paymentStatus = 'Scheduled';
    invoice.paymentMethod = invoice.paymentMethod || 'ACH Direct Deposit';
  } else {
    invoice.paymentStatus = 'Unpaid';
  }

  res.json({ invoice });
});

// Explicit duplicate check service endpoint
app.post('/api/invoices/detect-duplicate', (req, res) => {
  const { vendorName, vendorId, invoiceNumber, invoiceDate, totalAmount, excludeInvoiceId } = req.body;
  const result = detectDuplicateInvoice(
    {
      id: excludeInvoiceId,
      vendorName,
      vendorId,
      invoiceNumber,
      invoiceDate,
      totalAmount: Number(totalAmount) || 0,
    },
    invoices,
    currentUser.organizationId
  );
  res.json(result);
});

app.post('/api/invoices', (req, res) => {
  const newInvoiceData = req.body;
  const id = `inv-${Date.now()}`;
  const validationIssues = validateInvoice(newInvoiceData, currentUser.organizationId);
  const dupCheck = detectDuplicateInvoice(newInvoiceData, invoices, currentUser.organizationId);

  const invoice: Invoice = {
    id,
    organizationId: currentUser.organizationId,
    vendorName: newInvoiceData.vendorName || 'Unspecified Vendor',
    vendorId: newInvoiceData.vendorId,
    vendorTaxId: newInvoiceData.vendorTaxId,
    vendorAddress: newInvoiceData.vendorAddress,
    invoiceNumber: newInvoiceData.invoiceNumber || `INV-${Date.now().toString().slice(-5)}`,
    invoiceDate: newInvoiceData.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: newInvoiceData.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    currency: newInvoiceData.currency || 'USD',
    subtotal: Number(newInvoiceData.subtotal || 0),
    discountAmount: Number(newInvoiceData.discountAmount || 0),
    taxAmount: Number(newInvoiceData.taxAmount || 0),
    totalAmount: Number(newInvoiceData.totalAmount || 0),
    purchaseOrderNumber: newInvoiceData.purchaseOrderNumber,
    processingStatus: 'Completed',
    businessStatus: 'Needs Review',
    isDuplicate: dupCheck.isDuplicate,
    duplicateWarning: dupCheck.isDuplicate ? dupCheck.message : undefined,
    duplicateOfId: dupCheck.isDuplicate ? dupCheck.duplicateOfId : undefined,
    duplicateOfInvoiceNumber: dupCheck.isDuplicate ? dupCheck.duplicateOfInvoiceNumber : undefined,
    lines: (newInvoiceData.lines || []).map((l: any, idx: number) => ({
      ...l,
      id: l.id || `line-${Date.now()}-${idx}`,
    })),
    validationIssues,
    fieldConfidences: newInvoiceData.fieldConfidences || { totalAmount: 1.0 },
    documentType: newInvoiceData.documentType || 'sample',
    documentName: newInvoiceData.documentName || 'Uploaded_Invoice.pdf',
    uploadedBy: currentUser.id,
    uploaderName: currentUser.name,
    assignedApproverId: 'usr-3',
    assignedApproverName: 'Marcus Brody',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  invoices.unshift(invoice);

  // Update Org usage
  const org = organizations.find(o => o.id === currentUser.organizationId);
  if (org) org.invoicesThisMonth += 1;

  if (evaluateAutoApproval(invoice, org)) {
    invoice.businessStatus = 'Approved';
    invoice.approvedBy = `System Auto-Approval (Threshold <= $${org?.approvalThresholds?.autoApprovalLimit})`;
    invoice.approvedAt = new Date().toISOString();

    auditEvents.unshift({
      id: `aud-${Date.now()}-auto`,
      organizationId: currentUser.organizationId,
      actorName: 'System (Auto-Approval Policy)',
      actorRole: 'Workflow Engine',
      entityType: 'Invoice',
      entityId: invoice.id,
      action: 'INVOICE_AUTO_APPROVED',
      description: `Autonomous auto-approval granted to #${invoice.invoiceNumber} ($${invoice.totalAmount.toFixed(2)}) based on approval threshold`,
      timestamp: new Date().toISOString(),
    });
  }

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Invoice',
    entityId: invoice.id,
    action: 'INVOICE_CREATED',
    description: `Created invoice #${invoice.invoiceNumber} for ${invoice.vendorName} ($${invoice.totalAmount.toFixed(2)})${dupCheck.isDuplicate ? ' [DUPLICATE FLAGGED]' : ''}`,
    timestamp: new Date().toISOString(),
  });

  res.json({ invoice });
});

app.put('/api/invoices/:id', (req, res) => {
  const index = invoices.findIndex(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (index === -1) return res.status(404).json({ error: 'Invoice not found' });

  const existing = invoices[index];
  const update = req.body;

  // Run validation & duplicate detection
  const merged = { ...existing, ...update };
  const validationIssues = validateInvoice(merged, currentUser.organizationId);
  const dupCheck = detectDuplicateInvoice(merged, invoices, currentUser.organizationId);

  const updatedInvoice: Invoice = {
    ...existing,
    ...update,
    validationIssues,
    isDuplicate: dupCheck.isDuplicate,
    duplicateWarning: dupCheck.isDuplicate ? dupCheck.message : undefined,
    duplicateOfId: dupCheck.isDuplicate ? dupCheck.duplicateOfId : undefined,
    duplicateOfInvoiceNumber: dupCheck.isDuplicate ? dupCheck.duplicateOfInvoiceNumber : undefined,
    updatedAt: new Date().toISOString(),
  };

  invoices[index] = updatedInvoice;

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Invoice',
    entityId: existing.id,
    action: 'INVOICE_MODIFIED',
    description: `Updated invoice fields for #${updatedInvoice.invoiceNumber}`,
    timestamp: new Date().toISOString(),
  });

  res.json({ invoice: updatedInvoice });
});

app.post('/api/invoices/:id/submit-approval', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  // Verify non-blocking errors
  const hasBlockingErrors = invoice.validationIssues.some(v => v.status === 'ERROR');
  if (hasBlockingErrors) {
    return res.status(400).json({ error: 'Cannot submit invoice with unresolved blocking validation errors.' });
  }

  invoice.businessStatus = 'Pending Approval';
  invoice.assignedApproverId = 'usr-3';
  invoice.assignedApproverName = 'Marcus Brody';
  invoice.updatedAt = new Date().toISOString();

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Invoice',
    entityId: invoice.id,
    action: 'SUBMITTED_FOR_APPROVAL',
    description: `Submitted invoice #${invoice.invoiceNumber} to ${invoice.assignedApproverName} for authorization`,
    timestamp: new Date().toISOString(),
  });

  res.json({ invoice });
});

app.post('/api/invoices/:id/approve', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (currentUser.role !== 'Admin' && currentUser.role !== 'Approver') {
    return res.status(403).json({ error: 'Only authorized Approvers or Admins can approve invoices.' });
  }

  invoice.businessStatus = 'Approved';
  invoice.approvedBy = currentUser.name;
  invoice.approvedAt = new Date().toISOString();
  invoice.updatedAt = new Date().toISOString();

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Invoice',
    entityId: invoice.id,
    action: 'INVOICE_APPROVED',
    description: `Authorized payment for invoice #${invoice.invoiceNumber} ($${invoice.totalAmount.toFixed(2)})`,
    timestamp: new Date().toISOString(),
  });

  // Automated Sync: If an active connection has autoSyncOnApproval enabled, post bill immediately
  const activeConn = accountingConnections.find(
    c => c.organizationId === currentUser.organizationId && c.status === 'connected' && c.autoSyncOnApproval
  );
  if (activeConn) {
    const prefix = activeConn.provider === 'quickbooks' ? 'QBO-BILL' : activeConn.provider === 'xero' ? 'XERO-BILL' : 'NS-BILL';
    invoice.businessStatus = 'Exported';
    invoice.externalRecordId = `${prefix}-${(invoice.invoiceNumber || '').replace(/[^a-zA-Z0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
    invoice.accountingProvider = activeConn.providerName;
    invoice.exportedAt = new Date().toISOString();
    activeConn.syncedBillsCount += 1;
    activeConn.lastSyncAt = new Date().toISOString();

    auditEvents.unshift({
      id: `aud-${Date.now()}-sync`,
      organizationId: currentUser.organizationId,
      actorName: 'System (Auto-Sync)',
      actorRole: 'Integration Service',
      entityType: 'Invoice',
      entityId: invoice.id,
      action: 'BILL_POSTED',
      description: `Auto-posted approved bill #${invoice.invoiceNumber} ($${invoice.totalAmount.toFixed(2)}) directly to ${activeConn.providerName} (Ref: ${invoice.externalRecordId})`,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({ invoice });
});

app.post('/api/invoices/:id/reject', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const { reason } = req.body;
  invoice.businessStatus = 'Rejected';
  invoice.rejectionReason = reason || 'Rejected during financial review';
  invoice.updatedAt = new Date().toISOString();

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Invoice',
    entityId: invoice.id,
    action: 'INVOICE_REJECTED',
    description: `Rejected invoice #${invoice.invoiceNumber}: ${invoice.rejectionReason}`,
    timestamp: new Date().toISOString(),
  });

  res.json({ invoice });
});

// Bulk Invoice Approval
app.post('/api/invoices/bulk-approve', (req, res) => {
  const { invoiceIds } = req.body;
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ error: 'invoiceIds array is required' });
  }

  if (currentUser.role !== 'Admin' && currentUser.role !== 'Approver') {
    return res.status(403).json({ error: 'Only authorized Approvers or Admins can approve invoices.' });
  }

  const updatedInvoices: Invoice[] = [];
  const activeConn = accountingConnections.find(
    c => c.organizationId === currentUser.organizationId && c.status === 'connected' && c.autoSyncOnApproval
  );

  for (const id of invoiceIds) {
    const invoice = invoices.find(i => i.id === id && i.organizationId === currentUser.organizationId);
    if (!invoice) continue;

    invoice.businessStatus = 'Approved';
    invoice.approvedBy = currentUser.name;
    invoice.approvedAt = new Date().toISOString();
    invoice.updatedAt = new Date().toISOString();

    auditEvents.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      organizationId: currentUser.organizationId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      entityType: 'Invoice',
      entityId: invoice.id,
      action: 'INVOICE_APPROVED',
      description: `Bulk approved invoice #${invoice.invoiceNumber} ($${invoice.totalAmount.toFixed(2)}) by ${currentUser.name}`,
      timestamp: new Date().toISOString(),
    });

    if (activeConn) {
      const prefix = activeConn.provider === 'quickbooks' ? 'QBO-BILL' : activeConn.provider === 'xero' ? 'XERO-BILL' : 'NS-BILL';
      invoice.businessStatus = 'Exported';
      invoice.externalRecordId = `${prefix}-${(invoice.invoiceNumber || '').replace(/[^a-zA-Z0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
      invoice.accountingProvider = activeConn.providerName;
      invoice.exportedAt = new Date().toISOString();
      activeConn.syncedBillsCount += 1;
      activeConn.lastSyncAt = new Date().toISOString();
    }

    updatedInvoices.push(invoice);
  }

  res.json({ updatedCount: updatedInvoices.length, invoices: updatedInvoices });
});

// Bulk Invoice Rejection
app.post('/api/invoices/bulk-reject', (req, res) => {
  const { invoiceIds, reason } = req.body;
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ error: 'invoiceIds array is required' });
  }

  const updatedInvoices: Invoice[] = [];
  const rejectReason = reason?.trim() || 'Rejected during bulk review';

  for (const id of invoiceIds) {
    const invoice = invoices.find(i => i.id === id && i.organizationId === currentUser.organizationId);
    if (!invoice) continue;

    invoice.businessStatus = 'Rejected';
    invoice.rejectionReason = rejectReason;
    invoice.updatedAt = new Date().toISOString();

    auditEvents.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      organizationId: currentUser.organizationId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      entityType: 'Invoice',
      entityId: invoice.id,
      action: 'INVOICE_REJECTED',
      description: `Bulk rejected invoice #${invoice.invoiceNumber}: ${rejectReason}`,
      timestamp: new Date().toISOString(),
    });

    updatedInvoices.push(invoice);
  }

  res.json({ updatedCount: updatedInvoices.length, invoices: updatedInvoices });
});

// Internal Review Comments Thread Endpoints
app.get('/api/invoices/:id/comments', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ comments: invoice.comments || [] });
});

app.post('/api/invoices/:id/comments', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const { content, lineItemId, lineItemDescription, category, taggedUserIds, taggedUserNames } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content is required.' });
  }

  // Detect any @mentions if not explicitly provided
  const resolvedTaggedIds: string[] = Array.isArray(taggedUserIds) ? [...taggedUserIds] : [];
  const resolvedTaggedNames: string[] = Array.isArray(taggedUserNames) ? [...taggedUserNames] : [];

  users.forEach(u => {
    if (content.includes(`@${u.name}`) && !resolvedTaggedNames.includes(u.name)) {
      resolvedTaggedNames.push(u.name);
      if (!resolvedTaggedIds.includes(u.id)) {
        resolvedTaggedIds.push(u.id);
      }
    }
  });

  const newComment: InvoiceComment = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    invoiceId: invoice.id,
    authorId: currentUser.id,
    authorName: currentUser.name,
    authorRole: currentUser.role,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    lineItemId: lineItemId || undefined,
    lineItemDescription: lineItemDescription || undefined,
    category: category || (lineItemId ? 'line_item' : 'general'),
    resolved: false,
    taggedUserIds: resolvedTaggedIds.length > 0 ? resolvedTaggedIds : undefined,
    taggedUserNames: resolvedTaggedNames.length > 0 ? resolvedTaggedNames : undefined,
  };

  if (!invoice.comments) {
    invoice.comments = [];
  }
  invoice.comments.push(newComment);
  invoice.updatedAt = new Date().toISOString();

  // Audit event for comment thread with mention tag context
  const targetDesc = lineItemDescription ? ` on line item "${lineItemDescription.slice(0, 30)}..."` : '';
  const mentionDesc = resolvedTaggedNames.length > 0 ? ` (tagged @${resolvedTaggedNames.join(', @')})` : '';

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Invoice',
    entityId: invoice.id,
    action: resolvedTaggedNames.length > 0 ? 'TEAM_MEMBER_TAGGED' : 'COMMENT_ADDED',
    description: `Added review comment${targetDesc}${mentionDesc} on #${invoice.invoiceNumber}: "${content.slice(0, 45)}${content.length > 45 ? '...' : ''}"`,
    timestamp: new Date().toISOString(),
  });

  res.json({ comment: newComment, comments: invoice.comments, invoice });
});

app.patch('/api/invoices/:id/comments/:commentId', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (!invoice.comments) invoice.comments = [];
  const comment = invoice.comments.find(c => c.id === req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  if (req.body.resolved !== undefined) {
    comment.resolved = Boolean(req.body.resolved);
    auditEvents.unshift({
      id: `aud-${Date.now()}`,
      organizationId: currentUser.organizationId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      entityType: 'Invoice',
      entityId: invoice.id,
      action: comment.resolved ? 'COMMENT_RESOLVED' : 'COMMENT_REOPENED',
      description: `${comment.resolved ? 'Resolved' : 'Reopened'} review comment on #${invoice.invoiceNumber}`,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.body.content && req.body.content.trim()) {
    comment.content = req.body.content.trim();
  }

  invoice.updatedAt = new Date().toISOString();
  res.json({ comment, comments: invoice.comments, invoice });
});

app.delete('/api/invoices/:id/comments/:commentId', (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id && i.organizationId === currentUser.organizationId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (!invoice.comments) invoice.comments = [];
  const initialLength = invoice.comments.length;
  invoice.comments = invoice.comments.filter(c => c.id !== req.params.commentId);

  if (invoice.comments.length === initialLength) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  invoice.updatedAt = new Date().toISOString();
  res.json({ comments: invoice.comments, invoice });
});

// AI Invoice Extraction via Gemini
app.post('/api/ai/extract-invoice', async (req, res) => {
  try {
    const { documentBase64, documentUrl, mimeType, filename, sampleType } = req.body;
    let cleanMime = (mimeType || 'application/pdf').toLowerCase();
    if (cleanMime === 'image/jpg') cleanMime = 'image/jpeg';

    const orgGlAccounts = glAccounts.filter(g => g.organizationId === currentUser.organizationId);
    const orgVendors = vendors.filter(v => v.organizationId === currentUser.organizationId);

    const glAccountsContext = orgGlAccounts.map(g => `${g.code} - ${g.name} (${g.type})`).join('\n');
    const vendorsContext = orgVendors.map(v => `${v.name} (TaxId: ${v.taxId || 'N/A'}, DefaultGL: ${v.defaultGlAccountId || 'None'})`).join('\n');

    const promptText = `You are a high-precision corporate Accounts Payable (AP) and Document AI parsing engine.
Extract all structured accounting data from this supplier invoice document.
Chart of Accounts available in this organization:
${glAccountsContext}

Existing active vendors:
${vendorsContext}

CRITICAL RULES:
1. Extract exact numerical amounts from this document. Never fabricate invoice numbers or amounts.
2. Determine line items with precise descriptions, unit quantities, unit prices, tax amounts, and line totals as shown on the document.
3. Suggest the most appropriate GL account from the Chart of Accounts list for each line item, providing reasoning and confidence (0.0 to 1.0).
4. Provide confidence scores (0.0 to 1.0) for main fields.
5. If the provided document is a synthetic sample prompt: "${sampleType || 'standard supplier invoice'}", extract or synthesize realistic enterprise supplier data.

Return ONLY valid JSON matching this structure:
{
  "vendorName": string,
  "vendorAddress": string,
  "vendorTaxId": string,
  "invoiceNumber": string,
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "currency": "USD" | "EUR" | "GBP",
  "subtotal": number,
  "taxAmount": number,
  "discountAmount": number,
  "totalAmount": number,
  "purchaseOrderNumber": string,
  "fieldConfidences": {
    "vendorName": number,
    "invoiceNumber": number,
    "invoiceDate": number,
    "dueDate": number,
    "totalAmount": number,
    "taxAmount": number
  },
  "lines": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "taxRate": number,
      "taxAmount": number,
      "lineTotal": number,
      "suggestedGlCode": string,
      "suggestedGlName": string,
      "glSuggestionConfidence": number,
      "glReasoning": string
    }
  ]
}`;

    let parsedResult: any = null;

    if (process.env.GEMINI_API_KEY) {
      let contentsPayload: any;

      if (documentBase64 && cleanMime) {
        contentsPayload = {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: documentBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        };
      } else {
        contentsPayload = `${promptText}\n\nInvoice Context / Sample Reference: ${sampleType || 'Enterprise SaaS software subscription'}`;
      }

      // Try multiple models in case one experiences a temporary 503 spike
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: contentsPayload,
            config: {
              responseMimeType: 'application/json',
            },
          });

          if (response.text) {
            parsedResult = JSON.parse(response.text.trim());
            console.log(`Successfully extracted invoice using model: ${model}`);
            break;
          }
        } catch (geminiErr: any) {
          console.warn(`Extraction with ${model} failed (${geminiErr.message || geminiErr}). Trying candidate...`);
        }
      }
    }

    // High quality fallback handling:
    // Only use synthetic samples if the user explicitly clicked a sample invoice!
    const isUserUpload = Boolean(documentBase64 || documentUrl);

    if (!parsedResult) {
      if (isUserUpload) {
        // For actual user uploads, parse clean metadata from the user's real file rather than inventing a fake company!
        const cleanName = (filename || 'Uploaded Document').replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ');
        const invNumMatch = cleanName.match(/(?:inv|bill|no|#)[\s\-_:]*([a-z0-9\-]+)/i);
        const detectedNum = invNumMatch ? invNumMatch[1].toUpperCase() : `INV-${Date.now().toString().slice(-6)}`;
        const inferredVendor = cleanName.replace(/(?:inv|bill|invoice|receipt)[\s\-_:]*[a-z0-9\-]+/gi, '').trim() || cleanName;

        parsedResult = {
          vendorName: inferredVendor || 'Uploaded Supplier Document',
          vendorAddress: '',
          vendorTaxId: '',
          invoiceNumber: detectedNum,
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          currency: 'USD',
          subtotal: 0.00,
          taxAmount: 0.00,
          discountAmount: 0.00,
          totalAmount: 0.00,
          purchaseOrderNumber: '',
          fieldConfidences: {
            vendorName: 0.70,
            invoiceNumber: 0.70,
            invoiceDate: 0.80,
            dueDate: 0.70,
            totalAmount: 0.50,
            taxAmount: 0.50,
          },
          lines: [
            {
              description: `Uploaded invoice line items from ${filename || 'document'}`,
              quantity: 1,
              unitPrice: 0.00,
              taxRate: 0.08,
              taxAmount: 0.00,
              lineTotal: 0.00,
              suggestedGlCode: orgGlAccounts[0]?.code || '6010',
              suggestedGlName: orgGlAccounts[0]?.name || 'Software & Cloud Infrastructure',
              glSuggestionConfidence: 0.75,
              glReasoning: 'Draft created from uploaded document. Review and confirm amounts against document viewer.',
            },
          ],
        };
      } else {
        // Pre-loaded sample invoices
        const sampleKey = ((sampleType || '') + ' ' + (filename || '')).toLowerCase();
        if (sampleKey.includes('github')) {
          parsedResult = {
            vendorName: 'GitHub, Inc.',
            vendorAddress: '88 Colin P Kelly Jr St, San Francisco, CA 94107',
            vendorTaxId: 'US-262910399',
            invoiceNumber: `GH-ENT-${Math.floor(100000 + Math.random() * 900000)}`,
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            currency: 'USD',
            subtotal: 2450.00,
            taxAmount: 196.00,
            discountAmount: 0.00,
            totalAmount: 2646.00,
            purchaseOrderNumber: 'PO-2026-118',
            fieldConfidences: {
              vendorName: 0.99,
              invoiceNumber: 0.98,
              invoiceDate: 0.99,
              dueDate: 0.97,
              totalAmount: 0.99,
              taxAmount: 0.96,
            },
            lines: [
              {
                description: 'GitHub Enterprise Cloud Seats (50 Users Annual License)',
                quantity: 50,
                unitPrice: 21.00,
                taxRate: 0.08,
                taxAmount: 84.00,
                lineTotal: 1050.00,
                suggestedGlCode: '6010',
                suggestedGlName: 'Software & Cloud Infrastructure',
                glSuggestionConfidence: 0.98,
                glReasoning: 'Code repository and CI/CD licenses coded to Software GL.',
              },
              {
                description: 'GitHub Copilot Business Add-on (70 Seats)',
                quantity: 70,
                unitPrice: 20.00,
                taxRate: 0.08,
                taxAmount: 112.00,
                lineTotal: 1400.00,
                suggestedGlCode: '6010',
                suggestedGlName: 'Software & Cloud Infrastructure',
                glSuggestionConfidence: 0.97,
                glReasoning: 'AI developer tools coded to Software & Cloud Infrastructure.',
              },
            ],
          };
        } else if (sampleKey.includes('figma')) {
          parsedResult = {
            vendorName: 'Figma, Inc.',
            vendorAddress: '767 Market St, Suite 400, San Francisco, CA 94103',
            vendorTaxId: 'US-472019482',
            invoiceNumber: `FIG-${Math.floor(100000 + Math.random() * 900000)}`,
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
            currency: 'USD',
            subtotal: 1800.00,
            taxAmount: 144.00,
            discountAmount: 0.00,
            totalAmount: 1944.00,
            purchaseOrderNumber: 'PO-2026-122',
            fieldConfidences: {
              vendorName: 0.99,
              invoiceNumber: 0.99,
              invoiceDate: 0.98,
              dueDate: 0.97,
              totalAmount: 0.99,
              taxAmount: 0.95,
            },
            lines: [
              {
                description: 'Figma Enterprise Design & FigJam Collaboration Suite (Annual)',
                quantity: 1,
                unitPrice: 1800.00,
                taxRate: 0.08,
                taxAmount: 144.00,
                lineTotal: 1800.00,
                suggestedGlCode: '6010',
                suggestedGlName: 'Software & Cloud Infrastructure',
                glSuggestionConfidence: 0.96,
                glReasoning: 'Product design SaaS subscription mapped to 6010.',
              },
            ],
          };
        } else {
          parsedResult = {
            vendorName: 'Snowflake Computing UK Ltd',
            vendorAddress: '100 Bishopsgate, London EC2N 4AG, United Kingdom',
            vendorTaxId: 'GB-318491029',
            invoiceNumber: `SNOW-${Math.floor(100000 + Math.random() * 900000)}`,
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            currency: 'USD',
            subtotal: 3600.00,
            taxAmount: 288.00,
            discountAmount: 0.00,
            totalAmount: 3888.00,
            purchaseOrderNumber: 'PO-2026-144',
            fieldConfidences: {
              vendorName: 0.99,
              invoiceNumber: 0.98,
              invoiceDate: 0.99,
              dueDate: 0.97,
              totalAmount: 0.99,
              taxAmount: 0.96,
            },
            lines: [
              {
                description: 'Snowflake Data Cloud Enterprise Capacity Units (Compute & Storage)',
                quantity: 1,
                unitPrice: 3600.00,
                taxRate: 0.08,
                taxAmount: 288.00,
                lineTotal: 3600.00,
                suggestedGlCode: '6010',
                suggestedGlName: 'Software & Cloud Infrastructure',
                glSuggestionConfidence: 0.97,
                glReasoning: 'Cloud data warehouse matches Software & Cloud Infrastructure GL.',
              },
            ],
          };
        }
      }
    }

    // Map suggested GL to actual ID in tenant
    const mappedLines: InvoiceLine[] = (parsedResult.lines || []).map((l: any, idx: number) => {
      const match = orgGlAccounts.find(g => g.code === l.suggestedGlCode) || orgGlAccounts[0];
      return {
        id: `line-ext-${Date.now()}-${idx}`,
        description: l.description || 'Extracted item',
        quantity: Number(l.quantity || 1),
        unitPrice: Number(l.unitPrice || l.lineTotal || 0),
        taxRate: Number(l.taxRate || 0.08),
        taxAmount: Number(l.taxAmount || 0),
        lineTotal: Number(l.lineTotal || 0),
        glAccountId: match ? match.id : '',
        glAccountCode: match ? match.code : l.suggestedGlCode,
        glAccountName: match ? match.name : l.suggestedGlName,
        glSuggestionConfidence: l.glSuggestionConfidence || 0.94,
        glReasoning: l.glReasoning || 'AI inferred category based on line item semantics.',
        sourceConfidence: 0.98,
      };
    });

    // Check matched vendor safely
    const vNameClean = (parsedResult.vendorName || '').trim().toLowerCase();
    const existingVendor = vNameClean
      ? orgVendors.find(v => (v.name || '').trim().toLowerCase() === vNameClean)
      : undefined;

    const finalDocUrl = documentUrl || (documentBase64 && cleanMime ? `data:${cleanMime};base64,${documentBase64}` : undefined);

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      organizationId: currentUser.organizationId,
      vendorName: parsedResult.vendorName || 'Unspecified Vendor',
      vendorId: existingVendor ? existingVendor.id : undefined,
      vendorTaxId: parsedResult.vendorTaxId || undefined,
      vendorAddress: parsedResult.vendorAddress || undefined,
      invoiceNumber: parsedResult.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      invoiceDate: parsedResult.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: parsedResult.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: parsedResult.currency || 'USD',
      subtotal: Number(parsedResult.subtotal || 0),
      taxAmount: Number(parsedResult.taxAmount || 0),
      discountAmount: Number(parsedResult.discountAmount || 0),
      totalAmount: Number(parsedResult.totalAmount || 0),
      purchaseOrderNumber: parsedResult.purchaseOrderNumber || undefined,
      processingStatus: 'Completed',
      businessStatus: 'Needs Review',
      lines: mappedLines,
      fieldConfidences: parsedResult.fieldConfidences || { totalAmount: 0.98 },
      validationIssues: [],
      documentType: cleanMime?.includes('image') ? 'image' : cleanMime?.includes('pdf') ? 'pdf' : 'sample',
      documentName: filename || 'Extracted_Invoice.pdf',
      documentUrl: finalDocUrl,
      uploadedBy: currentUser.id,
      uploaderName: currentUser.name,
      assignedApproverId: 'usr-3',
      assignedApproverName: 'Marcus Brody',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    newInvoice.validationIssues = validateInvoice(newInvoice, currentUser.organizationId);
    const dupCheck = detectDuplicateInvoice(newInvoice, invoices, currentUser.organizationId);
    newInvoice.isDuplicate = dupCheck.isDuplicate;
    newInvoice.duplicateWarning = dupCheck.isDuplicate ? dupCheck.message : undefined;
    newInvoice.duplicateOfId = dupCheck.isDuplicate ? dupCheck.duplicateOfId : undefined;
    newInvoice.duplicateOfInvoiceNumber = dupCheck.isDuplicate ? dupCheck.duplicateOfInvoiceNumber : undefined;

    invoices.unshift(newInvoice);

    // Track usage
    const org = organizations.find(o => o.id === currentUser.organizationId);
    if (org) org.invoicesThisMonth += 1;

    auditEvents.unshift({
      id: `aud-${Date.now()}`,
      organizationId: currentUser.organizationId,
      actorName: 'Acanty Document AI',
      actorRole: 'System',
      entityType: 'Invoice',
      entityId: newInvoice.id,
      action: 'AI_EXTRACTED',
      description: `Parsed ${newInvoice.lines.length} lines from ${newInvoice.documentName} for ${newInvoice.vendorName}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ invoice: newInvoice });
  } catch (err: any) {
    console.error('Invoice extraction failed:', err);
    res.status(500).json({ error: err.message || 'Invoice extraction failed' });
  }
});

// Vendors Management
app.get('/api/vendors', (req, res) => {
  const orgVendors = vendors.filter(v => v.organizationId === currentUser.organizationId);
  const orgInvoices = invoices.filter(i => i.organizationId === currentUser.organizationId);

  const enrichedVendors = orgVendors.map(v => {
    const vInvs = orgInvoices.filter(i => i.vendorId === v.id || (i.vendorName && i.vendorName.toLowerCase() === v.name.toLowerCase()));
    const totalCount = Math.max(vInvs.length, v.invoiceCount || 0);

    const rejectedCount = vInvs.filter(i => i.businessStatus === 'Rejected').length;
    const rejectionRate = totalCount > 0 ? (rejectedCount / totalCount) * 100 : 0;

    let lateCount = 0;
    vInvs.forEach(inv => {
      if (!inv.dueDate) return;
      const isPastDue = inv.dueDate < '2026-09-26' && inv.businessStatus !== 'Approved' && inv.businessStatus !== 'Exported';
      const approvedLate = inv.approvedAt && inv.approvedAt.split('T')[0] > inv.dueDate;
      if (isPastDue || approvedLate) lateCount++;
    });
    const lateRate = totalCount > 0 ? (lateCount / totalCount) * 100 : 0;

    let score = 10;
    if (rejectedCount > 0) score += Math.round(rejectionRate * 0.5 + rejectedCount * 18);
    if (lateCount > 0) score += Math.round(lateRate * 0.35 + lateCount * 12);
    score = Math.min(99, Math.max(5, score));

    const level: 'Low' | 'Medium' | 'High' = score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low';
    return {
      ...v,
      riskScore: score,
      riskLevel: level,
    };
  });

  res.json({ vendors: enrichedVendors });
});

app.post('/api/vendors', (req, res) => {
  const { name, legalName, taxId, address, country, paymentTerms, defaultCurrency, defaultGlAccountId, contactEmail } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Vendor name is required' });

  const vendor: Vendor = {
    id: `v-${Date.now()}`,
    organizationId: currentUser.organizationId,
    name: name.trim(),
    legalName,
    taxId,
    address,
    country: country || 'United States',
    paymentTerms: paymentTerms || 'Net 30',
    defaultCurrency: defaultCurrency || 'USD',
    defaultGlAccountId,
    contactEmail,
    status: 'Active',
    totalSpend: 0,
    invoiceCount: 0,
  };

  vendors.unshift(vendor);

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Vendor',
    entityId: vendor.id,
    action: 'VENDOR_CREATED',
    description: `Added vendor profile for ${vendor.name}`,
    timestamp: new Date().toISOString(),
  });

  res.json({ vendor });
});

app.put('/api/vendors/:id', (req, res) => {
  const index = vendors.findIndex(v => v.id === req.params.id && v.organizationId === currentUser.organizationId);
  if (index === -1) return res.status(404).json({ error: 'Vendor not found' });
  vendors[index] = { ...vendors[index], ...req.body };
  res.json({ vendor: vendors[index] });
});

// Chart of Accounts (GL Accounts)
app.get('/api/gl-accounts', (req, res) => {
  const orgAccounts = glAccounts.filter(g => g.organizationId === currentUser.organizationId);
  res.json({ glAccounts: orgAccounts });
});

app.post('/api/gl-accounts', (req, res) => {
  const { code, name, type } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Account code and name are required' });

  const account: GlAccount = {
    id: `gl-${Date.now()}`,
    organizationId: currentUser.organizationId,
    code: code.trim(),
    name: name.trim(),
    type: type || 'Expense',
    isActive: true,
  };

  glAccounts.push(account);
  res.json({ glAccount: account });
});

// Accounting Export Adapter (CSV & XLSX)
app.post('/api/exports/generate', (req, res) => {
  const { invoiceIds, format } = req.body; // 'CSV' | 'XLSX'
  const targetInvoices = invoices.filter(
    i => i.organizationId === currentUser.organizationId && invoiceIds.includes(i.id)
  );

  if (targetInvoices.length === 0) {
    return res.status(400).json({ error: 'No valid invoices selected for export' });
  }

  // Pre-export validation
  const unapproved = targetInvoices.filter(i => i.businessStatus !== 'Approved' && i.businessStatus !== 'Exported');
  if (unapproved.length > 0) {
    return res.status(400).json({
      error: `Cannot export unapproved invoices. Invoices ${unapproved.map(u => '#' + u.invoiceNumber).join(', ')} are not yet approved.`,
    });
  }

  const exportId = `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
  const totalValue = targetInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  // Mark exported
  targetInvoices.forEach(inv => {
    inv.businessStatus = 'Exported';
    inv.exportBatchId = exportId;
    inv.exportedAt = new Date().toISOString();
  });

  const record: ExportRecord = {
    id: exportId,
    organizationId: currentUser.organizationId,
    format: format || 'XLSX',
    invoiceCount: targetInvoices.length,
    totalAmount: totalValue,
    currency: targetInvoices[0].currency,
    generatedBy: currentUser.name,
    invoiceNumbers: targetInvoices.map(i => i.invoiceNumber),
    createdAt: new Date().toISOString(),
  };

  exportRecords.unshift(record);

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Export',
    entityId: exportId,
    action: format === 'CSV' ? 'EXPORTED_CSV' : 'EXPORTED_EXCEL',
    description: `Exported ${targetInvoices.length} invoices ($${totalValue.toFixed(2)}) as ${format}`,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    exportRecord: record,
    downloadUrl: `/api/exports/download/${exportId}?format=${format}`,
  });
});

app.get('/api/exports', (req, res) => {
  const records = exportRecords.filter(r => r.organizationId === currentUser.organizationId);
  res.json({ exportRecords: records });
});

// Download Export File
app.get('/api/exports/download/:id', (req, res) => {
  const { id } = req.params;
  const format = (req.query.format as string) || 'XLSX';
  const record = exportRecords.find(r => r.id === id && r.organizationId === currentUser.organizationId);

  const exportedInvoices = invoices.filter(i => i.exportBatchId === id);

  if (format === 'CSV') {
    // Generate Standard Accounting CSV
    const headers = [
      'Vendor Name',
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Currency',
      'Line Description',
      'Quantity',
      'Unit Price',
      'Tax Amount',
      'GL Account Code',
      'GL Account Name',
      'Line Total',
      'Invoice Total',
      'Approver',
      'Approved At',
    ];

    const rows: string[][] = [];
    exportedInvoices.forEach(inv => {
      inv.lines.forEach(line => {
        rows.push([
          `"${inv.vendorName.replace(/"/g, '""')}"`,
          `"${inv.invoiceNumber}"`,
          inv.invoiceDate,
          inv.dueDate,
          inv.currency,
          `"${line.description.replace(/"/g, '""')}"`,
          line.quantity.toString(),
          line.unitPrice.toFixed(2),
          line.taxAmount.toFixed(2),
          `"${line.glAccountCode || ''}"`,
          `"${line.glAccountName || ''}"`,
          line.lineTotal.toFixed(2),
          inv.totalAmount.toFixed(2),
          `"${inv.approvedBy || ''}"`,
          inv.approvedAt || '',
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${id}_Acanty_Accounting_Export.csv"`);
    return res.send(csvContent);
  } else {
    // Generate Professional 3-Sheet Excel
    const wb = XLSX.utils.book_new();

    // Sheet 1: Invoice Lines
    const linesData = exportedInvoices.flatMap(inv =>
      inv.lines.map(line => ({
        'Vendor Name': inv.vendorName,
        'Invoice Number': inv.invoiceNumber,
        'Invoice Date': inv.invoiceDate,
        'Due Date': inv.dueDate,
        'Currency': inv.currency,
        'Item Description': line.description,
        'Quantity': line.quantity,
        'Unit Price': line.unitPrice,
        'Tax Amount': line.taxAmount,
        'GL Account Code': line.glAccountCode || '',
        'GL Account Name': line.glAccountName || '',
        'Line Total': line.lineTotal,
        'Invoice Total': inv.totalAmount,
      }))
    );
    const wsLines = XLSX.utils.json_to_sheet(linesData);
    XLSX.utils.book_append_sheet(wb, wsLines, 'Invoice Lines');

    // Sheet 2: Invoice Summary
    const summaryData = exportedInvoices.map(inv => ({
      'Invoice Number': inv.invoiceNumber,
      'Vendor Name': inv.vendorName,
      'Invoice Date': inv.invoiceDate,
      'Due Date': inv.dueDate,
      'Currency': inv.currency,
      'Subtotal': inv.subtotal,
      'Tax Amount': inv.taxAmount,
      'Total Amount': inv.totalAmount,
      'Purchase Order': inv.purchaseOrderNumber || 'N/A',
      'Approver': inv.approvedBy || 'N/A',
      'Approved Date': inv.approvedAt || 'N/A',
      'Export Batch': id,
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Invoice Summary');

    // Sheet 3: Export Information & Audit Metadata
    const currentOrg = organizations.find(o => o.id === currentUser.organizationId);
    const infoData = [
      { Property: 'Export Batch ID', Value: id },
      { Property: 'Organization', Value: currentOrg?.name || 'Acme Technologies Inc.' },
      { Property: 'Export Timestamp', Value: new Date().toISOString() },
      { Property: 'Invoices Count', Value: exportedInvoices.length },
      { Property: 'Total Exported Value', Value: `$${record ? record.totalAmount.toFixed(2) : '0.00'}` },
      { Property: 'Generated By', Value: currentUser.name },
      { Property: 'Accounting Adapter Version', Value: 'Acanty Standard Adapter v1.4' },
      { Property: 'Target ERP Compliance', Value: 'QuickBooks Online / Xero / NetSuite Compatible' },
    ];
    const wsInfo = XLSX.utils.json_to_sheet(infoData);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Export Metadata');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${id}_Acanty_Accounting_Export.xlsx"`);
    return res.send(buffer);
  }
});

// Audit Trail & Reports
app.get('/api/audit-events', (req, res) => {
  const events = auditEvents.filter(a => a.organizationId === currentUser.organizationId);
  res.json({ auditEvents: events });
});

app.get('/api/analytics', (req, res) => {
  const orgInvoices = invoices.filter(i => i.organizationId === currentUser.organizationId);
  const currentOrg = organizations.find(o => o.id === currentUser.organizationId);

  const totalInvoices = orgInvoices.length;
  const awaitingReview = orgInvoices.filter(i => i.businessStatus === 'Needs Review').length;
  const awaitingApproval = orgInvoices.filter(i => i.businessStatus === 'Pending Approval').length;
  const readyForExport = orgInvoices.filter(i => i.businessStatus === 'Approved').length;
  const exportedCount = orgInvoices.filter(i => i.businessStatus === 'Exported').length;
  const rejectedCount = orgInvoices.filter(i => i.businessStatus === 'Rejected').length;

  const totalSpend = orgInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  // Spend by vendor
  const vendorSpendMap: Record<string, { name: string; amount: number; count: number }> = {};
  orgInvoices.forEach(inv => {
    if (!vendorSpendMap[inv.vendorName]) {
      vendorSpendMap[inv.vendorName] = { name: inv.vendorName, amount: 0, count: 0 };
    }
    vendorSpendMap[inv.vendorName].amount += inv.totalAmount;
    vendorSpendMap[inv.vendorName].count += 1;
  });

  const vendorSpend = Object.values(vendorSpendMap).sort((a, b) => b.amount - a.amount);

  // Spend by GL category
  const glSpendMap: Record<string, { code: string; name: string; amount: number }> = {};
  orgInvoices.forEach(inv => {
    inv.lines.forEach(line => {
      const code = line.glAccountCode || 'Uncoded';
      const name = line.glAccountName || 'Unassigned GL';
      if (!glSpendMap[code]) {
        glSpendMap[code] = { code, name, amount: 0 };
      }
      glSpendMap[code].amount += line.lineTotal;
    });
  });

  const glSpend = Object.values(glSpendMap).sort((a, b) => b.amount - a.amount);

  res.json({
    metrics: {
      totalInvoices,
      awaitingReview,
      awaitingApproval,
      readyForExport,
      exportedCount,
      rejectedCount,
      totalSpend,
      monthlyQuota: currentOrg?.monthlyQuota || 250,
      invoicesThisMonth: currentOrg?.invoicesThisMonth || 42,
    },
    vendorSpend,
    glSpend,
  });
});

// Update Subscription Plan
app.post('/api/billing/update-plan', (req, res) => {
  const { plan } = req.body;
  const org = organizations.find(o => o.id === currentUser.organizationId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  if (plan === 'Starter') {
    org.plan = 'Starter';
    org.monthlyQuota = 50;
  } else if (plan === 'Growth') {
    org.plan = 'Growth';
    org.monthlyQuota = 250;
  } else if (plan === 'Pro') {
    org.plan = 'Pro';
    org.monthlyQuota = 750;
  } else {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: org.id,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Organization',
    entityId: org.id,
    action: 'SUBSCRIPTION_CHANGED',
    description: `Upgraded subscription tier to ${org.plan} (${org.monthlyQuota} invoices/mo limit)`,
    timestamp: new Date().toISOString(),
  });

  res.json({ organization: org });
});

// Helper for evaluating auto-approval criteria
function evaluateAutoApproval(invoice: Invoice, org: Organization | undefined): boolean {
  if (!org?.approvalThresholds?.autoApprovalEnabled) return false;
  const t = org.approvalThresholds;
  if (invoice.totalAmount > t.autoApprovalLimit) return false;
  if (invoice.isDuplicate) return false;

  const hasError = invoice.validationIssues?.some(v => v.status === 'ERROR');
  if (hasError) return false;

  if (t.requireZeroValidationErrors) {
    const hasWarning = invoice.validationIssues?.some(v => v.status === 'WARNING');
    if (hasWarning) return false;
  }

  if (t.requireVerifiedVendor) {
    const vendorExists = vendors.some(
      v => v.id === invoice.vendorId || (v.name && v.name.toLowerCase() === invoice.vendorName?.toLowerCase())
    );
    if (!vendorExists) return false;
  }

  if (t.requirePoMatch && !invoice.purchaseOrderNumber) {
    return false;
  }

  return true;
}

// Approval Thresholds Endpoints
app.get('/api/organization/approval-thresholds', (req, res) => {
  const org = organizations.find(o => o.id === currentUser.organizationId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  res.json({ approvalThresholds: org.approvalThresholds });
});

app.put('/api/organization/approval-thresholds', (req, res) => {
  if (currentUser.role !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can configure approval thresholds and auto-approval limits.' });
  }

  const org = organizations.find(o => o.id === currentUser.organizationId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const thresholds = req.body;
  const updatedThresholds: ApprovalThresholds = {
    autoApprovalEnabled: true,
    autoApprovalLimit: 750,
    requireVerifiedVendor: true,
    requireZeroValidationErrors: true,
    requirePoMatch: false,
    minGlConfidence: 85,
    managerApprovalLimit: 5000,
    ...(org.approvalThresholds || {}),
    ...thresholds,
    lastUpdatedBy: `${currentUser.name} (${currentUser.role})`,
    lastUpdatedAt: new Date().toISOString(),
  };

  org.approvalThresholds = updatedThresholds;

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: org.id,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Organization',
    entityId: org.id,
    action: 'APPROVAL_THRESHOLDS_UPDATED',
    description: `Updated approval policy: Auto-approval ${
      updatedThresholds.autoApprovalEnabled
        ? `ENABLED for invoices <= $${updatedThresholds.autoApprovalLimit.toFixed(2)}`
        : 'DISABLED'
    }. Manager limit: $${updatedThresholds.managerApprovalLimit.toFixed(2)}.`,
    timestamp: new Date().toISOString(),
  });

  res.json({ approvalThresholds: updatedThresholds, organization: org });
});

// Run Auto-Approval Evaluation on Pending / Needs Review Invoices
app.post('/api/invoices/apply-auto-approval', (req, res) => {
  if (currentUser.role !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can run batch auto-approval.' });
  }

  const org = organizations.find(o => o.id === currentUser.organizationId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const thresholds = org.approvalThresholds;
  if (!thresholds || !thresholds.autoApprovalEnabled) {
    return res.status(400).json({ error: 'Auto-approval is currently disabled. Enable it in Approval Thresholds settings first.' });
  }

  const pendingInvoices = invoices.filter(
    i => i.organizationId === org.id && (i.businessStatus === 'Needs Review' || i.businessStatus === 'Pending Approval')
  );

  const autoApproved: Invoice[] = [];
  const activeConn = accountingConnections.find(
    c => c.organizationId === org.id && c.status === 'connected' && c.autoSyncOnApproval
  );

  for (const inv of pendingInvoices) {
    if (!evaluateAutoApproval(inv, org)) continue;

    inv.businessStatus = 'Approved';
    inv.approvedBy = `System Auto-Approval (Threshold <= $${thresholds.autoApprovalLimit})`;
    inv.approvedAt = new Date().toISOString();
    inv.updatedAt = new Date().toISOString();

    auditEvents.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      organizationId: org.id,
      actorName: 'System (Auto-Approval Rule)',
      actorRole: 'Workflow Engine',
      entityType: 'Invoice',
      entityId: inv.id,
      action: 'INVOICE_AUTO_APPROVED',
      description: `Auto-approved low-value invoice #${inv.invoiceNumber} ($${inv.totalAmount.toFixed(2)}) under the $${thresholds.autoApprovalLimit} limit without manual review`,
      timestamp: new Date().toISOString(),
    });

    if (activeConn) {
      const prefix = activeConn.provider === 'quickbooks' ? 'QBO-BILL' : activeConn.provider === 'xero' ? 'XERO-BILL' : 'NS-BILL';
      inv.businessStatus = 'Exported';
      inv.externalRecordId = `${prefix}-${(inv.invoiceNumber || '').replace(/[^a-zA-Z0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
      inv.accountingProvider = activeConn.providerName;
      inv.exportedAt = new Date().toISOString();
      activeConn.syncedBillsCount += 1;
      activeConn.lastSyncAt = new Date().toISOString();
    }

    autoApproved.push(inv);
  }

  res.json({
    updatedCount: autoApproved.length,
    invoices: autoApproved,
    message: `Evaluated ${pendingInvoices.length} pending invoices. Automatically approved ${autoApproved.length} qualifying low-value invoices.`,
  });
});

// Accounting Connections & Automated Sync Endpoints
app.get('/api/accounting/connections', (req, res) => {
  const conns = accountingConnections.filter(c => c.organizationId === currentUser.organizationId);
  res.json({ connections: conns });
});

app.get('/api/accounting/oauth/url', (req, res) => {
  const provider = (req.query.provider as string) || 'quickbooks';
  const baseUrl = process.env.APP_URL || (req.headers.origin as string) || 'http://localhost:3000';
  const callbackUrl = `${baseUrl.replace(/\/$/, '')}/auth/accounting/callback`;
  const state = `${currentUser.organizationId}___${provider}___${Date.now()}`;

  let authUrl = '';
  if (provider === 'quickbooks') {
    const clientId = process.env.QBO_CLIENT_ID || 'ABtestClientIdQBO';
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: callbackUrl,
      state,
    });
    authUrl = `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  } else if (provider === 'xero') {
    const clientId = process.env.XERO_CLIENT_ID || 'ABtestXeroClientId';
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'openid profile email accounting.transactions accounting.settings',
      redirect_uri: callbackUrl,
      state,
    });
    authUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  } else {
    // NetSuite / Other
    authUrl = `${callbackUrl}?simulated=true&provider=${provider}&state=${state}`;
  }

  res.json({ url: authUrl, callbackUrl, provider });
});

// OAuth Callback Route (popup sends postMessage to opener and auto-closes)
app.get(['/auth/accounting/callback', '/auth/accounting/callback/'], (req, res) => {
  const { code, state, realmId, provider: queryProvider } = req.query;
  const stateStr = (state as string) || '';
  const parsedProvider = queryProvider || (stateStr.includes('___') ? stateStr.split('___')[1] : 'quickbooks');
  const orgId = stateStr.includes('___') ? stateStr.split('___')[0] : currentUser.organizationId;

  // Find or create connection
  const connIndex = accountingConnections.findIndex(
    c => c.organizationId === orgId && c.provider === parsedProvider
  );

  const providerName =
    parsedProvider === 'quickbooks'
      ? 'QuickBooks Online'
      : parsedProvider === 'xero'
      ? 'Xero Cloud Accounting'
      : 'Oracle NetSuite';

  const companyName =
    parsedProvider === 'quickbooks'
      ? `Acme Tech US (QBO Company #${realmId || '93414520934123'})`
      : parsedProvider === 'xero'
      ? 'Acme Tech Global (Xero Production)'
      : 'Acme NetSuite Subsidiary One';

  const extCompanyId = (realmId as string) || (parsedProvider === 'quickbooks' ? '93414520934123' : `tenant-${Date.now().toString().slice(-6)}`);

  if (connIndex !== -1) {
    accountingConnections[connIndex].status = 'connected';
    accountingConnections[connIndex].companyName = companyName;
    accountingConnections[connIndex].externalCompanyId = extCompanyId;
    accountingConnections[connIndex].connectedAt = new Date().toISOString();
    accountingConnections[connIndex].lastSyncAt = new Date().toISOString();
  } else {
    accountingConnections.push({
      id: `conn-${Date.now()}`,
      organizationId: orgId,
      provider: parsedProvider as any,
      providerName,
      status: 'connected',
      companyName,
      externalCompanyId: extCompanyId,
      connectedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      autoSyncOnApproval: true,
      defaultApAccountId: 'gl-2000',
      syncFrequency: 'instant',
      syncedBillsCount: 0,
    });
  }

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: orgId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Organization',
    entityId: orgId,
    action: 'ACCOUNTING_CONNECTED',
    description: `Connected ${providerName} (${companyName}) via OAuth 2.0 authorization`,
    timestamp: new Date().toISOString(),
  });

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Authorization Successful - Acanty</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0b0f17;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: #111827;
            border: 1px solid #1f293d;
            border-radius: 12px;
            padding: 32px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          }
          h3 { color: #10b981; margin: 0 0 8px; font-size: 18px; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 16px; }
          .sub { color: #64748b; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h3>Connection Authorized</h3>
          <p>Successfully linked <strong>${providerName}</strong> to your Acanty workspace.</p>
          <p class="sub">This popup will close automatically...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'ACCOUNTING_OAUTH_SUCCESS',
              provider: '${parsedProvider}'
            }, '*');
            setTimeout(function() { window.close(); }, 1200);
          } else {
            setTimeout(function() { window.location.href = '/'; }, 1500);
          }
        </script>
      </body>
    </html>
  `);
});

// Sandbox / Simulation Connect Endpoint
app.post('/api/accounting/oauth/simulate', (req, res) => {
  const { provider, companyName, externalCompanyId } = req.body;
  if (!['quickbooks', 'xero', 'netsuite'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  const connIndex = accountingConnections.findIndex(
    c => c.organizationId === currentUser.organizationId && c.provider === provider
  );

  const providerName =
    provider === 'quickbooks'
      ? 'QuickBooks Online'
      : provider === 'xero'
      ? 'Xero Cloud Accounting'
      : 'Oracle NetSuite';

  const defaultCompName =
    companyName ||
    (provider === 'quickbooks'
      ? 'Acme Technologies Inc. (QBO Sandbox)'
      : provider === 'xero'
      ? 'Acme Technologies Ltd (Xero Demo Org)'
      : 'Acme NetSuite OneWorld');

  const defaultExtId = externalCompanyId || (provider === 'quickbooks' ? '93414520934123' : `ext-${Date.now().toString().slice(-6)}`);

  if (connIndex !== -1) {
    accountingConnections[connIndex].status = 'connected';
    accountingConnections[connIndex].companyName = defaultCompName;
    accountingConnections[connIndex].externalCompanyId = defaultExtId;
    accountingConnections[connIndex].connectedAt = new Date().toISOString();
    accountingConnections[connIndex].lastSyncAt = new Date().toISOString();
  } else {
    accountingConnections.push({
      id: `conn-${Date.now()}`,
      organizationId: currentUser.organizationId,
      provider,
      providerName,
      status: 'connected',
      companyName: defaultCompName,
      externalCompanyId: defaultExtId,
      connectedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      autoSyncOnApproval: true,
      defaultApAccountId: 'gl-2000',
      syncFrequency: 'instant',
      syncedBillsCount: 0,
    });
  }

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Organization',
    entityId: currentUser.organizationId,
    action: 'ACCOUNTING_CONNECTED',
    description: `Connected ${providerName} (${defaultCompName})`,
    timestamp: new Date().toISOString(),
  });

  const activeConn = accountingConnections.find(
    c => c.organizationId === currentUser.organizationId && c.provider === provider
  );
  res.json({ success: true, connection: activeConn });
});

// Disconnect Accounting Provider
app.post('/api/accounting/connections/:id/disconnect', (req, res) => {
  const { id } = req.params;
  const conn = accountingConnections.find(
    c => c.id === id && c.organizationId === currentUser.organizationId
  );
  if (!conn) return res.status(404).json({ error: 'Connection not found' });

  conn.status = 'disconnected';
  conn.companyName = undefined;
  conn.externalCompanyId = undefined;

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Organization',
    entityId: conn.id,
    action: 'ACCOUNTING_DISCONNECTED',
    description: `Disconnected ${conn.providerName} integration`,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, connection: conn });
});

// Update Accounting Settings (Auto-sync, Default AP Account, Frequency)
app.put('/api/accounting/connections/:id/settings', (req, res) => {
  const { id } = req.params;
  const { autoSyncOnApproval, defaultApAccountId, syncFrequency } = req.body;
  const conn = accountingConnections.find(
    c => c.id === id && c.organizationId === currentUser.organizationId
  );
  if (!conn) return res.status(404).json({ error: 'Connection not found' });

  if (autoSyncOnApproval !== undefined) conn.autoSyncOnApproval = Boolean(autoSyncOnApproval);
  if (defaultApAccountId !== undefined) conn.defaultApAccountId = defaultApAccountId;
  if (syncFrequency !== undefined) conn.syncFrequency = syncFrequency;

  res.json({ success: true, connection: conn });
});

// Trigger Automated Sync of Approved Bills
app.post('/api/accounting/connections/:id/sync', (req, res) => {
  const { id } = req.params;
  const conn = accountingConnections.find(
    c => c.id === id && c.organizationId === currentUser.organizationId
  );
  if (!conn || conn.status !== 'connected') {
    return res.status(400).json({ error: 'Active accounting connection required' });
  }

  // Find all approved invoices eligible for bill posting
  const approvedInvoices = invoices.filter(
    i => i.organizationId === currentUser.organizationId && i.businessStatus === 'Approved'
  );

  const prefix = conn.provider === 'quickbooks' ? 'QBO-BILL' : conn.provider === 'xero' ? 'XERO-BILL' : 'NS-BILL';
  let syncedCount = 0;
  let syncedTotal = 0;

  approvedInvoices.forEach(inv => {
    inv.businessStatus = 'Exported';
    inv.externalRecordId = `${prefix}-${inv.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
    inv.accountingProvider = conn.providerName;
    inv.exportedAt = new Date().toISOString();
    syncedCount += 1;
    syncedTotal += inv.totalAmount;
  });

  conn.syncedBillsCount += syncedCount;
  conn.lastSyncAt = new Date().toISOString();

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Export',
    entityId: conn.id,
    action: 'BILLS_SYNCED',
    description: `Synced ${syncedCount} approved vendor bill(s) ($${syncedTotal.toFixed(2)}) to ${conn.providerName}`,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    syncedCount,
    syncedTotal,
    connection: conn,
  });
});

// Sync Individual Bill
app.post('/api/invoices/:id/sync-bill', (req, res) => {
  const { id } = req.params;
  const invoice = invoices.find(
    i => i.id === id && i.organizationId === currentUser.organizationId
  );
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const activeConn = accountingConnections.find(
    c => c.organizationId === currentUser.organizationId && c.status === 'connected'
  );
  if (!activeConn) {
    return res.status(400).json({ error: 'No active accounting connection found. Please connect QuickBooks or Xero in Accounting Connections.' });
  }

  const prefix = activeConn.provider === 'quickbooks' ? 'QBO-BILL' : activeConn.provider === 'xero' ? 'XERO-BILL' : 'NS-BILL';
  invoice.businessStatus = 'Exported';
  invoice.externalRecordId = `${prefix}-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
  invoice.accountingProvider = activeConn.providerName;
  invoice.exportedAt = new Date().toISOString();

  activeConn.syncedBillsCount += 1;
  activeConn.lastSyncAt = new Date().toISOString();

  auditEvents.unshift({
    id: `aud-${Date.now()}`,
    organizationId: currentUser.organizationId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    entityType: 'Invoice',
    entityId: invoice.id,
    action: 'BILL_POSTED',
    description: `Posted vendor bill #${invoice.invoiceNumber} ($${invoice.totalAmount.toFixed(2)}) to ${activeConn.providerName} (Bill Ref: ${invoice.externalRecordId})`,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, invoice, externalRecordId: invoice.externalRecordId });
});

// Vite middleware in dev or static server in prod
async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Acanty AP Automation Server active on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
