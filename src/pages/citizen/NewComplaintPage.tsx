// ==============================================================================
// SmartResolve Citizen: Report Issue / New Complaint
// Real Supabase PostgreSQL persistence, evidence upload to Storage, and tracking ID generation
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn, Pill } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchComplaintFormData,
  submitComplaint,
  uploadComplaintEvidence,
  validateEvidenceFile,
  type ComplaintFormData,
} from '../../lib/complaintService';
import type { PriorityLevel, Complaint } from '../../types/database';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const NewComplaintPage: React.FC = () => {
  const { user, currentSociety, currentMembership, societies, selectSociety } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<ComplaintFormData>({
    categories: [],
    buildings: [],
    flats: [],
  });

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFlatId, setSelectedFlatId] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);

  const isSubmittingRef = useRef(false);

  // Load categories, buildings, flats for current society
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentSociety?.id) {
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      setDataLoadError(null);

      try {
        const data = await fetchComplaintFormData(currentSociety.id);
        if (isMounted) {
          setFormData(data);
          if (data.categories.length > 0) {
            setSelectedCategoryId(data.categories[0].id);
            setPriority(data.categories[0].default_priority || 'medium');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setDataLoadError(err.message || 'Failed to load society complaint options.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentSociety?.id]);

  // When category changes, auto-set default priority if available
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = e.target.value;
    setSelectedCategoryId(catId);
    const matched = formData.categories.find((c) => c.id === catId);
    if (matched?.default_priority) {
      setPriority(matched.default_priority);
    }
  };

  // Filter flats by selected building
  const availableFlats = selectedBuildingId
    ? formData.flats.filter((f) => f.building_id === selectedBuildingId)
    : formData.flats;

  // File handling with validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const err = validateEvidenceFile(file);
      if (err) {
        errors.push(err);
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length > 0) {
      setSubmitError(errors.join(' | '));
    } else {
      setSubmitError(null);
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    // Reset file input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate clicks
    if (isSubmittingRef.current || isSubmitting) return;

    if (!user || !currentSociety) {
      setSubmitError('You must be logged in with an active society to submit a complaint.');
      return;
    }

    const matchedCategory = formData.categories.find((c) => c.id === selectedCategoryId);
    if (!matchedCategory) {
      setSubmitError('Please select a valid complaint category.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    try {
      // 1. Submit complaint record to PostgreSQL
      setUploadProgress('Persisting complaint record...');
      const createdComplaint = await submitComplaint({
        societyId: currentSociety.id,
        citizenId: user.id,
        categoryId: matchedCategory.id,
        departmentId: matchedCategory.department_id,
        title,
        description,
        priority,
        buildingId: selectedBuildingId || null,
        flatId: selectedFlatId || null,
        locationDetails: locationDetails || null,
        isAnonymous,
      });

      // 2. Upload supporting evidence files if any
      if (selectedFiles.length > 0) {
        setUploadProgress(`Uploading ${selectedFiles.length} evidence attachment(s)...`);
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadProgress(`Uploading evidence (${i + 1}/${selectedFiles.length}): ${file.name}...`);
          await uploadComplaintEvidence(
            currentSociety.id,
            createdComplaint.id,
            file,
            user.id
          );
        }
      }

      setSubmittedComplaint(createdComplaint);
    } catch (err: any) {
      console.error('Complaint submission error:', err);
      setSubmitError(err.message || 'An unexpected error occurred while submitting your complaint.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setUploadProgress(null);
    }
  };

  // If user does not have an active membership
  const isPendingResident = Boolean(currentMembership && currentMembership.status !== 'active');

  return (
    <DashboardLayout
      roleTitle="Resident Portal"
      roleBadge="Resident"
      navItems={CITIZEN_NAV}
    >
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Submit a Complaint</h1>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <span>Reporting for Society:</span>
            {societies.length > 1 ? (
              <div className="inline-flex items-center gap-1.5 bg-soft rounded-lg border border-teal/40 px-2.5 py-1 shadow-sm">
                <Icon n="shield" s={14} c="text-teal" />
                <select
                  value={currentSociety?.id || ''}
                  onChange={(e) => selectSociety(e.target.value)}
                  className="bg-transparent text-xs font-bold text-navy focus:outline-none cursor-pointer"
                >
                  {societies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <strong className="text-navy">{currentSociety?.name || 'Loading...'}</strong>
            )}
          </div>
        </div>

        {/* Environment / Configuration check */}
        {!isSupabaseConfigured && (
          <div className="rounded-xl border border-teal/40 bg-teal/5 p-4 text-xs text-navy shadow-xs flex items-start gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal text-white shrink-0 mt-0.5">
              <Icon n="shield" s={16} />
            </span>
            <div>
              <span className="font-bold text-navy block text-sm">Demo / Offline Mode Active</span>
              <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                You can submit, track, and test complaints right now. Complaints will be safely registered and tracked with unique tracking IDs (<code className="font-mono bg-white px-1 py-0.5 rounded border border-bd">SR-2026-XXXX</code>).
              </p>
            </div>
          </div>
        )}

        {/* Pending membership warning */}
        {isPendingResident && (
          <Card className="p-6 border-amber-300 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <Icon n="alert" s={20} c="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  Membership Approval Required
                </h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Your membership application for <strong>{currentSociety?.name}</strong> is currently pending administrator verification. You cannot submit complaints until your membership is approved.
                </p>
                <div className="mt-3">
                  <Link to="/onboarding/pending-status">
                    <Btn v="secondary" className="text-xs py-1.5">
                      Check Approval Status
                    </Btn>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Successful Submission View */}
        {submittedComplaint ? (
          <Card className="p-8 text-center space-y-5 shadow-lg border-teal/40">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-teal shadow-inner">
              <Icon n="check" s={32} />
            </div>

            <div>
              <Pill tone="t">Complaint Successfully Submitted</Pill>
              <h2 className="text-2xl font-bold text-navy mt-3">
                Tracking ID: <span className="font-mono text-teal">{submittedComplaint.tracking_id}</span>
              </h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-2 leading-relaxed">
                Your complaint has been permanently recorded in the society register. The assigned department and maintenance officers have been notified.
              </p>
            </div>

            <div className="rounded-xl border border-bd bg-soft/60 p-4 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title:</span>
                <span className="font-semibold text-navy">{submittedComplaint.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority:</span>
                <span className="font-semibold uppercase text-navy">{submittedComplaint.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold text-teal capitalize">{submittedComplaint.status}</span>
              </div>
              {selectedFiles.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attachments:</span>
                  <span className="font-semibold text-navy">{selectedFiles.length} file(s) saved</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Link to={`/track?id=${submittedComplaint.tracking_id}`}>
                <Btn v="p" className="px-5 text-xs">
                  <Icon n="search" s={14} />
                  <span>Track This Complaint</span>
                </Btn>
              </Link>
              <Btn
                type="button"
                onClick={() => {
                  setSubmittedComplaint(null);
                  setTitle('');
                  setDescription('');
                  setLocationDetails('');
                  setSelectedFiles([]);
                }}
                className="text-xs px-5"
              >
                Submit Another Issue
              </Btn>
              <Link to="/dashboard/citizen">
                <Btn className="text-xs px-5">
                  Back to Dashboard
                </Btn>
              </Link>
            </div>
          </Card>
        ) : (
          /* Complaint Form */
          <Card className="p-6 shadow-md">
            {submitError && (
              <div className="mb-5 rounded-lg bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 flex items-start gap-2">
                <Icon n="alert" s={16} c="shrink-0 mt-0.5 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            {dataLoadError && (
              <div className="mb-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                {dataLoadError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Complaint Title *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting || isPendingResident}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Streetlight flickering near Gate 2"
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none disabled:opacity-60"
                />
                <small className="block text-[11px] text-muted-foreground mt-1">
                  Brief summary of the issue (5–150 characters).
                </small>
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Category *
                  </label>
                  {isLoadingData ? (
                    <div className="h-10 rounded-lg bg-soft animate-pulse" />
                  ) : formData.categories.length > 0 ? (
                    <select
                      required
                      disabled={isSubmitting || isPendingResident}
                      value={selectedCategoryId}
                      onChange={handleCategoryChange}
                      className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none disabled:opacity-60"
                    >
                      {formData.categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.sla_hours}h SLA)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg border border-bd bg-soft p-2.5 text-xs text-muted-foreground">
                      No categories configured in society yet.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Estimated Priority *
                  </label>
                  <select
                    disabled={isSubmitting || isPendingResident}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none disabled:opacity-60"
                  >
                    <option value="low">Low (Non-disruptive / Cosmetic)</option>
                    <option value="medium">Medium (Standard facility issue)</option>
                    <option value="high">High (Urgent service interruption)</option>
                    <option value="urgent">Urgent (Safety risk / Immediate fault)</option>
                  </select>
                </div>
              </div>

              {/* Building & Flat Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Building / Wing (Optional)
                  </label>
                  <select
                    disabled={isSubmitting || isPendingResident}
                    value={selectedBuildingId}
                    onChange={(e) => {
                      setSelectedBuildingId(e.target.value);
                      setSelectedFlatId('');
                    }}
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Common Society Area / Not Specific</option>
                    {formData.buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Flat / Unit (Optional)
                  </label>
                  <select
                    disabled={isSubmitting || isPendingResident || !selectedBuildingId}
                    value={selectedFlatId}
                    onChange={(e) => setSelectedFlatId(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none disabled:opacity-60"
                  >
                    <option value="">None / External</option>
                    {availableFlats.map((f) => (
                      <option key={f.id} value={f.id}>
                        Flat {f.flat_number} (Floor {f.floor})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specific Location Landmark */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Location Details / Landmarks
                </label>
                <input
                  type="text"
                  disabled={isSubmitting || isPendingResident}
                  value={locationDetails}
                  onChange={(e) => setLocationDetails(e.target.value)}
                  placeholder="e.g. Basement 1 meter room, near staircase 3"
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none disabled:opacity-60"
                />
              </div>

              {/* Detailed Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  disabled={isSubmitting || isPendingResident}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem in detail: when it began, observable symptoms, and impact on residents..."
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none disabled:opacity-60"
                />
                <small className="block text-[11px] text-muted-foreground mt-1">
                  Minimum 15 characters.
                </small>
              </div>

              {/* File Upload Zone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Supporting Evidence (Photos, PDFs)
                </label>
                <div className="rounded-xl border-2 border-dashed border-bd/80 bg-soft/40 p-6 text-center hover:border-teal/50 transition">
                  <Icon n="upload" s={24} c="mx-auto text-brand mb-2" />
                  <p className="text-xs font-medium text-navy">
                    Click to select files or drag and drop
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    JPG, PNG, WebP, PDF up to 10MB per file (Stored in Supabase Private Bucket)
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    disabled={isSubmitting || isPendingResident}
                    onChange={handleFileChange}
                    className="mt-3 block mx-auto text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#263B52] file:text-white hover:file:bg-[#34506b] cursor-pointer"
                  />

                  {/* Selected files preview */}
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-1.5 text-left max-w-md mx-auto">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-navy mb-1">
                        Attached Files ({selectedFiles.length}):
                      </div>
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-md border border-bd bg-card px-3 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon n="paperclip" s={14} c="text-teal shrink-0" />
                            <span className="truncate text-navy font-medium">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="text-muted-foreground hover:text-red-600 ml-2"
                            title="Remove file"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Anonymous Toggle */}
              <div className="flex items-start gap-3 rounded-lg border border-bd bg-soft/40 p-3.5">
                <input
                  type="checkbox"
                  id="anonymous"
                  disabled={isSubmitting || isPendingResident}
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-0.5 rounded border-bd text-teal focus:ring-teal"
                />
                <label htmlFor="anonymous" className="text-xs text-navy cursor-pointer">
                  <span className="font-semibold block">Submit as Anonymous Complaint</span>
                  <span className="text-muted-foreground">
                    Your name and flat will not be visible on public society boards or to assigned technicians.
                  </span>
                </label>
              </div>

              {/* Upload progress indicator */}
              {uploadProgress && (
                <div className="rounded-lg bg-teal/10 p-3 text-xs text-teal font-medium border border-teal/20 flex items-center gap-2">
                  <Icon n="refresh-cw" s={14} c="animate-spin text-teal" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              {/* Submit Actions */}
              <div className="pt-2 flex justify-end gap-3">
                <Btn
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => navigate('/dashboard/citizen')}
                >
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  v="p"
                  disabled={isSubmitting || isPendingResident || formData.categories.length === 0}
                  className="px-6"
                >
                  {isSubmitting ? 'Recording Issue...' : 'Submit Complaint'}
                </Btn>
              </div>
            </form>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};
