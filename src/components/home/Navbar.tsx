import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../ui/Icon';
import { Btn, cn } from '../ui/Primitives';
import { Language } from '../../i18n/translations';

export const Navbar: React.FC = () => {
  const { lang, setLang, t } = useApp();
  const { user, currentMembership, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks: [string, Parameters<typeof t>[0]][] = [
    ["#home", "nh"],
    ["#features", "nf"],
    ["#how", "nw"],
    ["#residents", "nr"],
    ["#admins", "na"],
    ["#pricing", "np"],
  ];

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    if (href.startsWith('#')) {
      const el = document.getElementById(href.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate('/' + href);
      }
    }
  };

  return (
    <nav className="glass sticky top-0 z-30 border-b border-white/60">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-4 px-5">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-navy">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#263B52] text-white shadow-sm">
            <Icon n="check" s={16} />
          </span>
          <span>SmartResolve</span>
        </Link>

        {/* Desktop Anchor Navigation */}
        <div
          className={cn(
            "lg:ml-auto lg:flex lg:gap-1",
            mobileMenuOpen
              ? "menu-in absolute left-0 right-0 top-[60px] flex flex-col border-b border-bd px-5 py-3 shadow-lg"
              : "hidden"
          )}
        >
          {navLinks.map(([href, key]) => (
            <a
              key={key}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(href);
              }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-soft hover:text-navy"
            >
              {t(key)}
            </a>
          ))}
          <div className="my-2 border-t border-bd/60 lg:hidden" />
          {user ? (
            <>
              {currentMembership?.role === 'society_admin' && (
                <>
                  <Link
                    to="/dashboard/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-bold text-teal hover:bg-teal/10 lg:hidden"
                  >
                    Admin Portal
                  </Link>
                  <Link
                    to="/admin/billing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-navy hover:bg-soft lg:hidden"
                  >
                    Billing & Subscriptions
                  </Link>
                  <Link
                    to="/admin/revenue"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-navy hover:bg-soft lg:hidden"
                  >
                    Revenue Analytics
                  </Link>
                </>
              )}
              <Link
                to="/dashboard/citizen"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-navy hover:bg-soft lg:hidden"
              >
                Resident View
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/dashboard/citizen"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-teal hover:bg-teal/10 lg:hidden"
              >
                Citizen Portal
              </Link>
              <Link
                to="/dashboard/officer"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-navy hover:bg-soft lg:hidden"
              >
                Officer Portal
              </Link>
              <Link
                to="/dashboard/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-navy hover:bg-soft lg:hidden"
              >
                Admin Portal
              </Link>
            </>
          )}
        </div>

        {/* Language Selector & Auth Buttons */}
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="rounded-lg border border-bd bg-card px-2.5 py-1.5 text-xs font-semibold text-navy shadow-sm focus:border-teal focus:outline-none"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="mr">मराठी</option>
          </select>

          {user ? (
            <div className="hidden sm:inline-flex items-center gap-2">
              {currentMembership?.role === 'society_admin' && (
                <Link to="/admin/billing">
                  <Btn v="secondary" className="py-2 text-xs">
                    Billing & Plans
                  </Btn>
                </Link>
              )}
              <Link to={
                currentMembership?.role === 'society_admin'
                  ? '/dashboard/admin'
                  : currentMembership?.role === 'maintenance_staff'
                  ? '/dashboard/officer'
                  : currentMembership?.role === 'supervisor'
                  ? '/dashboard/department'
                  : '/dashboard/citizen'
              }>
                <Btn v="p" className="py-2 text-xs">
                  {currentMembership?.role === 'society_admin'
                    ? 'Admin Portal'
                    : currentMembership?.role === 'maintenance_staff'
                    ? 'Staff Queue'
                    : currentMembership?.role === 'supervisor'
                    ? 'Department Portal'
                    : 'Resident Portal'}
                </Btn>
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-lg border border-bd bg-card px-2.5 py-1.5 text-xs font-medium text-navy hover:bg-soft transition"
                title="Sign Out"
              >
                <Icon n="log-out" s={14} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/auth/login" className="hidden sm:inline-flex">
                <Btn className="py-2 text-xs">{t("lg")}</Btn>
              </Link>
              <Link to="/auth/register" className="hidden sm:inline-flex">
                <Btn v="p" className="py-2 text-xs">
                  {t("gs")}
                </Btn>
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="rounded-lg border border-bd p-2 text-navy hover:bg-soft focus:outline-none lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Icon n={mobileMenuOpen ? "x" : "menu"} />
          </button>
        </div>
      </div>
    </nav>
  );
};
