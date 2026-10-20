import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn, Note } from '../../components/ui/Primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp } from '../../context/AppContext';

const CITIZEN_NAV = [
  { label: "My Complaints", href: "/dashboard/citizen", icon: "file" as const },
  { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
  { label: "Track by ID", href: "/track", icon: "search" as const },
  { label: "Settings", href: "/settings/profile", icon: "user" as const },
];

export const NewComplaintPage: React.FC = () => {
  const { toast } = useApp();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('electrical');
  const [subcategory, setSubcategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast("Notice: Complaint submission API and Supabase Storage will be connected in Phase 4 & Phase 8.");
    setTimeout(() => {
      navigate('/dashboard/citizen');
    }, 1500);
  };

  return (
    <DashboardLayout
      roleTitle="Resident Portal"
      roleBadge="Resident"
      navItems={CITIZEN_NAV}
    >
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Submit a Complaint</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fill in the details below. Required fields are marked with an asterisk (*).
          </p>
        </div>

        {/* Integration notice */}
        <Note icon="lock">
          Phase 1 Architecture: Forms and validation schemas are staged. Full persistence to Supabase and automated tracking ID generation will activate in Phase 4.
        </Note>

        <Card className="p-6 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                Complaint Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Streetlight flickering near Community Center"
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
                >
                  <option value="electrical">Electrical & Lighting</option>
                  <option value="water">Water Supply & Drainage</option>
                  <option value="roads">Roads & Potholes</option>
                  <option value="waste">Waste Management & Sanitation</option>
                  <option value="security">Security & Public Safety</option>
                  <option value="public_works">General Public Works</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Subcategory
                </label>
                <input
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="e.g. Broken pole / Damaged fixture"
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                />
              </div>
            </div>

            {/* Priority & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Estimated Priority *
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
                >
                  <option value="low">Low (Cosmetic / Non-disruptive)</option>
                  <option value="medium">Medium (Standard service request)</option>
                  <option value="high">High (Urgent disruption)</option>
                  <option value="urgent">Critical (Hazardous / Immediate danger)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Location / Address *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Block B, Community Road near Gate 2"
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                Detailed Description *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide complete details including when the issue started, landmarks, and recurring patterns..."
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy placeholder:text-muted-foreground/50 focus:border-teal focus:outline-none"
              />
            </div>

            {/* File Upload Zone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                Supporting Evidence (Photos, PDFs, Audio)
              </label>
              <div className="rounded-xl border-2 border-dashed border-bd/80 bg-soft/40 p-6 text-center hover:border-teal/50 transition">
                <Icon n="upload" s={24} c="mx-auto text-brand mb-2" />
                <p className="text-xs font-medium text-navy">
                  Click to select files or drag and drop
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  JPG, PNG, PDF up to 10MB per file (Stored in Supabase Private Bucket)
                </p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="mt-3 block mx-auto text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#263B52] file:text-white hover:file:bg-[#34506b]"
                />
                {files.length > 0 && (
                  <div className="mt-3 text-xs text-teal font-medium">
                    {files.length} file(s) selected: {files.map((f) => f.name).join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-start gap-3 rounded-lg border border-bd bg-soft/40 p-3.5">
              <input
                type="checkbox"
                id="anonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="mt-0.5 rounded border-bd text-teal focus:ring-teal"
              />
              <label htmlFor="anonymous" className="text-xs text-navy">
                <span className="font-semibold block">Submit as Anonymous Complaint</span>
                <span className="text-muted-foreground">
                  Your identity will not be visible to department officers or public records.
                </span>
              </label>
            </div>

            {/* Submit Actions */}
            <div className="pt-2 flex justify-end gap-3">
              <Btn type="button" onClick={() => navigate('/dashboard/citizen')}>
                Cancel
              </Btn>
              <Btn type="submit" v="p" className="px-6">
                Submit Complaint
              </Btn>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
};
