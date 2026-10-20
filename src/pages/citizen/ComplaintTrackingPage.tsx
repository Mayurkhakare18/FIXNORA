// ==============================================================================
// SmartResolve Citizen: Live Complaint Tracking
// Real PostgreSQL tracking ID lookup, status history timeline, public comments, and evidence
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn, Pill, Row, STAGES } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import {
  lookupComplaintByTrackingId,
  createAttachmentSignedUrl,
  type ComplaintWithRelations,
} from '../../lib/complaintService';
import { isSupabaseConfigured } from '../../lib/supabase';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const ComplaintTrackingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const idFromUrl = searchParams.get('id') || '';
  const [searchInput, setSearchInput] = useState(idFromUrl);
  const [activeTrackingId, setActiveTrackingId] = useState(idFromUrl);

  const [isLoading, setIsLoading] = useState(false);
  const [complaint, setComplaint] = useState<ComplaintWithRelations | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  useEffect(() => {
    if (idFromUrl) {
      setSearchInput(idFromUrl);
      setActiveTrackingId(idFromUrl);
      fetchComplaint(idFromUrl);
    }
  }, [idFromUrl]);

  const fetchComplaint = async (trackingId: string) => {
    if (!trackingId.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const result = await lookupComplaintByTrackingId(trackingId.trim());
      setComplaint(result);
    } catch (err) {
      console.error('Error querying complaint tracking ID:', err);
      setComplaint(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim();
    if (clean) {
      setSearchParams({ id: clean });
      setActiveTrackingId(clean);
      fetchComplaint(clean);
    }
  };

  const handleOpenAttachment = async (filePath: string, fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const signedUrl = await createAttachmentSignedUrl(filePath, 3600);
      if (signedUrl) {
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('Could not generate secure access link for this file.');
      }
    } catch (err) {
      console.error('Error opening attachment:', err);
      alert('Failed to retrieve file.');
    } finally {
      setDownloadingFile(null);
    }
  };

  // Map status to 4-stage visual progress
  const getStageIndex = (status: string): number => {
    switch (status) {
      case 'submitted':
        return 0;
      case 'under_review':
      case 'assigned':
        return 1;
      case 'in_progress':
      case 'awaiting_citizen_response':
      case 'reopened':
        return 2;
      case 'resolved':
      case 'closed':
        return 3;
      case 'rejected':
        return 0;
      default:
        return 0;
    }
  };

  const getStatusPillTone = (status: string): 'n' | 'h' | 't' | 'w' => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 't';
      case 'in_progress':
      case 'assigned':
        return 'n';
      case 'rejected':
        return 'h';
      default:
        return 'w';
    }
  };

  return (
    <DashboardLayout
      roleTitle="Track Complaint"
      roleBadge="Resident"
      navItems={CITIZEN_NAV}
    >
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-navy">Live Complaint Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enter your unique Tracking ID to inspect real-time milestones, status history, and official responses.
          </p>
        </div>

        {/* Configuration banner */}
        {!isSupabaseConfigured && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
            <strong>Configuration Notice:</strong> Supabase credentials are not configured in <code className="font-mono">.env</code>. Real database lookups will be unavailable until credentials are provided.
          </div>
        )}

        {/* Tracking ID Search Box */}
        <Card className="p-4 shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Enter Tracking ID (e.g. SR-2026-1001)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-bd bg-card px-4 py-2.5 text-sm font-mono text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>
            <Btn type="submit" v="p" disabled={isLoading} className="px-6">
              <Icon n="search" s={16} />
              <span>{isLoading ? 'Searching...' : 'Lookup'}</span>
            </Btn>
          </form>
        </Card>

        {/* Loading Spinner */}
        {isLoading && (
          <Card className="p-12 text-center">
            <Icon n="refresh-cw" s={32} c="animate-spin mx-auto text-teal mb-3" />
            <p className="text-sm font-semibold text-navy">Querying society register...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Looking up Tracking ID <code className="font-mono text-teal">{activeTrackingId}</code>
            </p>
          </Card>
        )}

        {/* Found Complaint View */}
        {!isLoading && complaint && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bd/60 pb-4">
                <div>
                  <div className="text-xs font-semibold text-teal uppercase tracking-wider font-mono">
                    Tracking ID: {complaint.tracking_id}
                  </div>
                  <h2 className="text-xl font-bold text-navy mt-1">
                    {complaint.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Priority: <strong className="text-navy">{complaint.priority}</strong>
                  </span>
                  <Pill tone={getStatusPillTone(complaint.status)}>
                    {complaint.status.replace(/_/g, ' ').toUpperCase()}
                  </Pill>
                </div>
              </div>

              {/* 4-Stage Visual Progress Bar */}
              <div className="my-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-navy mb-3">
                  Resolution Progress
                </h3>
                <ol className="my-5 flex w-full">
                  {STAGES.map((stage, k) => {
                    const currentIndex = getStageIndex(complaint.status);
                    const isDone = k < currentIndex;
                    const isCurrent = k === currentIndex;
                    return (
                      <li key={stage} className="relative flex-1 text-center text-xs">
                        {k > 0 && (
                          <span
                            className={`absolute left-[-50%] top-3 h-[3px] w-full transition-colors duration-300 ${
                              k <= currentIndex ? "bg-teal" : "bg-bd"
                            }`}
                          />
                        )}
                        <div className="relative z-10 w-full">
                          <span
                            className={`mx-auto mb-1.5 grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] font-bold transition-all duration-300 ${
                              isDone ? "border-teal bg-teal text-white" : ""
                            } ${
                              isCurrent
                                ? "border-teal bg-card text-teal ring-4 ring-teal/20 scale-110"
                                : ""
                            } ${
                              !isDone && !isCurrent
                                ? "border-bd bg-card text-muted-foreground"
                                : ""
                            }`}
                          >
                            {isDone ? '✓' : k + 1}
                          </span>
                          <span
                            className={`block text-xs ${
                              isCurrent ? "font-semibold text-navy" : "text-muted-foreground"
                            }`}
                          >
                            {stage}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Complaint Details */}
              <div className="border-t border-bd/60 pt-4 space-y-1">
                <Row a="Category" b={complaint.category?.name || 'Standard Category'} />
                <Row
                  a="Location"
                  b={
                    [
                      complaint.building?.name,
                      complaint.flat?.flat_number ? `Flat ${complaint.flat.flat_number}` : null,
                      complaint.location_details,
                    ]
                      .filter(Boolean)
                      .join(' • ') || 'Society Premises'
                  }
                />
                <Row
                  a="Date Submitted"
                  b={new Date(complaint.submitted_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
                {complaint.resolved_at && (
                  <Row
                    a="Resolved At"
                    b={new Date(complaint.resolved_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                )}
                {complaint.resolution_remarks && (
                  <Row a="Resolution Notes" b={complaint.resolution_remarks} />
                )}
              </div>

              {/* Description */}
              <div className="mt-5 border-t border-bd/60 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Citizen Description
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-soft/50 p-3 rounded-lg border border-bd/60">
                  {complaint.description}
                </p>
              </div>

              {/* Attached Evidence Files */}
              {complaint.attachments && complaint.attachments.length > 0 && (
                <div className="mt-5 border-t border-bd/60 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-navy mb-2">
                    Evidence Attachments ({complaint.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {complaint.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between rounded-lg border border-bd bg-soft/40 p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon n="paperclip" s={14} c="text-teal shrink-0" />
                          <span className="truncate font-medium text-navy">{att.file_name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            ({(att.file_size_bytes / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={downloadingFile === att.file_name}
                          onClick={() => handleOpenAttachment(att.file_path, att.file_name)}
                          className="ml-2 inline-flex items-center gap-1 rounded bg-teal/10 px-2 py-1 text-[11px] font-semibold text-teal hover:bg-teal/20 transition disabled:opacity-50"
                        >
                          <Icon n="download" s={12} />
                          <span>{downloadingFile === att.file_name ? 'Opening...' : 'View'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Official Status History Timeline */}
            <Card className="p-6">
              <h3 className="text-sm font-bold text-navy mb-4 border-b border-bd/60 pb-3 flex items-center justify-between">
                <span>Official Status History (Audit Trail)</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Immutable records
                </span>
              </h3>

              {complaint.history && complaint.history.length > 0 ? (
                <div className="space-y-4">
                  {complaint.history.map((h, idx) => (
                    <div key={h.id || idx} className="flex items-start gap-3 text-xs">
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-soft text-teal font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 rounded-lg border border-bd/60 bg-soft/30 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-navy capitalize">
                            Status: {h.new_status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(h.changed_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {h.remarks && (
                          <p className="mt-1.5 text-muted-foreground leading-relaxed">
                            {h.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  No subsequent status transitions recorded yet. Initial submission recorded.
                </p>
              )}
            </Card>

            {/* Public Updates & Department Comments */}
            {complaint.comments && complaint.comments.length > 0 && (
              <Card className="p-6">
                <h3 className="text-sm font-bold text-navy mb-4 border-b border-bd/60 pb-3">
                  Public Updates & Official Notes
                </h3>
                <div className="space-y-3">
                  {complaint.comments.map((comm) => (
                    <div
                      key={comm.id}
                      className="rounded-lg border border-bd/60 bg-soft/40 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold text-navy">Society Bulletin Update</span>
                        <span>{new Date(comm.created_at).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-navy leading-relaxed">{comm.comment_text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Consistent Not Found State without Information Disclosure */}
        {!isLoading && hasSearched && !complaint && (
          <Card className="p-8 text-center max-w-md mx-auto space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand shadow-sm">
              <Icon n="alert" s={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy">No Complaint Record Found</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                No complaint matching Tracking ID <code className="font-mono text-navy font-bold">{activeTrackingId}</code> was found in your active society register.
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                Please verify the ID format (e.g. <span className="font-mono">SR-2026-1001</span>) or confirm that your account has active membership in the corresponding housing society.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link to="/dashboard/citizen">
                <Btn className="text-xs px-4">
                  View My Complaints
                </Btn>
              </Link>
              <Link to="/complaints/new">
                <Btn v="p" className="text-xs px-4">
                  Submit New Complaint
                </Btn>
              </Link>
            </div>
          </Card>
        )}

        {/* Initial Empty State before any search */}
        {!isLoading && !hasSearched && (
          <Card className="p-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand mb-4">
              <Icon n="search" s={28} />
            </div>
            <h3 className="text-base font-bold text-navy">No Tracking ID entered</h3>
            <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Enter your complaint's tracking ID above to see its stage, assigned department, SLA deadline, status transitions, and supporting evidence.
            </p>
            <div className="mt-6">
              <Link to="/complaints/new">
                <Btn v="p" className="text-xs">
                  Submit a New Complaint
                </Btn>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};
