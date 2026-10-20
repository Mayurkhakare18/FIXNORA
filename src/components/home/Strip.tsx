import React from 'react';
import { Icon } from '../ui/Icon';

export const Strip: React.FC = () => {
  const highlights = [
    "Easy Issue Reporting",
    "Clear Ownership",
    "Trackable Progress",
    "Community-Focused Resolution",
    "English • हिन्दी • मराठी",
    "Anonymous Reporting",
    "Staff Assignment",
    "Preventive Maintenance"
  ];

  const renderRow = () =>
    highlights.map((item) => (
      <span key={item} className="mx-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon n="check" s={14} c="text-teal" />
        {item}
      </span>
    ));

  return (
    <div className="overflow-hidden glass-band py-4" aria-label="Product highlights">
      <div className="flex w-max animate-[cta69-marquee_45s_linear_infinite] whitespace-nowrap">
        {[0, 1].map((idx) => (
          <div key={idx} className="flex" aria-hidden={idx === 1}>
            {renderRow()}
            {renderRow()}
          </div>
        ))}
      </div>
    </div>
  );
};
