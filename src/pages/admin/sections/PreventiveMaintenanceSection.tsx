// ==============================================================================
// SmartResolve Admin: Preventive Maintenance & Asset Servicing Management
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Card, Btn, Pill } from '../../../components/ui/Primitives';
import { Icon } from '../../../components/ui/Icon';
import {
  fetchPreventiveSchedules,
  createPreventiveSchedule,
  recordPreventiveInspection,
  fetchMaintenanceRecords,
  runPreventiveMaintenanceAudit,
  FREQUENCY_LABELS,
  type ScheduleWithRelations,
  type MaintenanceRecordWithRelations,
} from '../../../lib/preventiveService';
import { fetchEligibleSocietyStaff, type EligibleStaff } from '../../../lib/maintenanceService';
import type { Department, MaintenanceFrequency } from '../../../types/database';

interface PreventiveMaintenanceSectionProps {
  societyId: string;
  departments: Department[];
  userId: string;
}

export const PreventiveMaintenanceSection: React.FC<PreventiveMaintenanceSectionProps> = ({
  societyId,
  departments,
  userId,
}) => {
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([]);
  const [records, setRecords] = useState<MaintenanceRecordWithRelations[]>([]);
  const [eligibleStaff, setEligibleStaff] = useState<EligibleStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Sub-tab: 'schedules' | 'records'
  const [subTab, setSubTab] = useState<'schedules' | 'records'>('schedules');

  // Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditSummary, setAuditSummary] = useState<any | null>(null);

  // New Schedule Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [facilityName, setFacilityName] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [frequency, setFrequency] = useState<MaintenanceFrequency>('monthly');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [checklistRaw, setChecklistRaw] = useState('');
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Log Inspection Modal
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [inspectSchedule, setInspectSchedule] = useState<ScheduleWithRelations | null>(null);
  const [inspectStatus, setInspectStatus] = useState<'satisfactory' | 'needs_repair' | 'critical_fault'>('satisfactory');
  const [inspectDate, setInspectDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectObservations, setInspectObservations] = useState('');
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, boolean>>({});
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [{ data: scheds }, { data: recs }, staff] = await Promise.all([
        fetchPreventiveSchedules(societyId),
        fetchMaintenanceRecords(societyId),
        fetchEligibleSocietyStaff(societyId),
      ]);
      setSchedules(scheds || []);
      setRecords(recs || []);
      setEligibleStaff(staff || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load preventive maintenance data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [societyId]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSchedule(true);
    setScheduleError(null);

    const items = checklistRaw
      .split('\n')
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    try {
      const res = await createPreventiveSchedule(societyId, {
        facility_name: facilityName,
        department_id: departmentId || departments[0]?.id || '',
        frequency,
        assigned_staff_id: assignedStaffId || null,
        next_due_date: nextDueDate,
        checklist_items: items,
      });

      if (res.error) {
        setScheduleError(res.error);
      } else {
        setToast('Preventive maintenance schedule configured.');
        setShowCreateModal(false);
        setFacilityName('');
        setNextDueDate('');
        setChecklistRaw('');
        await loadData();
      }
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to create schedule');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const openInspectModal = (sched: ScheduleWithRelations) => {
    setInspectSchedule(sched);
    setInspectStatus('satisfactory');
    setInspectObservations('');
    const answers: Record<string, boolean> = {};
    (sched.checklist_items || []).forEach((item) => {
      answers[item] = true;
    });
    setChecklistAnswers(answers);
    setShowInspectModal(true);
  };

  const handleRecordInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectSchedule) return;

    setIsSubmittingInspection(true);
    setInspectionError(null);

    try {
      const res = await recordPreventiveInspection(societyId, inspectSchedule.id, userId, {
        performed_date: inspectDate,
        status: inspectStatus,
        observations: inspectObservations,
        checklist_results: checklistAnswers,
      });

      if (res.error) {
        setInspectionError(res.error);
      } else {
        setToast(`Inspection recorded for ${inspectSchedule.facility_name}. Next due date rolled forward.`);
        setShowInspectModal(false);
        await loadData();
      }
    } catch (err: any) {
      setInspectionError(err.message || 'Failed to log inspection');
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    try {
      const summary = await runPreventiveMaintenanceAudit(societyId);
      setAuditSummary(summary);
      setToast('Preventive maintenance audit check executed.');
    } catch (err: any) {
      setError(err.message || 'Audit failed');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Preventive Maintenance & Facility Schedules</h2>
          <p className="text-xs text-muted-foreground">
            Schedule routine asset inspections, record compliance checklists, and prevent breakdown disruptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isAuditing}
            onClick={handleRunAudit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-card px-3 py-2 text-xs font-semibold text-navy hover:bg-soft transition disabled:opacity-50"
          >
            <Icon n="refresh-cw" s={14} c={isAuditing ? "animate-spin text-teal" : ""} />
            <span>{isAuditing ? 'Auditing...' : 'Run Due Date Audit'}</span>
          </button>
          <Btn v="p" onClick={() => setShowCreateModal(true)} className="py-2 text-xs">
            <Icon n="plus" s={14} />
            <span>New Schedule</span>
          </Btn>
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

      {/* Audit Summary Banner */}
      {auditSummary && (
        <div className="rounded-xl border border-teal/40 bg-teal/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-navy uppercase tracking-wider">
              Preventive Maintenance Audit Outcome
            </span>
            <button
              type="button"
              onClick={() => setAuditSummary(null)}
              className="text-muted-foreground text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>Total Assets: <strong className="text-navy">{auditSummary.total_schedules}</strong></div>
            <div>On Schedule: <strong className="text-teal">{auditSummary.on_schedule}</strong></div>
            <div>Due Today: <strong className="text-amber-600">{auditSummary.due_today}</strong></div>
            <div>Overdue: <strong className="text-red-600">{auditSummary.overdue}</strong></div>
          </div>
          {auditSummary.overdue_facilities.length > 0 && (
            <div className="text-[11px] text-red-700 pt-1 border-t border-red-200">
              Overdue Facilities: {auditSummary.overdue_facilities.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab Switcher */}
      <div className="flex gap-2 border-b border-bd/60 pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSubTab('schedules')}
          className={`px-3 py-1.5 rounded-lg transition ${
            subTab === 'schedules' ? 'bg-navy text-white shadow-sm' : 'text-muted-foreground hover:bg-soft'
          }`}
        >
          Active Schedules ({schedules.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('records')}
          className={`px-3 py-1.5 rounded-lg transition ${
            subTab === 'records' ? 'bg-navy text-white shadow-sm' : 'text-muted-foreground hover:bg-soft'
          }`}
        >
          Inspection History ({records.length})
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-bd bg-card p-4 animate-pulse space-y-2">
              <div className="h-4 bg-soft rounded w-1/3" />
              <div className="h-5 bg-soft rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* SCHEDULES SUB-TAB */}
      {!isLoading && subTab === 'schedules' && (
        <>
          {schedules.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
                <Icon n="refresh-cw" s={22} />
              </div>
              <h4 className="mt-2 text-sm font-bold text-navy">No preventive schedules</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Set up recurring maintenance schedules for lifts, pumps, generators, and fire systems.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedules.map((sched) => (
                <Card key={sched.id} className="p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Pill tone={sched.is_overdue ? 'h' : 't'}>
                        {sched.is_overdue ? `OVERDUE (${sched.days_overdue}d)` : 'ON SCHEDULE'}
                      </Pill>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        {FREQUENCY_LABELS[sched.frequency] || sched.frequency}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-navy truncate">{sched.facility_name}</h4>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>Dept: <strong className="text-navy">{sched.department_name}</strong></div>
                      <div>Staff: <strong className="text-navy">{sched.assigned_staff_name}</strong></div>
                      <div>Next Due: <strong className={sched.is_overdue ? 'text-red-600 font-bold' : 'text-navy'}>{sched.next_due_date}</strong></div>
                      {sched.last_completed_date && (
                        <div>Last Done: <span>{sched.last_completed_date}</span></div>
                      )}
                    </div>

                    {/* Checklist Preview */}
                    {sched.checklist_items && sched.checklist_items.length > 0 && (
                      <div className="pt-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                          Checklist Items ({sched.checklist_items.length})
                        </span>
                        <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                          {sched.checklist_items.slice(0, 3).map((item, i) => (
                            <li key={i} className="truncate">{item}</li>
                          ))}
                          {sched.checklist_items.length > 3 && (
                            <li className="text-[10px] italic">+{sched.checklist_items.length - 3} more items</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-bd/60 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => openInspectModal(sched)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal text-white px-3 py-1.5 text-xs font-semibold hover:bg-teal/90 transition shadow-sm"
                    >
                      <Icon n="check" s={13} />
                      <span>Log Inspection</span>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* RECORDS SUB-TAB */}
      {!isLoading && subTab === 'records' && (
        <>
          {records.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
                <Icon n="file" s={22} />
              </div>
              <h4 className="mt-2 text-sm font-bold text-navy">No inspection history yet</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded inspection checklists and status reports will appear here.
              </p>
            </Card>
          ) : (
            <div className="rounded-xl border border-bd bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-soft/70 border-b border-bd/60 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Facility Asset</th>
                      <th className="p-3">Inspector</th>
                      <th className="p-3">Outcome Status</th>
                      <th className="p-3">Observations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bd/60">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-soft/40 transition">
                        <td className="p-3 whitespace-nowrap font-mono">{r.performed_date}</td>
                        <td className="p-3 font-semibold text-navy">{r.facility_name}</td>
                        <td className="p-3 text-muted-foreground">{r.inspector_name}</td>
                        <td className="p-3">
                          <Pill tone={r.status === 'satisfactory' ? 't' : r.status === 'needs_repair' ? 'w' : 'h'}>
                            {r.status.replace(/_/g, ' ').toUpperCase()}
                          </Pill>
                        </td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate">
                          {r.observations || 'Routine pass, all checks verified.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: New Schedule */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy">New Preventive Schedule</h3>
                <p className="text-xs text-muted-foreground">Define facility servicing cadence</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-navy"
              >
                ✕
              </button>
            </div>

            {scheduleError && (
              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {scheduleError}
              </div>
            )}

            <form onSubmit={handleCreateSchedule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                  Facility / Equipment Name *
                </label>
                <input
                  type="text"
                  required
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="e.g. Passenger Elevator Bank A"
                  className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Department *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Cadence / Frequency *
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Assigned Staff / Lead
                  </label>
                  <select
                    value={assignedStaffId}
                    onChange={(e) => setAssignedStaffId(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {eligibleStaff.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.fullName} ({s.designation || s.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Next Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                  Checklist Items (One per line)
                </label>
                <textarea
                  rows={3}
                  value={checklistRaw}
                  onChange={(e) => setChecklistRaw(e.target.value)}
                  placeholder="Check motor temperature&#10;Test emergency brake stop&#10;Inspect door sensor alignment"
                  className="w-full rounded-lg border border-bd bg-card p-2.5 text-xs text-navy focus:border-teal focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-bd/60">
                <Btn type="button" onClick={() => setShowCreateModal(false)} className="py-2 text-xs">
                  Cancel
                </Btn>
                <Btn type="submit" v="p" disabled={isSubmittingSchedule} className="py-2 text-xs">
                  {isSubmittingSchedule ? 'Saving...' : 'Create Schedule'}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Log Inspection */}
      {showInspectModal && inspectSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy">Record Maintenance Inspection</h3>
                <p className="text-xs text-muted-foreground">{inspectSchedule.facility_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="text-muted-foreground hover:text-navy"
              >
                ✕
              </button>
            </div>

            {inspectionError && (
              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {inspectionError}
              </div>
            )}

            <form onSubmit={handleRecordInspection} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Inspection Outcome *
                  </label>
                  <select
                    value={inspectStatus}
                    onChange={(e) => setInspectStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  >
                    <option value="satisfactory">Satisfactory (Passed)</option>
                    <option value="needs_repair">Needs Repair (Minor Issue)</option>
                    <option value="critical_fault">Critical Fault (Defect Alert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Inspection Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={inspectDate}
                    onChange={(e) => setInspectDate(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>
              </div>

              {/* Checklist verification items */}
              {inspectSchedule.checklist_items && inspectSchedule.checklist_items.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Checklist Verification
                  </label>
                  <div className="space-y-1.5 bg-soft/50 p-3 rounded-lg border border-bd/60">
                    {inspectSchedule.checklist_items.map((item, idx) => (
                      <label key={idx} className="flex items-center gap-2 text-xs text-navy cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklistAnswers[item] !== false}
                          onChange={(e) =>
                            setChecklistAnswers({ ...checklistAnswers, [item]: e.target.checked })
                          }
                          className="text-teal focus:ring-teal rounded"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                  Observations / Technical Notes
                </label>
                <textarea
                  rows={3}
                  value={inspectObservations}
                  onChange={(e) => setInspectObservations(e.target.value)}
                  placeholder="Note any readings, wear and tear, or recommended actions..."
                  className="w-full rounded-lg border border-bd bg-card p-2.5 text-xs text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-teal/5 border border-teal/20 p-2.5 text-[11px] text-teal">
                Recording this inspection will update the last completed date to <strong>{inspectDate}</strong> and roll forward the next due date automatically according to schedule frequency.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-bd/60">
                <Btn type="button" onClick={() => setShowInspectModal(false)} className="py-2 text-xs">
                  Cancel
                </Btn>
                <Btn type="submit" v="p" disabled={isSubmittingInspection} className="py-2 text-xs">
                  {isSubmittingInspection ? 'Submitting...' : 'Save Record & Roll Forward'}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
