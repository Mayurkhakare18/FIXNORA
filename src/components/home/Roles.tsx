import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Head, Card, Reveal, cn } from '../ui/Primitives';
import { Icon, IconName } from '../ui/Icon';

interface RoleScope {
  icon: IconName;
  name: string;
  summary: string;
  capabilities: string[];
}

const ROLES: RoleScope[] = [
  {
    icon: "user",
    name: "Resident",
    summary: "Reports and follows their own complaints with transparent status visibility.",
    capabilities: [
      "Submit structured complaints with media attachments",
      "View own complaints and permitted official updates",
      "Live tracking timeline and resolution progress",
      "Rate completed resolutions and request appeals",
    ],
  },
  {
    icon: "users",
    name: "Staff / Officer",
    summary: "Investigates, services, and resolves complaints assigned to their department.",
    capabilities: [
      "Assigned complaint queue filtered by department",
      "Post status updates with mandatory remarks",
      "Separate internal officer notes from citizen-visible updates",
      "Submit resolution evidence and mark cases completed",
    ],
  },
  {
    icon: "shield",
    name: "Administrator / Manager",
    summary: "Oversees department operations, escalations, SLAs, and governance.",
    capabilities: [
      "Department and user role authorization oversight",
      "Assign staff, monitor deadlines, and enforce SLA rules",
      "Monitor overdue escalations and automated alerts",
      "Inspect immutable system audit logs and trend reports",
    ],
  },
];

export const Roles: React.FC = () => {
  const { t } = useApp();
  const [selectedRole, setSelectedRole] = useState(0);
  const currentRole = ROLES[selectedRole];

  return (
    <section id="residents" className="glass-band py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Head
          eyebrow="Access"
          h={t("ph")}
          sub="Role-based access is strictly enforced server-side using Supabase PostgreSQL Row Level Security (RLS) in Phase 2."
        />

        <Reveal>
          {/* Role Tabs */}
          <div
            role="tablist"
            aria-label="Platform roles"
            className="chips mb-4 inline-flex max-w-full overflow-x-auto rounded-lg bg-soft p-1 shadow-inner"
          >
            {ROLES.map((r, i) => (
              <button
                key={r.name}
                role="tab"
                aria-selected={i === selectedRole}
                onClick={() => setSelectedRole(i)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition sm:px-4 focus:outline-none",
                  i === selectedRole
                    ? "bg-card text-navy shadow-sm"
                    : "text-muted-foreground hover:text-navy"
                )}
              >
                <Icon n={r.icon} s={15} />
                <span>{r.name}</span>
              </button>
            ))}
          </div>

          {/* Active Role Panel */}
          <Card role="tabpanel" className="grid gap-6 p-6 md:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-[#263B52] text-white shadow-md">
                <Icon n={currentRole.icon} />
              </div>
              <h3 className="text-xl font-bold text-navy">{currentRole.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {currentRole.summary}
              </p>
            </div>

            <ul className="space-y-2.5">
              {currentRole.capabilities.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 rounded-lg border border-white/70 bg-white/50 px-3.5 py-2.5 text-sm font-medium text-navy shadow-sm"
                >
                  <Icon n="check" s={16} c="mt-0.5 shrink-0 text-teal" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        {/* Security Notice */}
        <Reveal className="mt-5">
          <Card className="border-l-[3px] border-l-teal bg-soft">
            <h3 className="flex items-center gap-2 font-semibold text-navy">
              <Icon n="lock" c="text-teal" />
              Anonymous reporting & restricted visibility
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Sensitive complaints can be submitted anonymously where permitted. Complaints should only be visible to the resident and authorized department officers. Frontend UI alone does not enforce security; verified server context governs every transaction.
            </p>
          </Card>
        </Reveal>
      </div>
    </section>
  );
};
