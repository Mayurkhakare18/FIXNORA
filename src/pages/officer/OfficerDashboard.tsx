// ==============================================================================
// SmartResolve Maintenance Operations: In-House Staff Queue
// Live assignment tracking, job lifecycle transitions, completion records, and notes
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Pill, Btn, Note } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchStaffAssignedQueue,
  acknowledgeAssignment,
  startJobWork,
  completeJobWork,
  addComplaintComment,
  type StaffQueueItem,
} from '../../lib/maintenanceService';

const OFFICER_NAV = [
  { label: "Assigned Queue", href: "/dashboard/officer", icon: "file" as const },
  { label: "Department Feed", href: "/dashboard/department", icon: "users" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const OfficerDashboard: React.FC = () => {
  const { user, currentSociety, currentMembership } = useAuth();

  const [queueItems, setQueueItems] = useState<StaffQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'assigned' | 'in_progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Completion Modal State
  const [completingItem, setCompletingItem] = useState<StaffQueueItem | null>(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [laborHours, setLaborHours] = useState('1.5');
  const [materialCost, setMaterialCost] = useState('0');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Note Modal State
  const [notingItem, setNotingItem] = useState<StaffQueueItem | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(true);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const loadQueue = async () => {
    if (!user || !currentSociety) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchStaffAssignedQueue(user.id, currentSociety.id);
      setQueueItems(data);
    } catch (err: any) {
      console.error('Failed to load staff assigned queue:', err);
      setError(err.message || 'Could not load your assigned maintenance queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [user?.id, currentSociety?.id]);

  // Acknowledge assignment
  const handleAcknowledge = async (item: StaffQueueItem) => {
    try {
      setFeedbackMessage(`Acknowledging assignment for ${item.complaint.tracking_id}...`);
      await acknowledgeAssignment(item.assignment.id);
      setFeedbackMessage(`Assignment ${item.complaint.tracking_id} acknowledged.`);
      await loadQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to acknowledge assignment.');
    }
  };

  // Start work
  const handleStartWork = async (item: StaffQueueItem) => {
    try {
      setFeedbackMessage(`Starting repair work for ${item.complaint.tracking_id}...`);
      await startJobWork({
        assignmentId: item.assignment.id,
        complaintId: item.complaint.id,
        jobId: item.job?.id,
      });
      setFeedbackMessage(`Job for ${item.complaint.tracking_id} is now in progress.`);
      await loadQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to start job.');
    }
  };

  // Submit completion details
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem) return;

    if (!repairNotes.trim() || repairNotes.trim().length < 10) {
      setCompletionError('Detailed repair notes (at least 10 characters) are required.');
      return;
    }

    setCompletionError(null);
    setIsSubmittingCompletion(true);

    try {
      await completeJobWork({
        assignmentId: completingItem.assignment.id,
        complaintId: completingItem.complaint.id,
        jobId: completingItem.job?.id,
        repairNotes: repairNotes.trim(),
        laborHours: parseFloat(laborHours) || 0,
        materialCost: parseFloat(materialCost) || 0,
      });

      setFeedbackMessage(`Complaint ${completingItem.complaint.tracking_id} successfully marked as resolved.`);
      setCompletingItem(null);
      setRepairNotes('');
      setLaborHours('1.5');
      setMaterialCost('0');
      await loadQueue();
    } catch (err: any) {
      setCompletionError(err.message || 'Failed to submit completion record.');
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  // Submit note / observation
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notingItem || !user || !currentSociety) return;

    if (!noteText.trim() || noteText.trim().length < 3) {
      setNoteError('Note text must be at least 3 characters.');
      return;
    }

    setNoteError(null);
    setIsSubmittingNote(true);

    try {
      await addComplaintComment({
        complaintId: notingItem.complaint.id,
        societyId: currentSociety.id,
        authorId: user.id,
        commentText: noteText.trim(),
        isInternal: isInternalNote,
      });

      setFeedbackMessage(
        isInternalNote
          ? 'Internal staff note added to ticket history.'
          : 'Public bulletin update posted.'
      );
      setNotingItem(null);
      setNoteText('');
    } catch (err: any) {
      setNoteError(err.message || 'Failed to record note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Counters
  const totalCount = queueItems.length;
  const assignedCount = queueItems.filter((i) => i.assignment.status === 'assigned').length;
  const inProgressCount = queueItems.filter((i) =>
    ['accepted', 'in_progress'].includes(i.assignment.status)
  ).length;
  const completedCount = queueItems.filter((i) => i.assignment.status === 'completed').length;

  // Filtered Items
  const filteredItems = queueItems.filter((item) => {
    if (activeTab === 'assigned' && item.assignment.status !== 'assigned') return false;
    if (activeTab === 'in_progress' && !['accepted', 'in_progress'].includes(item.assignment.status)) {
      return false;
    }
    if (activeTab === 'completed' && item.assignment.status !== 'completed') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.complaint.title.toLowerCase().includes(q) ||
        item.complaint.tracking_id.toLowerCase().includes(q) ||
        (item.complaint.location_details && item.complaint.location_details.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusPillTone = (status: string): 'n' | 'h' | 't' | 'w' => {
    switch (status) {
      case 'completed':
      case 'resolved':
        return 't';
      case 'in_progress':
      case 'accepted':
        return 'n';
      case 'rejected':
      case 'cancelled':
        return 'h';
      default:
        return 'w';
    }
  };

  return (
    <DashboardLayout
      roleTitle="In-House Staff Portal"
      roleBadge={currentMembership?.staff_designation || "Technician"}
      navItems={OFFICER_NAV}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Assigned Work Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Service requests assigned to your in-house maintenance profile in {currentSociety?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadQueue}
              disabled={isLoading}
              title="Refresh queue"
              className="rounded-lg border border-bd bg-card p-2 text-muted-foreground hover:text-navy hover:border-teal transition disabled:opacity-50"
            >
              <Icon n="refresh-cw" s={16} c={isLoading ? "animate-spin text-teal" : ""} />
            </button>
            <Pill tone="t">
              {currentMembership?.staff_designation || "In-House Maintenance Staff"}
            </Pill>
          </div>
        </div>

        {/* Configuration Notice if unconfigured */}
        {!isSupabaseConfigured && (
          <Note icon="alert" className="border-amber-400 bg-amber-50 text-amber-900">
            <strong>Configuration Notice:</strong> Supabase credentials are missing. Live work tickets and database updates will connect once valid keys are placed in <code className="font-mono">.env</code>.
          </Note>
        )}

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="rounded-lg bg-teal/10 p-3 text-xs text-teal font-medium border border-teal/20 flex items-center justify-between">
            <span>{feedbackMessage}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="font-bold text-teal hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* Queue Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Assigned
            </div>
            <div className="mt-2 text-2xl font-bold text-navy">
              {isLoading ? '...' : totalCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">All time tasks</div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              New / Awaiting Action
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {isLoading ? '...' : assignedCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Pending acknowledgement</div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Progress
            </div>
            <div className="mt-2 text-2xl font-bold text-brand">
              {isLoading ? '...' : inProgressCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Under active repair</div>
          </Card>
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Completed
            </div>
            <div className="mt-2 text-2xl font-bold text-teal">
              {isLoading ? '...' : completedCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Resolved by you</div>
          </Card>
        </div>

        {/* Tab Filters & Queue Table */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bd/60 pb-4 mb-6">
            <div className="flex gap-2">
              {(
                [
                  ['all', `All Cases (${totalCount})`],
                  ['assigned', `New (${assignedCount})`],
                  ['in_progress', `In Progress (${inProgressCount})`],
                  ['completed', `Completed (${completedCount})`],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === tab
                      ? "bg-[#263B52] text-white shadow-sm"
                      : "text-muted-foreground hover:bg-soft hover:text-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search ticket title or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-lg border border-bd bg-card px-3 py-1.5 text-xs text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 mb-4">
              {error}
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-soft animate-pulse" />
              ))}
            </div>
          )}

          {/* Populated Queue Items */}
          {!isLoading && filteredItems.length > 0 && (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const comp = item.complaint;
                const assign = item.assignment;
                return (
                  <div
                    key={assign.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-bd bg-soft/30 hover:bg-soft/60 p-4 transition"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal">
                          {comp.tracking_id}
                        </span>
                        <Pill tone={getStatusPillTone(assign.status)}>
                          {assign.status.replace(/_/g, ' ').toUpperCase()}
                        </Pill>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                          Priority: {comp.priority}
                        </span>
                        {assign.target_deadline && (
                          <span className="text-[10px] text-red-600 font-medium">
                            Due: {new Date(assign.target_deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-navy">{comp.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {comp.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
                        <span>{comp.category?.name || 'Category'}</span>
                        {comp.building?.name && (
                          <>
                            <span>•</span>
                            <span>
                              {comp.building.name}
                              {comp.flat?.flat_number ? ` / Flat ${comp.flat.flat_number}` : ''}
                            </span>
                          </>
                        )}
                        {comp.location_details && (
                          <>
                            <span>•</span>
                            <span>{comp.location_details}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Operational Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-bd/60">
                      {/* Acknowledge Button */}
                      {assign.status === 'assigned' && (
                        <Btn
                          v="p"
                          onClick={() => handleAcknowledge(item)}
                          className="text-xs py-1.5 px-3 bg-teal hover:bg-teal/90"
                        >
                          <Icon n="check" s={14} />
                          <span>Accept Task</span>
                        </Btn>
                      )}

                      {/* Start Work Button */}
                      {assign.status === 'accepted' && (
                        <Btn
                          v="p"
                          onClick={() => handleStartWork(item)}
                          className="text-xs py-1.5 px-3 bg-brand hover:bg-brand/90"
                        >
                          <Icon n="arrow-right" s={14} />
                          <span>Start Work</span>
                        </Btn>
                      )}

                      {/* Complete Work Button */}
                      {assign.status === 'in_progress' && (
                        <Btn
                          v="p"
                          onClick={() => setCompletingItem(item)}
                          className="text-xs py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white"
                        >
                          <Icon n="check" s={14} />
                          <span>Complete Work</span>
                        </Btn>
                      )}

                      {/* Completed Badge */}
                      {assign.status === 'completed' && (
                        <span className="text-xs font-semibold text-teal inline-flex items-center gap-1">
                          <Icon n="check" s={14} />
                          <span>Resolved</span>
                        </span>
                      )}

                      {/* Add Observation Note */}
                      <Btn
                        onClick={() => setNotingItem(item)}
                        className="text-xs py-1.5 px-3"
                      >
                        <Icon n="file" s={12} />
                        <span>Add Note</span>
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredItems.length === 0 && (
            <div className="py-12 text-center max-w-md mx-auto">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
                <Icon n="users" s={28} />
              </div>
              <h3 className="text-base font-bold text-navy">No work items found</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {activeTab === 'all'
                  ? "No complaint tickets are assigned to your technician profile in this society."
                  : `No tasks currently in "${activeTab}" status.`}
              </p>
            </div>
          )}
        </Card>

        {/* Completion Modal */}
        {completingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <Card className="max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-navy">Submit Job Completion</h3>
                  <p className="text-xs text-muted-foreground">
                    Ticket: <span className="font-mono font-bold text-teal">{completingItem.complaint.tracking_id}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletingItem(null)}
                  className="text-muted-foreground hover:text-navy font-bold"
                >
                  ✕
                </button>
              </div>

              {completionError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {completionError}
                </div>
              )}

              <form onSubmit={handleCompleteSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Repair & Maintenance Notes *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={repairNotes}
                    onChange={(e) => setRepairNotes(e.target.value)}
                    placeholder="Describe parts replaced, tests conducted, and observations (min 10 characters)..."
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                      Labor Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={laborHours}
                      onChange={(e) => setLaborHours(e.target.value)}
                      className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                      Material Cost (INR)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={materialCost}
                      onChange={(e) => setMaterialCost(e.target.value)}
                      className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-bd/60">
                  <Btn
                    type="button"
                    onClick={() => setCompletingItem(null)}
                    className="text-xs py-1.5"
                  >
                    Cancel
                  </Btn>
                  <Btn
                    type="submit"
                    v="p"
                    disabled={isSubmittingCompletion}
                    className="text-xs py-1.5 px-4 bg-emerald-700 hover:bg-emerald-800"
                  >
                    {isSubmittingCompletion ? 'Recording Resolution...' : 'Confirm Resolution'}
                  </Btn>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Add Note Modal */}
        {notingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <Card className="max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-bd/60 pb-3">
                <h3 className="text-base font-bold text-navy">Add Technician Observation</h3>
                <button
                  type="button"
                  onClick={() => setNotingItem(null)}
                  className="text-muted-foreground hover:text-navy font-bold"
                >
                  ✕
                </button>
              </div>

              {noteError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {noteError}
                </div>
              )}

              <form onSubmit={handleNoteSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                    Note / Observation *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Internal observation or public status note..."
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-bd bg-soft p-2.5">
                  <input
                    type="checkbox"
                    id="isInternal"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded border-bd text-teal focus:ring-teal"
                  />
                  <label htmlFor="isInternal" className="text-xs text-navy cursor-pointer">
                    <strong className="block">Internal Staff Note</strong>
                    <span className="text-muted-foreground text-[11px]">
                      Hidden from residents; visible only to staff and administrators.
                    </span>
                  </label>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-bd/60">
                  <Btn
                    type="button"
                    onClick={() => setNotingItem(null)}
                    className="text-xs py-1.5"
                  >
                    Cancel
                  </Btn>
                  <Btn
                    type="submit"
                    v="p"
                    disabled={isSubmittingNote}
                    className="text-xs py-1.5 px-4"
                  >
                    {isSubmittingNote ? 'Saving...' : 'Post Note'}
                  </Btn>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
