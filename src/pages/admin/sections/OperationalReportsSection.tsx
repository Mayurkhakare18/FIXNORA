// ==============================================================================
// SmartResolve Admin: Operational Reporting & Executive Analytics
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Primitives';
import { Icon } from '../../../components/ui/Icon';
import {
  generateOperationalReport,
  exportComplaintsToCsv,
  exportPreventiveSchedulesToCsv,
  downloadCsv,
  type OperationalReportData,
} from '../../../lib/reportingService';
import { exportExpensesToCsv, downloadExpensesCsvFile, fetchSocietyExpenses } from '../../../lib/expenseService';
import { fetchPreventiveSchedules } from '../../../lib/preventiveService';
import { supabase } from '../../../lib/supabase';

interface OperationalReportsSectionProps {
  societyId: string;
}

export const OperationalReportsSection: React.FC<OperationalReportsSectionProps> = ({
  societyId,
}) => {
  const [report, setReport] = useState<OperationalReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: repError } = await generateOperationalReport(
        societyId,
        startDate || undefined,
        endDate || undefined
      );

      if (repError) {
        setError(repError);
      } else {
        setReport(data);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate operational report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [societyId]);

  const handleExportComplaints = async () => {
    try {
      const { data: compData } = await supabase
        .from('complaints')
        .select(`
          *,
          category:complaint_categories!fk_complaints_category_society(name),
          department:departments(name)
        `)
        .eq('society_id', societyId);

      const csv = exportComplaintsToCsv(compData || []);
      downloadCsv(`smartresolve-complaints-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setToast('Complaints register exported to CSV.');
    } catch (err: any) {
      setError(err.message || 'Export failed');
    }
  };

  const handleExportPreventive = async () => {
    try {
      const { data: schedData } = await fetchPreventiveSchedules(societyId);
      const csv = exportPreventiveSchedulesToCsv(schedData || []);
      downloadCsv(`smartresolve-preventive-schedules-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setToast('Preventive schedules exported to CSV.');
    } catch (err: any) {
      setError(err.message || 'Export failed');
    }
  };

  const handleExportExpenses = async () => {
    try {
      const expData = await fetchSocietyExpenses(societyId);
      const csv = exportExpensesToCsv(expData);
      downloadExpensesCsvFile(csv);
      setToast('Expenses register exported to CSV.');
    } catch (err: any) {
      setError(err.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Society Operational Reports & Performance</h2>
          <p className="text-xs text-muted-foreground">
            Database-backed resolution velocity, SLA compliance, staff productivity, and preventive auditing.
          </p>
        </div>

        {/* Date Filter & Refresh */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 bg-card border border-bd rounded-lg px-2 py-1">
            <span className="text-muted-foreground">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-navy focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 bg-card border border-bd rounded-lg px-2 py-1">
            <span className="text-muted-foreground">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-navy focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadReport}
            className="rounded-lg bg-navy text-white px-3 py-1.5 font-semibold hover:bg-navy/90 transition shadow-sm"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-teal/30 bg-teal/10 p-3 text-xs text-teal font-medium flex items-center justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-xl border border-bd bg-card p-4 space-y-2">
              <div className="h-4 bg-soft rounded w-1/2" />
              <div className="h-6 bg-soft rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && report && (
        <div className="space-y-6">
          {/* Executive KPI Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <Card className="p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">Total Tickets</div>
              <div className="text-xl font-bold text-navy mt-1">{report.complaints.total}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Complaints logged</div>
            </Card>

            <Card className="p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">SLA Compliance</div>
              <div className="text-xl font-bold text-teal mt-1">
                {report.complaints.sla_compliance_rate_percent}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {report.complaints.sla_compliant_count} on-time / {report.complaints.sla_breached_count} breaches
              </div>
            </Card>

            <Card className="p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">Avg Turnaround</div>
              <div className="text-xl font-bold text-navy mt-1">
                {report.complaints.avg_turnaround_hours}h
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">To resolution/closure</div>
            </Card>

            <Card className="p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">Escalations</div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {report.escalations.total}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                L1: {report.escalations.level_1} • L2: {report.escalations.level_2} • L3: {report.escalations.level_3}
              </div>
            </Card>

            <Card className="p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">Preventive Health</div>
              <div className="text-xl font-bold text-teal mt-1">
                {report.preventive_maintenance.compliance_rate_percent}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {report.preventive_maintenance.on_schedule} on schedule / {report.preventive_maintenance.overdue} overdue
              </div>
            </Card>

            <Card className="p-3.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">Approved Expenses</div>
              <div className="text-xl font-bold text-navy mt-1">
                ₹{report.financial_summary.totalApprovedAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {report.financial_summary.approvedCount} approved items
              </div>
            </Card>
          </div>

          {/* Operational Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Complaint Status Breakdown */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                Complaints by Status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Submitted & Triage</span>
                  <span className="font-mono font-bold text-amber-600">{report.complaints.submitted}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">In Progress (Staff Assigned)</span>
                  <span className="font-mono font-bold text-navy">{report.complaints.in_progress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Resolved (Awaiting Resident Review)</span>
                  <span className="font-mono font-bold text-teal">{report.complaints.resolved}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Closed (Confirmed Satisfactory)</span>
                  <span className="font-mono font-bold text-teal">{report.complaints.closed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Reopened (Follow-up Required)</span>
                  <span className="font-mono font-bold text-red-600">{report.complaints.reopened}</span>
                </div>
              </div>
            </Card>

            {/* Department Volume Breakdown */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                Volume by Department
              </h3>
              {Object.keys(report.complaints.by_department).length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">No complaints recorded yet</div>
              ) : (
                <div className="space-y-2 text-xs">
                  {Object.entries(report.complaints.by_department).map(([dept, count]) => {
                    const pct = report.complaints.total > 0 ? Math.round((count / report.complaints.total) * 100) : 0;
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-navy font-medium">{dept}</span>
                          <span className="font-mono font-bold text-navy">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-soft rounded-full overflow-hidden">
                          <div className="h-full bg-navy rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* In-House Maintenance Staff Productivity */}
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
              In-House Staff Workload & Performance
            </h3>
            {report.staff_performance.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No active staff memberships enrolled in this society.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-soft/70 border-b border-bd/60 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Staff Member</th>
                      <th className="p-2.5">Designation</th>
                      <th className="p-2.5 text-center">Assigned Jobs</th>
                      <th className="p-2.5 text-center">Active WIP</th>
                      <th className="p-2.5 text-center">Completed</th>
                      <th className="p-2.5 text-right">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bd/60">
                    {report.staff_performance.map((s) => {
                      const rate = s.assigned_count > 0 ? Math.round((s.completed_count / s.assigned_count) * 100) : 0;
                      return (
                        <tr key={s.staff_id} className="hover:bg-soft/40 transition">
                          <td className="p-2.5 font-bold text-navy">{s.staff_name}</td>
                          <td className="p-2.5 text-muted-foreground">{s.designation}</td>
                          <td className="p-2.5 text-center font-mono font-semibold">{s.assigned_count}</td>
                          <td className="p-2.5 text-center font-mono text-amber-600 font-semibold">{s.active_count}</td>
                          <td className="p-2.5 text-center font-mono text-teal font-semibold">{s.completed_count}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-navy">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* CSV Export Suite */}
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
              Operational Data Exports (RFC-4180 CSV)
            </h3>
            <p className="text-xs text-muted-foreground">
              Download sanitized, authorized audit files for committee meetings, maintenance audits, and accounting reconciliations.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportComplaints}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-card px-3.5 py-2 text-xs font-semibold text-navy hover:bg-soft transition shadow-sm"
              >
                <Icon n="download" s={14} />
                <span>Export Complaints Register (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleExportPreventive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-card px-3.5 py-2 text-xs font-semibold text-navy hover:bg-soft transition shadow-sm"
              >
                <Icon n="download" s={14} />
                <span>Export Preventive Schedules (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleExportExpenses}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-card px-3.5 py-2 text-xs font-semibold text-navy hover:bg-soft transition shadow-sm"
              >
                <Icon n="download" s={14} />
                <span>Export Society Expenses (.csv)</span>
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
