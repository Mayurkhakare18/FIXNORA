// ==============================================================================
// SmartResolve Citizen: Resident Dashboard
// Live PostgreSQL complaints register, resolution reviews, ratings, and reopen flows
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchResidentDashboardData,
  type ResidentDashboardData,
} from '../../lib/complaintService';
import { submitResidentResolutionReview } from '../../lib/resolutionService';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const CitizenDashboard: React.FC = () => {
  const { user, currentSociety } = useAuth();

  const [dashboardData, setDashboardData] = useState<ResidentDashboardData>({
    total: 0,
    underReview: 0,
    inProgress: 0,
    resolved: 0,
    recentComplaints: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Verification Modal State
  const [verifyingComplaint, setVerifyingComplaint] = useState<any | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [satisfactionLevel, setSatisfactionLevel] = useState<
    'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied'
  >('very_satisfied');
  const [feedbackText, setFeedbackText] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Reopen Modal State
  const [reopeningComplaint, setReopeningComplaint] = useState<any | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [isSubmittingReopen, setIsSubmittingReopen] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user || !currentSociety) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchResidentDashboardData(user.id, currentSociety.id);
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to load resident dashboard complaints:', err);
      setError(err.message || 'Could not load your complaints register.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, currentSociety?.id]);

  const filteredComplaints = dashboardData.recentComplaints.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.tracking_id.toLowerCase().includes(q) ||
      (c.category?.name && c.category.name.toLowerCase().includes(q))
    );
  });

  // Complaints currently awaiting resident review
  const pendingVerifications = dashboardData.recentComplaints.filter(
    (c) => c.status === 'resolved'
  );

  const getStatusPillTone = (status: string): 'n' | 'h' | 't' | 'w' => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 't';
      case 'in_progress':
      case 'assigned':
        return 'n';
      case 'reopened':
        return 'h';
      case 'rejected':
        return 'h';
      default:
        return 'w';
    }
  };

  const handleConfirmResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingComplaint || !user || !currentSociety) return;

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      await submitResidentResolutionReview({
        complaintId: verifyingComplaint.id,
        societyId: currentSociety.id,
        residentId: user.id,
        isSatisfied: true,
        rating,
        satisfactionLevel,
        feedbackText,
        verificationNotes,
      });

      setActionSuccessMessage(
        `Resolution confirmed for ticket #${verifyingComplaint.tracking_id}. Thank you for your feedback!`
      );
      setVerifyingComplaint(null);
      setFeedbackText('');
      setVerificationNotes('');
      await loadData();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit resolution confirmation.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReopenComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopeningComplaint || !user || !currentSociety) return;

    if (!reopenReason.trim() || reopenReason.trim().length < 10) {
      setReopenError('A detailed explanation (minimum 10 characters) is required to reopen.');
      return;
    }

    setIsSubmittingReopen(true);
    setReopenError(null);

    try {
      await submitResidentResolutionReview({
        complaintId: reopeningComplaint.id,
        societyId: currentSociety.id,
        residentId: user.id,
        isSatisfied: false,
        verificationNotes: reopenReason.trim(),
      });

      setActionSuccessMessage(
        `Complaint #${reopeningComplaint.tracking_id} has been reopened and returned to the assignment queue.`
      );
      setReopeningComplaint(null);
      setReopenReason('');
      await loadData();
    } catch (err: any) {
      setReopenError(err.message || 'Failed to reopen complaint.');
    } finally {
      setIsSubmittingReopen(false);
    }
  };

  return (
    <DashboardLayout
      roleTitle="Resident Portal"
      roleBadge="Resident"
      navItems={CITIZEN_NAV}
    >
      <div className="space-y-6">
        {/* Welcome & Primary Action */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Resident Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Active Society: <strong className="text-navy">{currentSociety?.name || 'Loading...'}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh dashboard"
              className="rounded-lg border border-bd bg-card p-2 text-muted-foreground hover:text-navy hover:border-teal transition disabled:opacity-50"
            >
              <Icon n="refresh-cw" s={16} c={isLoading ? "animate-spin text-teal" : ""} />
            </button>
            <Link to="/complaints/new">
              <Btn v="p" className="shadow-md">
                <Icon n="upload" s={16} />
                <span>Report New Issue</span>
              </Btn>
            </Link>
          </div>
        </div>

        {/* Global Action Success Toast */}
        {actionSuccessMessage && (
          <div className="rounded-xl border border-teal/30 bg-teal/10 p-3.5 text-xs text-teal font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon n="check" s={16} c="shrink-0 text-teal" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccessMessage(null)}
              className="text-teal/70 hover:text-teal text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Configuration Notice if Supabase is unconfigured */}
        {!isSupabaseConfigured && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
            <strong>Configuration Notice:</strong> Supabase credentials are not configured in <code className="font-mono">.env</code>. Live complaint statistics and database persistence will activate once keys are provided.
          </div>
        )}

        {/* Action Required: Resolution Verification Banner */}
        {!isLoading && pendingVerifications.length > 0 && (
          <div className="rounded-2xl border-2 border-teal/40 bg-teal/5 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-teal font-bold text-sm">
              <Icon n="bell" s={18} c="text-teal shrink-0" />
              <span>Action Required: Resolution Verification ({pendingVerifications.length})</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In-house maintenance staff have completed repairs on the tickets below. Please test the repair and either confirm satisfactory resolution with a rating or request reopening if the issue persists.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {pendingVerifications.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-teal/30 bg-card p-4 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-teal">
                        #{item.tracking_id}
                      </span>
                      <Pill tone="t">AWAITING YOUR REVIEW</Pill>
                    </div>
                    <h4 className="text-sm font-bold text-navy truncate">{item.title}</h4>
                    {item.resolution_remarks && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 bg-soft/60 p-2 rounded border border-bd/40">
                        <strong>Technician Note:</strong> {item.resolution_remarks}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-bd/40">
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyingComplaint(item);
                        setReviewError(null);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal text-white py-1.5 px-3 text-xs font-semibold hover:bg-teal/90 transition shadow-sm"
                    >
                      <Icon n="check" s={14} />
                      <span>Confirm Fixed & Rate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReopeningComplaint(item);
                        setReopenError(null);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 py-1.5 px-3 text-xs font-semibold hover:bg-red-100 transition"
                    >
                      <Icon n="refresh-cw" s={14} />
                      <span>Issue Persists</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Counters derived directly from authorized database records */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Complaints
            </div>
            <div className="mt-2 text-2xl font-bold text-navy">
              {isLoading ? '...' : dashboardData.total}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Submitted by you
            </div>
          </Card>

          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Under Review
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {isLoading ? '...' : dashboardData.underReview}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Pending triage
            </div>
          </Card>

          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Progress
            </div>
            <div className="mt-2 text-2xl font-bold text-brand">
              {isLoading ? '...' : dashboardData.inProgress}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Assigned to technicians
            </div>
          </Card>

          <Card className="p-4 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resolved & Closed
            </div>
            <div className="mt-2 text-2xl font-bold text-teal">
              {isLoading ? '...' : dashboardData.resolved}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Fixed & verified
            </div>
          </Card>
        </div>

        {/* Complaints Register Section */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-bd/60 mb-6">
            <div>
              <h2 className="text-base font-bold text-navy">My Submitted Complaints</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time society database records with tracking milestones
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Filter by title or ID..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-56 rounded-lg border border-bd bg-card px-3 py-1.5 text-xs text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>
          </div>

          {/* Error View */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 border border-red-200 mb-4 flex items-center justify-between">
              <span>{error}</span>
              <Btn type="button" onClick={loadData} className="text-xs py-1 px-3">
                Retry
              </Btn>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-soft/70 animate-pulse" />
              ))}
            </div>
          )}

          {/* Populated Complaints List */}
          {!isLoading && filteredComplaints.length > 0 && (
            <div className="space-y-3">
              {filteredComplaints.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-bd bg-soft/30 hover:bg-soft/60 p-4 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal">
                        {c.tracking_id}
                      </span>
                      <Pill tone={getStatusPillTone(c.status)}>
                        {c.status.replace(/_/g, ' ').toUpperCase()}
                      </Pill>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Priority: {c.priority}
                      </span>
                      {c.status === 'reopened' && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          Reopened Follow-Up
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-navy">{c.title}</h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{c.category?.name || 'General Issue'}</span>
                      {c.building?.name && (
                        <>
                          <span>•</span>
                          <span>
                            {c.building.name}
                            {c.flat?.flat_number ? ` / Flat ${c.flat.flat_number}` : ''}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(c.submitted_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {c.status === 'resolved' && (
                      <p className="text-xs text-teal font-medium mt-1">
                        Repair completed by technician. Ready for your review.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {c.status === 'resolved' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setVerifyingComplaint(c)}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal text-white text-xs font-semibold py-1.5 px-3 hover:bg-teal/90 transition shadow-sm"
                        >
                          <Icon n="check" s={14} />
                          <span>Review</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReopeningComplaint(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold py-1.5 px-2.5 hover:bg-red-100 transition"
                        >
                          <Icon n="refresh-cw" s={14} />
                          <span>Reopen</span>
                        </button>
                      </>
                    )}

                    <Link to={`/track?id=${c.tracking_id}`}>
                      <Btn v="secondary" className="text-xs py-1.5 px-3">
                        <Icon n="search" s={14} />
                        <span>Track</span>
                      </Btn>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filter returned 0 results */}
          {!isLoading && dashboardData.recentComplaints.length > 0 && filteredComplaints.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No complaints match your filter criteria "{filterQuery}".
            </div>
          )}

          {/* Genuine Empty State */}
          {!isLoading && dashboardData.recentComplaints.length === 0 && (
            <div className="py-12 text-center max-w-md mx-auto">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4 shadow-sm">
                <Icon n="file" s={28} />
              </div>
              <h3 className="text-base font-bold text-navy">No complaints submitted yet</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                You haven't submitted any complaints under this account. When you submit an issue, its genuine tracking ID, status milestones, and assigned department will appear here.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/complaints/new">
                  <Btn v="p" className="text-xs px-5">
                    Submit Your First Issue
                  </Btn>
                </Link>
                <Link to="/track">
                  <Btn className="text-xs px-5">
                    Track by ID
                  </Btn>
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* MODAL 1: Confirm Resolution & Feedback */}
      {verifyingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-bd bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-navy">Confirm Resolution & Rate</h3>
                <p className="text-xs text-muted-foreground">
                  Ticket #{verifyingComplaint.tracking_id} • {verifyingComplaint.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingComplaint(null)}
                className="text-muted-foreground hover:text-navy text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {reviewError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 mb-4">
                {reviewError}
              </div>
            )}

            <form onSubmit={handleConfirmResolution} className="space-y-4">
              {/* Star Rating */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-2">
                  Overall Rating (1 to 5 Stars) *
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 text-2xl transition hover:scale-110 focus:outline-none"
                    >
                      <span className={star <= rating ? "text-amber-400" : "text-gray-300"}>
                        ★
                      </span>
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-navy">
                    {rating === 5 ? 'Excellent' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : rating === 2 ? 'Poor' : 'Very Poor'}
                  </span>
                </div>
              </div>

              {/* Satisfaction Level */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Satisfaction Level
                </label>
                <select
                  value={satisfactionLevel}
                  onChange={(e) => setSatisfactionLevel(e.target.value as any)}
                  className="w-full rounded-lg border border-bd bg-background px-3 py-2 text-xs text-navy focus:border-teal focus:outline-none"
                >
                  <option value="very_satisfied">Very Satisfied</option>
                  <option value="satisfied">Satisfied</option>
                  <option value="neutral">Neutral</option>
                  <option value="dissatisfied">Dissatisfied</option>
                  <option value="very_dissatisfied">Very Dissatisfied</option>
                </select>
              </div>

              {/* Optional Feedback */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Comments / Review (Optional)
                </label>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share details on the quality of work performed..."
                  className="w-full rounded-lg border border-bd bg-background p-3 text-xs text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-bd/60">
                <button
                  type="button"
                  onClick={() => setVerifyingComplaint(null)}
                  className="rounded-lg border border-bd px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-soft transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-5 py-2 text-xs font-semibold text-white hover:bg-teal/90 transition shadow-sm disabled:opacity-50"
                >
                  <Icon n="check" s={14} />
                  <span>{isSubmittingReview ? 'Submitting...' : 'Confirm Resolution & Close'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Issue Persists / Request Reopen */}
      {reopeningComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-bd bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-navy">Request Reopening</h3>
                <p className="text-xs text-muted-foreground">
                  Ticket #{reopeningComplaint.tracking_id} • {reopeningComplaint.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReopeningComplaint(null)}
                className="text-muted-foreground hover:text-navy text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {reopenError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 mb-4">
                {reopenError}
              </div>
            )}

            <form onSubmit={handleReopenComplaint} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Why does this issue persist? (Required, min 10 characters) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain clearly what part of the issue is still unresolved or if the fault recurred..."
                  className="w-full rounded-lg border border-bd bg-background p-3 text-xs text-navy placeholder:text-muted-foreground/50 focus:border-red-400 focus:outline-none"
                />
                <span className="text-[11px] text-muted-foreground">
                  {reopenReason.length}/10 characters minimum
                </span>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                <strong>Notice:</strong> Submitting this reopen request will transition this ticket to <strong>REOPENED</strong> status and notify society supervisors and department administrators immediately to assign follow-up maintenance.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-bd/60">
                <button
                  type="button"
                  onClick={() => setReopeningComplaint(null)}
                  className="rounded-lg border border-bd px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-soft transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReopen || reopenReason.trim().length < 10}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition shadow-sm disabled:opacity-50"
                >
                  <Icon n="refresh-cw" s={14} />
                  <span>{isSubmittingReopen ? 'Reopening...' : 'Submit Reopen Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
