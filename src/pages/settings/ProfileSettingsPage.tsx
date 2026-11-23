import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card, Btn } from '../../components/ui/Primitives';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Language } from '../../i18n/translations';

export const ProfileSettingsPage: React.FC = () => {
  const { lang, setLang, toast } = useApp();
  const { user, profile, currentMembership } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || 'Resident User');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);

  const overviewHref = currentMembership?.role === 'society_admin'
    ? '/dashboard/admin'
    : currentMembership?.role === 'maintenance_staff'
    ? '/dashboard/officer'
    : currentMembership?.role === 'supervisor'
    ? '/dashboard/department'
    : '/dashboard/citizen';

  const settingsNav = [
    { label: "Overview", href: overviewHref, icon: "file" as const },
    ...(currentMembership?.role === 'society_admin'
      ? [
          { label: "Billing & Plans", href: "/admin/billing", icon: "file" as const },
          { label: "Revenue Analytics", href: "/admin/revenue", icon: "chart" as const },
        ]
      : [
          { label: "Report Issue", href: "/complaints/new", icon: "upload" as const },
        ]),
    { label: "Track by ID", href: "/track", icon: "search" as const },
    { label: "Settings", href: "/settings/profile", icon: "user" as const },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast("Settings updated locally. Profile updates will persist to Supabase profiles table in Phase 3.");
  };

  return (
    <DashboardLayout
      roleTitle="Account Settings"
      roleBadge="Profile"
      navItems={settingsNav}
    >
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Profile & Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your personal profile and update notification preferences
          </p>
        </div>

        <Card className="p-6 shadow-sm">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                  Preferred Language
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Language)}
                  className="w-full rounded-lg border border-bd bg-card px-3.5 py-2.5 text-sm text-navy focus:border-teal focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="mr">मराठी (Marathi)</option>
                </select>
              </div>
            </div>

            <div className="border-t border-bd/60 pt-4">
              <h3 className="text-sm font-bold text-navy mb-3">Notification Channels</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="rounded border-bd text-teal focus:ring-teal"
                  />
                  <span className="text-xs text-navy font-medium">
                    Receive email notifications on complaint status milestones (Registration, Assignment, Resolution)
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifySms}
                    onChange={(e) => setNotifySms(e.target.checked)}
                    className="rounded border-bd text-teal focus:ring-teal"
                  />
                  <span className="text-xs text-navy font-medium">
                    Receive SMS alerts (Optional provider integration in Phase 8)
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Btn type="submit" v="p" className="px-6">
                Save Preferences
              </Btn>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
};
