// ==============================================================================
// SmartResolve Citizen: Resident Dashboard
// Live PostgreSQL complaints register, resolution reviews, ratings, reopen flows,
// society announcements, community polls & voting, and emergency contacts
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn, Pill, cn } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchResidentDashboardData,
  type ResidentDashboardData,
} from '../../lib/complaintService';
import { submitResidentResolutionReview } from '../../lib/resolutionService';
import {
  fetchSocietyAnnouncements,
  fetchSocietyPolls,
  fetchSocietyEmergencyContacts,
  castPollVote,
  type AnnouncementWithAuthor,
  type PollWithOptions,
} from '../../lib/communityService';
import type { EmergencyContact } from '../../types/database';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const CitizenDashboard: React.FC = () => {
  const { user, currentSociety, currentMembership } = useAuth();

  // Active top-level portal tab
  const [activeTab, setActiveTab] = useState<'complaints' | 'announcements' | 'polls' | 'emergency'>('complaints');

  // Complaints state
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

  // Community Features State
  const [announcements, setAnnouncements] = useState<AnnouncementWithAuthor[]>([]);
  const [announcementCategory, setAnnouncementCategory] = useState<string>('all');
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);

  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [selectedPollOption, setSelectedPollOption] = useState<Record<string, string>>({});
  const [isSubmittingVote, setIsSubmittingVote] = useState<Record<string, boolean>>({});
  const [voteError, setVoteError] = useState<Record<string, string | null>>({});
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

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

  const loadCommunityData = async () => {
    if (!currentSociety) return;

    // Load Announcements
    setIsLoadingAnnouncements(true);
    try {
      const { data: annData } = await fetchSocietyAnnouncements(currentSociety.id);
      setAnnouncements(annData || []);
    } catch (e) {
      console.error('Error fetching announcements:', e);
    } finally {
      setIsLoadingAnnouncements(false);
    }

    // Load Polls
    setIsLoadingPolls(true);
    try {
      const { data: pollData } = await fetchSocietyPolls(
        currentSociety.id,
        user?.id,
        currentMembership?.flat_id
      );
      setPolls(pollData || []);
    } catch (e) {
      console.error('Error fetching polls:', e);
    } finally {
      setIsLoadingPolls(false);
    }

    // Load Emergency Contacts
    setIsLoadingContacts(true);
    try {
      const { data: contactData } = await fetchSocietyEmergencyContacts(currentSociety.id);
      setEmergencyContacts(contactData || []);
    } catch (e) {
      console.error('Error fetching contacts:', e);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCommunityData();
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

  const filteredAnnouncements = announcements.filter((a) => {
    if (announcementCategory === 'all') return true;
    return a.category === announcementCategory;
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

  const handleVoteSubmit = async (pollId: string) => {
    const optionId = selectedPollOption[pollId];
    if (!optionId || !user || !currentSociety) return;

    setIsSubmittingVote((prev) => ({ ...prev, [pollId]: true }));
    setVoteError((prev) => ({ ...prev, [pollId]: null }));

    try {
      const res = await castPollVote(
        pollId,
        optionId,
        user.id,
        currentMembership?.flat_id
      );

      if (!res.success) {
        setVoteError((prev) => ({ ...prev, [pollId]: res.error || 'Failed to submit vote' }));
      } else {
        setActionSuccessMessage('Your vote has been cast and recorded successfully!');
        // Refresh polls
        const { data: updatedPolls } = await fetchSocietyPolls(
          currentSociety.id,
          user.id,
          currentMembership?.flat_id
        );
        if (updatedPolls) setPolls(updatedPolls);
      }
    } catch (err: any) {
      setVoteError((prev) => ({ ...prev, [pollId]: err.message || 'Vote failed' }));
    } finally {
      setIsSubmittingVote((prev) => ({ ...prev, [pollId]: false }));
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
              onClick={() => {
                loadData();
                loadCommunityData();
              }}
              disabled={isLoading || isLoadingAnnouncements || isLoadingPolls}
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

        {/* Resident Portal Tab Selector */}
        <div className="flex border-b border-bd gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('complaints')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition shrink-0",
              activeTab === 'complaints'
                ? "bg-teal text-white shadow-sm"
                : "text-navy hover:bg-soft"
            )}
          >
            <Icon n="file" s={15} />
            <span>My Complaints</span>
            {dashboardData.total > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === 'complaints' ? "bg-white/20 text-white" : "bg-bd text-navy"
                )}
              >
                {dashboardData.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition shrink-0",
              activeTab === 'announcements'
                ? "bg-teal text-white shadow-sm"
                : "text-navy hover:bg-soft"
            )}
          >
            <Icon n="bell" s={15} />
            <span>Announcements</span>
            {announcements.length > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === 'announcements' ? "bg-white/20 text-white" : "bg-bd text-navy"
                )}
              >
                {announcements.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('polls')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition shrink-0",
              activeTab === 'polls'
                ? "bg-teal text-white shadow-sm"
                : "text-navy hover:bg-soft"
            )}
          >
            <Icon n="check" s={15} />
            <span>Polls & Voting</span>
            {polls.filter((p) => p.is_active).length > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === 'polls' ? "bg-white/20 text-white" : "bg-bd text-navy"
                )}
              >
                {polls.filter((p) => p.is_active).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('emergency')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition shrink-0",
              activeTab === 'emergency'
                ? "bg-teal text-white shadow-sm"
                : "text-navy hover:bg-soft"
            )}
          >
            <Icon n="alert" s={15} />
            <span>Emergency Contacts</span>
            {emergencyContacts.length > 0 && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === 'emergency' ? "bg-white/20 text-white" : "bg-bd text-navy"
                )}
              >
                {emergencyContacts.length}
              </span>
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: COMPLAINTS & RESOLUTION VERIFICATION                        */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'complaints' && (
          <div className="space-y-6">
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

            {/* Live Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Complaints
                </div>
                <div className="mt-2 text-2xl font-bold text-navy">
                  {isLoading ? '...' : dashboardData.total}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">All time registered</div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Under Review
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-600">
                  {isLoading ? '...' : dashboardData.underReview}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Triage in progress</div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  In Progress
                </div>
                <div className="mt-2 text-2xl font-bold text-navy">
                  {isLoading ? '...' : dashboardData.inProgress}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Technician active</div>
              </Card>

              <Card className="p-4 shadow-sm">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Resolved / Closed
                </div>
                <div className="mt-2 text-2xl font-bold text-teal">
                  {isLoading ? '...' : dashboardData.resolved}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Successfully fixed</div>
              </Card>
            </div>

            {/* Complaints Register Header & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h3 className="text-base font-bold text-navy">My Reported Issues</h3>
                <p className="text-xs text-muted-foreground">
                  Track the real-time lifecycle, assignment details, and timeline of your complaints.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <Icon n="search" s={14} />
                </span>
                <input
                  type="text"
                  placeholder="Filter by title, ID, category..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-card pl-9 pr-3 py-1.5 text-xs text-navy placeholder:text-muted-foreground/60 focus:border-teal focus:outline-none"
                />
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-xl border border-bd bg-card p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-soft rounded w-1/4" />
                    <div className="h-5 bg-soft rounded w-3/4" />
                    <div className="h-4 bg-soft rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredComplaints.length === 0 && (
              <Card className="p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
                  <Icon n="file" s={24} />
                </div>
                <h3 className="mt-3 text-sm font-bold text-navy">No complaints found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  {filterQuery
                    ? `No complaints match "${filterQuery}". Try clearing your search.`
                    : "You haven't submitted any complaints in this society yet. Report a problem to alert maintenance."}
                </p>
                <div className="mt-4">
                  <Link to="/complaints/new">
                    <Btn v="p">Report An Issue</Btn>
                  </Link>
                </div>
              </Card>
            )}

            {/* Complaints List Cards */}
            {!isLoading && filteredComplaints.length > 0 && (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredComplaints.map((item) => (
                  <Card key={item.id} className="p-4 sm:p-5 hover:border-teal/50 transition">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal">
                            #{item.tracking_id}
                          </span>
                          <Pill tone={getStatusPillTone(item.status)}>
                            {item.status.replace(/_/g, ' ').toUpperCase()}
                          </Pill>
                          <span className="text-[11px] text-muted-foreground">
                            Priority: <strong className="capitalize text-navy">{item.priority}</strong>
                          </span>
                          {item.category?.name && (
                            <span className="text-[11px] text-muted-foreground">
                              • Category: <strong className="text-navy">{item.category.name}</strong>
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-bold text-navy truncate">{item.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2">
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        <Link
                          to={`/track?tracking_id=${encodeURIComponent(item.tracking_id)}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-teal hover:underline"
                        >
                          <span>Track Progress</span>
                          <Icon n="arrow-right" s={13} />
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: SOCIETY ANNOUNCEMENTS                                       */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-navy">Society Broadcasts & Circulars</h3>
                <p className="text-xs text-muted-foreground">
                  Official notices published by society administrators and maintenance supervisors.
                </p>
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {['all', 'general', 'maintenance', 'emergency', 'event', 'billing'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAnnouncementCategory(cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold capitalize transition",
                      announcementCategory === cat
                        ? "bg-navy text-white shadow-sm"
                        : "bg-soft text-navy hover:bg-bd"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingAnnouncements && (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="rounded-xl border border-bd bg-card p-5 animate-pulse space-y-2">
                    <div className="h-4 bg-soft rounded w-1/3" />
                    <div className="h-6 bg-soft rounded w-3/4" />
                    <div className="h-12 bg-soft rounded w-full" />
                  </div>
                ))}
              </div>
            )}

            {!isLoadingAnnouncements && filteredAnnouncements.length === 0 && (
              <Card className="p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
                  <Icon n="bell" s={22} />
                </div>
                <h4 className="mt-2 text-sm font-bold text-navy">No announcements in this category</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check back later for circulars or switch to "All" to see all notices.
                </p>
              </Card>
            )}

            {!isLoadingAnnouncements && filteredAnnouncements.length > 0 && (
              <div className="space-y-3.5">
                {filteredAnnouncements.map((ann) => (
                  <Card
                    key={ann.id}
                    className={cn(
                      "p-5 transition space-y-2.5",
                      ann.is_pinned
                        ? "border-amber-400 bg-amber-50/20 shadow-sm"
                        : "hover:border-teal/40"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {ann.is_pinned && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 border border-amber-300">
                            PINNED NOTICE
                          </span>
                        )}
                        <Pill tone={ann.category === 'emergency' ? 'h' : ann.category === 'maintenance' ? 'n' : 't'}>
                          {ann.category.toUpperCase()}
                        </Pill>
                        <span className="text-xs text-muted-foreground">
                          By <strong className="text-navy">{ann.author_name}</strong>
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(ann.published_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-navy">{ann.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {ann.content}
                    </p>

                    {ann.expires_at && (
                      <div className="text-[11px] text-muted-foreground pt-1">
                        Notice active until: <strong>{new Date(ann.expires_at).toLocaleDateString()}</strong>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: COMMUNITY POLLS & VOTING                                    */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'polls' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-navy">Community Polls & Decision Voting</h3>
              <p className="text-xs text-muted-foreground">
                Vote on society policies, maintenance priorities, and community resolutions.
              </p>
            </div>

            {isLoadingPolls && (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="rounded-xl border border-bd bg-card p-5 animate-pulse space-y-3">
                    <div className="h-5 bg-soft rounded w-1/2" />
                    <div className="h-10 bg-soft rounded w-full" />
                  </div>
                ))}
              </div>
            )}

            {!isLoadingPolls && polls.length === 0 && (
              <Card className="p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
                  <Icon n="check" s={22} />
                </div>
                <h4 className="mt-2 text-sm font-bold text-navy">No active community polls</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  When administrators publish a poll for voting, it will appear here.
                </p>
              </Card>
            )}

            {!isLoadingPolls && polls.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {polls.map((poll) => {
                  const isClosed = !poll.is_active || new Date(poll.closing_date) <= new Date();

                  return (
                    <Card key={poll.id} className="p-5 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground">
                            Voting Rule: <strong className="text-navy">{poll.voting_unit === 'per_flat' ? '1 Vote Per Flat' : '1 Vote Per Resident'}</strong>
                          </span>
                          <Pill tone={isClosed ? 'w' : 't'}>
                            {isClosed ? 'POLL CLOSED' : 'ACTIVE POLL'}
                          </Pill>
                        </div>

                        <h4 className="text-sm font-bold text-navy">{poll.question}</h4>
                        {poll.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {poll.description}
                          </p>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                          Deadline: <strong>{new Date(poll.closing_date).toLocaleDateString()}</strong> • Total Votes: <strong>{poll.total_votes}</strong>
                        </div>
                      </div>

                      {/* Vote Error Banner */}
                      {voteError[poll.id] && (
                        <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                          {voteError[poll.id]}
                        </div>
                      )}

                      {/* Voting Options */}
                      <div className="space-y-2.5 pt-2 border-t border-bd/60">
                        {poll.options.map((opt) => {
                          const percent = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                          const isSelected = selectedPollOption[poll.id] === opt.id;
                          const isUserVote = poll.user_voted_option_id === opt.id;

                          return (
                            <div key={opt.id} className="space-y-1">
                              <label
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition",
                                  poll.has_voted || isClosed
                                    ? isUserVote
                                      ? "border-teal bg-teal/5 font-bold text-teal"
                                      : "border-bd bg-card text-muted-foreground cursor-default"
                                    : isSelected
                                    ? "border-teal bg-teal/5 font-semibold text-navy"
                                    : "border-bd bg-card hover:bg-soft text-navy"
                                )}
                              >
                                <div className="flex items-center gap-2.5">
                                  {!poll.has_voted && !isClosed && (
                                    <input
                                      type="radio"
                                      name={`poll_${poll.id}`}
                                      value={opt.id}
                                      checked={isSelected}
                                      onChange={() =>
                                        setSelectedPollOption((prev) => ({
                                          ...prev,
                                          [poll.id]: opt.id,
                                        }))
                                      }
                                      className="text-teal focus:ring-teal"
                                    />
                                  )}
                                  <span>{opt.option_text}</span>
                                  {isUserVote && (
                                    <span className="text-[10px] bg-teal text-white rounded px-1.5 py-0.2 font-bold">
                                      YOUR VOTE
                                    </span>
                                  )}
                                </div>

                                {(poll.has_voted || isClosed) && (
                                  <span className="text-xs font-mono font-bold text-navy">
                                    {opt.vote_count} ({percent}%)
                                  </span>
                                )}
                              </label>

                              {/* Progress bar once voted or closed */}
                              {(poll.has_voted || isClosed) && (
                                <div className="h-1.5 w-full bg-soft rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-teal transition-all duration-500 rounded-full"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Cast Vote Action Button */}
                      {!poll.has_voted && !isClosed && (
                        <div className="pt-2">
                          <button
                            type="button"
                            disabled={!selectedPollOption[poll.id] || isSubmittingVote[poll.id]}
                            onClick={() => handleVoteSubmit(poll.id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal text-white py-2 px-4 text-xs font-semibold hover:bg-teal/90 transition shadow-sm disabled:opacity-50"
                          >
                            <Icon n="check" s={14} />
                            <span>{isSubmittingVote[poll.id] ? 'Submitting...' : 'Cast Vote'}</span>
                          </button>
                        </div>
                      )}

                      {poll.has_voted && (
                        <div className="text-[11px] text-teal font-medium text-center">
                          ✓ Your vote is recorded for this poll.
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: EMERGENCY CONTACTS                                          */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'emergency' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-navy">Important & Emergency Contacts</h3>
              <p className="text-xs text-muted-foreground">
                Verified helpline and maintenance numbers configured for your housing society.
              </p>
            </div>

            {isLoadingContacts && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-xl border border-bd bg-card p-4 animate-pulse space-y-2">
                    <div className="h-4 bg-soft rounded w-1/2" />
                    <div className="h-5 bg-soft rounded w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {!isLoadingContacts && emergencyContacts.length === 0 && (
              <Card className="p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-soft text-navy/40">
                  <Icon n="alert" s={22} />
                </div>
                <h4 className="mt-2 text-sm font-bold text-navy">No emergency contacts listed</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  The society administrator has not yet populated emergency contacts.
                </p>
              </Card>
            )}

            {!isLoadingContacts && emergencyContacts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {emergencyContacts.map((contact) => (
                  <Card key={contact.id} className="p-4 flex flex-col justify-between gap-3 hover:border-teal transition">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-navy truncate">{contact.title}</h4>
                        <span className="text-[10px] font-bold text-teal bg-teal/10 px-2 py-0.5 rounded border border-teal/20">
                          {contact.available_hours || '24/7'}
                        </span>
                      </div>

                      {contact.contact_person && (
                        <p className="text-xs text-muted-foreground">
                          Contact: <strong className="text-navy">{contact.contact_person}</strong>
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-bd/60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-navy tracking-wider">
                          {contact.phone_number}
                        </span>
                        <a
                          href={`tel:${contact.phone_number}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal text-white px-3 py-1 text-xs font-semibold hover:bg-teal/90 transition shadow-sm"
                        >
                          <span>Call</span>
                        </a>
                      </div>

                      {contact.alternative_phone && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-bd/40">
                          <span>Alt: {contact.alternative_phone}</span>
                          <a
                            href={`tel:${contact.alternative_phone}`}
                            className="text-teal font-semibold hover:underline"
                          >
                            Call Alt
                          </a>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: Confirm Resolution & Rating                                */}
      {/* ==================================================================== */}
      {verifyingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-bd bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-bd/60 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-navy">Confirm Resolution & Feedback</h3>
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
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Rate the Repair Work (1 to 5 Stars) *
                </label>
                <div className="flex items-center gap-1">
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

      {/* ==================================================================== */}
      {/* MODAL 2: Issue Persists / Request Reopen                            */}
      {/* ==================================================================== */}
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
