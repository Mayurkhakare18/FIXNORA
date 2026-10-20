// ==============================================================================
// SmartResolve Society Expense Management Service
// Scoped multi-tenant society expense tracking, receipt uploads to private storage,
// monthly financial aggregations, and CSV reporting. Strictly NO VENDOR workflows.
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Expense,
  ExpenseReceipt,
  ExpenseCategory,
  ExpenseStatus,
} from '../types/database';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'electrical_parts', label: 'Electrical Parts & Wiring' },
  { value: 'plumbing_parts', label: 'Plumbing Parts & Hardware' },
  { value: 'lift_servicing', label: 'Elevator & Lift Maintenance' },
  { value: 'generator_diesel', label: 'Generator Diesel & Power Backup' },
  { value: 'cleaning_materials', label: 'Housekeeping & Sanitation Materials' },
  { value: 'security_equipment', label: 'Security & Surveillance Equipment' },
  { value: 'civil_repairs', label: 'Civil Repairs & Waterproofing' },
  { value: 'general_maintenance', label: 'General Society Maintenance' },
];

export const ALLOWED_RECEIPT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface CreateExpenseInput {
  societyId: string;
  recordedBy: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate?: string; // YYYY-MM-DD
  departmentId?: string | null;
  complaintId?: string | null;
  receiptFile?: File | null;
}

export interface ExpenseWithRelations extends Expense {
  department?: { id: string; name: string } | null;
  complaint?: { id: string; tracking_id: string; title: string } | null;
  recorded_by_profile?: { full_name: string } | null;
  approved_by_profile?: { full_name: string } | null;
  receipts?: ExpenseReceipt[];
}

export interface ExpenseFinancialSummary {
  totalApprovedAmount: number;
  totalPendingAmount: number;
  currentMonthApprovedAmount: number;
  approvedCount: number;
  pendingCount: number;
  categoryBreakdown: Record<ExpenseCategory, number>;
}

/**
 * Validate expense input parameters
 */
export function validateExpenseInput(input: CreateExpenseInput): string | null {
  if (!input.societyId) return 'Society identification is missing.';
  if (!input.recordedBy) return 'Uploader identification is missing.';
  if (!input.category) return 'Please choose a valid expense category.';
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    return 'Expense amount must be a positive number greater than 0.';
  }
  if (!input.description || input.description.trim().length < 5) {
    return 'Detailed description (at least 5 characters) is required.';
  }
  if (input.receiptFile) {
    if (!ALLOWED_RECEIPT_TYPES.includes(input.receiptFile.type)) {
      return `Invalid receipt file type "${input.receiptFile.type}". Allowed: JPG, PNG, WebP, PDF.`;
    }
    if (input.receiptFile.size > MAX_RECEIPT_SIZE_BYTES) {
      return 'Receipt file size exceeds maximum limit of 10MB.';
    }
  }
  return null;
}

/**
 * Create a new society expense record, optionally uploading a receipt to private storage
 */
export async function createSocietyExpense(
  input: CreateExpenseInput
): Promise<ExpenseWithRelations> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment is not configured.');
  }

  const validationError = validateExpenseInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  // 1. If complaintId is supplied, verify it belongs to the same society (cross-society prevention)
  if (input.complaintId) {
    const { data: comp } = await supabase
      .from('complaints')
      .select('id, society_id')
      .eq('id', input.complaintId)
      .single();

    if (!comp || comp.society_id !== input.societyId) {
      throw new Error('Cross-society association rejected: Complaint does not belong to this society.');
    }
  }

  // 2. If departmentId is supplied, verify it belongs to the same society
  if (input.departmentId) {
    const { data: dept } = await supabase
      .from('departments')
      .select('id, society_id')
      .eq('id', input.departmentId)
      .single();

    if (!dept || dept.society_id !== input.societyId) {
      throw new Error('Cross-society association rejected: Department does not belong to this society.');
    }
  }

  const expenseDate = input.expenseDate || new Date().toISOString().split('T')[0];

  const payload = {
    society_id: input.societyId,
    department_id: input.departmentId || null,
    complaint_id: input.complaintId || null,
    recorded_by: input.recordedBy,
    category: input.category,
    amount: parseFloat(input.amount.toFixed(2)),
    expense_date: expenseDate,
    description: input.description.trim(),
    approval_status: 'pending',
  };

  // 3. Insert expense record
  const { data: expenseData, error: expenseErr } = await supabase
    .from('expenses')
    .insert([payload])
    .select('*')
    .single();

  if (expenseErr || !expenseData) {
    throw new Error(`Failed to record expense: ${expenseErr?.message || 'Unknown database error'}`);
  }

  const createdExpense = expenseData as ExpenseWithRelations;

  // 4. Handle receipt upload if file provided
  if (input.receiptFile) {
    try {
      const sanitizedName = input.receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${input.societyId}/${createdExpense.id}/${Date.now()}_${sanitizedName}`;

      const { error: uploadErr } = await supabase.storage
        .from('expense-receipts')
        .upload(storagePath, input.receiptFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: input.receiptFile.type,
        });

      if (uploadErr) {
        console.warn('Storage upload notice for receipt:', uploadErr.message);
      } else {
        // Record receipt in expense_receipts table
        const { data: receiptRec } = await supabase
          .from('expense_receipts')
          .insert([
            {
              expense_id: createdExpense.id,
              society_id: input.societyId,
              file_path: storagePath,
              file_name: input.receiptFile.name,
              file_size_bytes: input.receiptFile.size,
              content_type: input.receiptFile.type,
              uploaded_by: input.recordedBy,
            },
          ])
          .select('*')
          .single();

        if (receiptRec) {
          createdExpense.receipts = [receiptRec as ExpenseReceipt];
        }
      }
    } catch (uploadExc) {
      console.warn('Receipt upload exception caught:', uploadExc);
    }
  }

  return createdExpense;
}

/**
 * Fetch all expenses for a society with relational data (department, complaint, receipts)
 */
export async function fetchSocietyExpenses(
  societyId: string,
  filters?: {
    category?: ExpenseCategory;
    approvalStatus?: ExpenseStatus;
    startDate?: string;
    endDate?: string;
  }
): Promise<ExpenseWithRelations[]> {
  if (!isSupabaseConfigured || !societyId) return [];

  let query = supabase
    .from('expenses')
    .select(`
      *,
      department:departments (id, name),
      complaint:complaints (id, tracking_id, title),
      recorded_by_profile:profiles!expenses_recorded_by_fkey (full_name),
      approved_by_profile:profiles!expenses_approved_by_fkey (full_name),
      receipts:expense_receipts (*)
    `)
    .eq('society_id', societyId)
    .order('expense_date', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.approvalStatus) {
    query = query.eq('approval_status', filters.approvalStatus);
  }
  if (filters?.startDate) {
    query = query.gte('expense_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('expense_date', filters.endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Failed to fetch society expenses:', error.message);
    return [];
  }

  return (data || []) as ExpenseWithRelations[];
}

/**
 * Approve or Reject an expense (restricted to Society Admins)
 */
export async function reviewSocietyExpense(params: {
  expenseId: string;
  societyId: string;
  adminUserId: string;
  status: 'approved' | 'rejected';
}): Promise<Expense> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase environment is not configured.');
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('expenses')
    .update({
      approval_status: params.status,
      approved_by: params.adminUserId,
      approved_at: now,
    })
    .eq('id', params.expenseId)
    .eq('society_id', params.societyId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update expense approval status: ${error?.message || 'Access denied'}`);
  }

  return data as Expense;
}

