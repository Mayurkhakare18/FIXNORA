import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
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
  const location = useLocation();

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
              <span>SmartResolve</span>
            </Link>
            <span className="text-muted-foreground/60">/</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy">{roleTitle}</span>
              <Pill tone="t">{roleBadge}</Pill>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
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

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-bd bg-card px-3 py-1.5 text-xs font-medium text-navy hover:bg-soft transition"
            >
              <Icon n="log-out" s={14} />
              <span>Exit Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 mx-auto w-full max-w-7xl px-5 py-6 flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="glass rounded-xl border border-white/70 p-4 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-2">
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

            <div className="my-4 border-t border-bd/60" />

            <div className="px-2">
              <div className="rounded-lg border border-teal/30 bg-soft p-3 text-xs text-navy">
                <span className="font-semibold block mb-1">Phase 1 Architecture</span>
                <span className="text-muted-foreground">
                  UI views are connected to client routing. Database persistence & auth will connect in Phases 2–4.
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
