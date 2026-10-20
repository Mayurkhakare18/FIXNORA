import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Language } from '../../i18n/translations';

export const Footer: React.FC = () => {
  const { setLang, toast } = useApp();

  return (
    <footer className="px-5 pb-8 pt-12 border-t border-bd/40">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        {/* Brand Summary */}
        <div>
          <b className="text-lg font-bold text-navy">SmartResolve</b>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
            A smarter, more transparent way to report issues, track progress, and improve our communities.
          </p>
          <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
            <Link to="/dashboard/citizen" className="hover:text-teal underline">Citizen Portal</Link>
            <span>•</span>
            <Link to="/dashboard/officer" className="hover:text-teal underline">Officer Portal</Link>
            <span>•</span>
            <Link to="/dashboard/admin" className="hover:text-teal underline">Admin Portal</Link>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-navy">
            Navigate
          </h4>
          <div className="space-y-1">
            <a href="#home" className="block py-0.5 text-sm text-muted-foreground hover:text-navy">
              Home
            </a>
            <a href="#how" className="block py-0.5 text-sm text-muted-foreground hover:text-navy">
              How It Works
            </a>
            <a href="#residents" className="block py-0.5 text-sm text-muted-foreground hover:text-navy">
              For Residents
            </a>
            <a href="#admins" className="block py-0.5 text-sm text-muted-foreground hover:text-navy">
              For Administrators
            </a>
          </div>
        </div>

        {/* Features */}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-navy">
            Features
          </h4>
          <div className="space-y-1">
            <a href="#features" className="block py-0.5 text-sm text-muted-foreground hover:text-navy">
              Reporting
            </a>
            <a href="#track" className="block py-0.5 text-sm text-muted-foreground hover:text-navy">
              Timeline
            </a>
            <a href="#admins" className="block py-0.5 text-sm text-muted-foreground hover:text-navy">
              Analytics
            </a>
          </div>
        </div>

        {/* More & Languages */}
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-navy">
            More
          </h4>
          <div className="space-y-1">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast("Privacy Policy: Full compliance documentation configured in Phase 9.");
              }}
              className="block py-0.5 text-sm text-muted-foreground hover:text-navy"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                toast("Accessibility Statement: WCAG 2.1 AA certified UI tokens.");
              }}
              className="block py-0.5 text-sm text-muted-foreground hover:text-navy"
            >
              Accessibility
            </a>
            <div className="pt-2 flex flex-wrap gap-2">
              {[
                ["en", "English"],
                ["hi", "हिन्दी"],
                ["mr", "मराठी"],
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code as Language)}
                  className="rounded border border-bd px-2 py-0.5 text-xs text-muted-foreground hover:border-teal hover:text-teal"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-6xl text-[13px] text-muted-foreground flex flex-wrap justify-between items-center gap-2 border-t border-bd/40 pt-4">
        <span>© 2026 SmartResolve. Civic Complaint Resolution Platform.</span>
        <span className="text-xs">Phase 1: Frontend Migration & Layout Preservation</span>
      </div>
    </footer>
  );
};
