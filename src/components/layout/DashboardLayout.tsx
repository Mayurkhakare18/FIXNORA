// ==============================================================================
// SmartResolve Dashboard Layout
// Glassmorphism authenticated layout with multi-society switcher and session management
// ==============================================================================

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Icon, IconName } from '../ui/Icon';
import { Pill, cn } from '../ui/Primitives';
import { Language } from '../../i18n/translations';

interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

interface DashboardLayoutProps {
  roleTitle: string;
  roleBadge: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  roleTitle,
  roleBadge,
  navItems,
  children,
}) => {
  const { lang, setLang } = useApp();
  const { user, profile, currentSociety, currentMembership, societies, selectSociety, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Glass Bar */}
      <header className="glass sticky top-0 z-40 border-b border-white/60">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
          {/* Logo & Portal Identity */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-base font-bold text-navy">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[#263B52] text-white">
                <Icon n="check" s={16} />
              </span>
              <span className="hidden sm:inline">SmartResolve</span>
            </Link>
            <span className="text-muted-foreground/60 hidden sm:inline">/</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy">{roleTitle}</span>
              <Pill tone="t">{roleBadge}</Pill>
            </div>
          </div>

          {/* Active Society Context & Switcher */}
          {societies.length > 1 && (
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Society:</span>
              <select
                value={currentSociety?.id || ''}
                onChange={(e) => selectSociety(e.target.value)}
                className="rounded-lg border border-bd bg-card px-2.5 py-1 text-xs font-semibold text-navy focus:border-teal focus:outline-none"
              >
                {societies.map((soc) => (
                  <option key={soc.id} value={soc.id}>
                    {soc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <select
              aria-label="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="rounded-lg border border-bd bg-card px-2 py-1 text-xs font-semibold text-navy focus:outline-none"
            >
              <option value="en">EN</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>

            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-card px-3 py-1.5 text-xs font-medium text-navy hover:bg-soft transition"
              title="Sign Out of Portal"
            >
              <Icon n="log-out" s={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 mx-auto w-full max-w-7xl px-5 py-6 flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="glass rounded-xl border border-white/70 p-4 shadow-sm space-y-4">
            {/* User Profile Badge */}
            <div className="rounded-lg bg-soft p-3 border border-bd">
              <div className="text-xs font-bold text-navy truncate">
                {profile?.full_name || user?.email?.split('@')[0] || 'User Profile'}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {user?.email || 'authenticated'}
              </div>
              {currentMembership && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Pill tone="t">
                    {currentMembership.staff_designation || currentMembership.role}
                  </Pill>
                </div>
              )}
              {currentSociety && (
                <div className="mt-2 pt-2 border-t border-bd/60 text-[11px] text-teal font-semibold flex items-center gap-1">
                  <Icon n="shield" s={12} />
                  <span className="truncate">{currentSociety.name}</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                Menu Navigation
              </h4>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                        isActive
                          ? "bg-[#263B52] text-white shadow-sm"
                          : "text-muted-foreground hover:bg-soft hover:text-navy"
                      )}
                    >
                      <Icon n={item.icon} s={16} c={isActive ? "text-teal" : ""} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-2 border-t border-bd/60">
              <div className="rounded-lg border border-teal/30 bg-soft p-3 text-xs text-navy">
                <span className="font-semibold block mb-1 text-[11px]">Phase 3 Security Status</span>
                <span className="text-[11px] text-muted-foreground leading-normal block">
                  Session managed via Supabase Auth. Data bounded strictly to authorized society scope.
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Page Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
};