/**
 * Delete an unapproved / erroneous expense (restricted to Society Admins)
 */
export async function deleteSocietyExpense(
  expenseId: string,
  societyId: string
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('society_id', societyId);

  if (error) {
    throw new Error(`Failed to delete expense: ${error.message}`);
  }
}

/**
 * Create a secure time-limited signed download URL for an expense receipt
 */
export async function getReceiptSignedUrl(filePath: string): Promise<string | null> {
  if (!isSupabaseConfigured || !filePath) return null;

  const { data, error } = await supabase.storage
    .from('expense-receipts')
    .createSignedUrl(filePath, 300); // 5-minute valid window

  if (error || !data) {
    console.warn('Failed to generate receipt signed URL:', error?.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Compute monthly totals, pending amounts, and category breakdowns
 */
export function computeFinancialSummary(
  expenses: ExpenseWithRelations[]
): ExpenseFinancialSummary {
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  const initialBreakdown: Record<ExpenseCategory, number> = {
    electrical_parts: 0,
    plumbing_parts: 0,
    lift_servicing: 0,
    generator_diesel: 0,
    cleaning_materials: 0,
    security_equipment: 0,
    civil_repairs: 0,
    general_maintenance: 0,
  };

  let totalApprovedAmount = 0;
  let totalPendingAmount = 0;
  let currentMonthApprovedAmount = 0;
  let approvedCount = 0;
  let pendingCount = 0;

  for (const exp of expenses) {
    const amt = Number(exp.amount) || 0;

    if (exp.approval_status === 'approved') {
      totalApprovedAmount += amt;
      approvedCount++;

      if (exp.expense_date && exp.expense_date.startsWith(currentMonthPrefix)) {
        currentMonthApprovedAmount += amt;
      }

      if (exp.category in initialBreakdown) {
        initialBreakdown[exp.category] += amt;
      }
    } else if (exp.approval_status === 'pending') {
      totalPendingAmount += amt;
      pendingCount++;
    }
  }

  return {
    totalApprovedAmount: parseFloat(totalApprovedAmount.toFixed(2)),
    totalPendingAmount: parseFloat(totalPendingAmount.toFixed(2)),
    currentMonthApprovedAmount: parseFloat(currentMonthApprovedAmount.toFixed(2)),
    approvedCount,
    pendingCount,
    categoryBreakdown: initialBreakdown,
  };
}

/**
 * Escape CSV field to conform with RFC-4180
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Export authorized expenses to standard RFC-4180 CSV string
 */
export function exportExpensesToCsv(expenses: ExpenseWithRelations[]): string {
  const headers = [
    'Expense Date',
    'Expense ID',
    'Category',
    'Amount (INR)',
    'Approval Status',
    'Department',
    'Complaint Tracking ID',
    'Description',
    'Recorded By',
    'Approved By',
  ];

  const rows = expenses.map((exp) => [
    escapeCsv(exp.expense_date),
    escapeCsv(exp.id),
    escapeCsv(exp.category),
    escapeCsv(Number(exp.amount).toFixed(2)),
    escapeCsv(exp.approval_status),
    escapeCsv(exp.department?.name || 'General'),
    escapeCsv(exp.complaint?.tracking_id || 'N/A'),
    escapeCsv(exp.description),
    escapeCsv(exp.recorded_by_profile?.full_name || exp.recorded_by),
    escapeCsv(exp.approved_by_profile?.full_name || exp.approved_by || 'Unapproved'),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Client-side browser download trigger for CSV file
 */
export function downloadExpensesCsvFile(
  csvContent: string,
  filename = `society_expenses_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
