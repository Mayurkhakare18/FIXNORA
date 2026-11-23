// ==============================================================================
// SmartResolve / Fixnora Pricing & Subscription Plans Component
// Public Landing Page: Hostel Plan (₹800/mo) & Society Plan (₹2000/mo)
// Monthly/Yearly toggle, feature comparison, GST notice, and FAQ accordion
// ==============================================================================

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Head, Card, Reveal, Btn } from '../ui/Primitives';
import { Icon } from '../ui/Icon';
import { SUBSCRIPTION_PLANS, computeGstBreakdown } from '../../lib/subscriptionService';

export const Pricing: React.FC = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const hostelPlan = SUBSCRIPTION_PLANS.hostel;
  const societyPlan = SUBSCRIPTION_PLANS.society;

  const hostelPrice = isYearly ? hostelPlan.yearlyPrice : hostelPlan.monthlyPrice;
  const societyPrice = isYearly ? societyPlan.yearlyPrice : societyPlan.monthlyPrice;

  const hostelGst = computeGstBreakdown(hostelPrice);
  const societyGst = computeGstBreakdown(societyPrice);

  const faqs = [
    {
      q: 'How does automated recurring billing work?',
      a: 'Recurring subscriptions are processed automatically via RBI-compliant UPI AutoPay (Google Pay, PhonePe, Paytm) or Card e-mandates. You will receive an alert prior to each renewal, and no manual transfer is required.',
    },
    {
      q: 'Will our housing society or hostel receive a legal GST tax invoice?',
      a: 'Yes! Instant computer-generated Indian GST tax invoices (under SAC Code 998314 - IT Software SaaS) with complete 9% CGST + 9% SGST breakdown, QR code validation, and society details are generated and available for download as PDF directly in your admin billing dashboard.',
    },
    {
      q: 'What happens if our automated renewal payment fails?',
      a: 'SmartResolve provides an automatic 7-day grace period. Society residents, wardens, and admins maintain full uninterrupted system access while the treasurer or committee updates payment details or retries the payment.',
    },
    {
      q: 'Can we switch between Hostel Plan and Society Plan or cancel anytime?',
      a: 'Yes, you can upgrade, downgrade, or pause recurring mandates at any time directly from the Administrative Console without any cancellation fees or lock-in contracts.',
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-28 relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5">
        <Head
          eyebrow="Subscription Plans"
          h="Predictable & Transparent Pricing for Modern Communities"
          sub="Empowering student hostels, PGs, and residential housing societies with automated complaint resolution, expense tracking, and governance."
        />

        {/* Billing Cycle Toggle */}
        <Reveal className="flex justify-center mb-12">
          <div className="inline-flex items-center rounded-xl border border-bd bg-soft p-1 text-sm font-semibold shadow-sm">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`rounded-lg px-5 py-2 transition ${
                !isYearly ? 'bg-card text-navy shadow-md' : 'text-muted-foreground hover:text-navy'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`rounded-lg px-5 py-2 transition flex items-center gap-2 ${
                isYearly ? 'bg-card text-teal shadow-md' : 'text-muted-foreground hover:text-navy'
              }`}
            >
              <span>Annual Billing</span>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase text-white tracking-wider">
                2 Months Free
              </span>
            </button>
          </div>
        </Reveal>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mb-16">
          {/* Hostel Plan Card */}
          <Reveal className="h-full">
            <Card className="h-full flex flex-col justify-between p-8 border-bd/80 hover:border-teal/50 transition-all hover:shadow-xl relative bg-card">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="rounded-lg bg-blue-50 text-blue-700 font-bold text-xs px-3 py-1 border border-blue-200">
                    Hostel & PG Edition
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Up to 150 Rooms
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-navy">Hostel Plan</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-6">
                  {hostelPlan.subtitle}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl sm:text-5xl font-black text-navy">
                    ₹{hostelPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    /{isYearly ? 'year' : 'month'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-6">
                  + ₹{hostelGst.taxAmount.toLocaleString('en-IN')} (18% GST) = ₹{hostelGst.totalAmount.toLocaleString('en-IN')} total
                </p>

                <div className="border-t border-bd/60 pt-6 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-navy block">
                    What's included:
                  </span>
                  {hostelPlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                        <Icon n="check" s={11} />
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <Link to="/auth/register?role=admin&plan=hostel" className="block">
                  <Btn v="secondary" className="w-full py-3 shadow hover:bg-soft flex items-center justify-center gap-2">
                    <span>Subscribe to Hostel Plan</span>
                    <Icon n="arrow-right" s={14} />
                  </Btn>
                </Link>
                <p className="text-[11px] text-center text-muted-foreground mt-2">
                  Instant activation • Automated UPI & Card AutoPay
                </p>
              </div>
            </Card>
          </Reveal>

          {/* Society Plan Card (Highlighted / Most Popular) */}
          <Reveal className="h-full">
            <Card className="h-full flex flex-col justify-between p-8 border-2 border-teal bg-gradient-to-b from-teal/[0.04] to-card shadow-xl relative overflow-hidden ring-1 ring-teal/20">
              {/* Highlight Badge */}
              <div className="absolute top-0 right-0">
                <span className="bg-teal text-white text-[11px] font-bold px-4 py-1 rounded-bl-xl uppercase tracking-wider shadow-sm">
                  Most Popular
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="rounded-lg bg-teal/15 text-teal font-bold text-xs px-3 py-1 border border-teal/30">
                    Housing Societies & RWAs
                  </span>
                  <span className="text-xs text-teal font-bold">
                    Unlimited Flats & Towers
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-navy">Society Plan</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-6">
                  {societyPlan.subtitle}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl sm:text-5xl font-black text-navy">
                    ₹{societyPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    /{isYearly ? 'year' : 'month'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-6">
                  + ₹{societyGst.taxAmount.toLocaleString('en-IN')} (18% GST) = ₹{societyGst.totalAmount.toLocaleString('en-IN')} total
                </p>

                <div className="border-t border-bd/60 pt-6 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-navy block">
                    Everything in Hostel Plan, plus:
                  </span>
                  {societyPlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 font-medium">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-teal text-white shrink-0 mt-0.5 shadow-sm">
                        <Icon n="check" s={11} />
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <Link to="/auth/register?role=admin&plan=society" className="block">
                  <Btn v="p" className="w-full py-3.5 shadow-lg bg-[#263B52] hover:bg-[#34506b] flex items-center justify-center gap-2">
                    <span>Subscribe to Society Plan</span>
                    <Icon n="arrow-right" s={14} />
                  </Btn>
                </Link>
                <p className="text-[11px] text-center text-muted-foreground mt-2">
                  Includes 7-day grace period • SAC 998314 GST invoice
                </p>
              </div>
            </Card>
          </Reveal>
        </div>

        {/* Feature Comparison Matrix */}
        <Reveal className="mb-16">
          <Card className="p-6 sm:p-8">
            <h3 className="text-lg font-bold text-navy mb-2">Feature Comparison Matrix</h3>
            <p className="text-xs text-muted-foreground mb-6">
              Compare capabilities across Hostel (₹800/mo) and Society (₹2,000/mo) plans
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-bd text-navy font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Feature / Capability</th>
                    <th className="py-3 px-4 text-center">Hostel Plan (₹800)</th>
                    <th className="py-3 px-4 text-center bg-teal/5 rounded-t-lg">Society Plan (₹2,000)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bd/60 text-slate-700">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Resident & Unit Capacity</td>
                    <td className="py-3 px-4 text-center">Up to 150 Rooms</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">Unlimited Flats / Towers</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Digital Complaint LODGE & Status Tracking</td>
                    <td className="py-3 px-4 text-center">✓ Full</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ Full with Attachments</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Multi-Department Dispatch (Electrical, Plumbing, Lift, Security)</td>
                    <td className="py-3 px-4 text-center text-slate-400">Basic / Single Queue</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ Multi-Department Routing</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Society Expense & Petty Cash Ledger</td>
                    <td className="py-3 px-4 text-center text-slate-400">—</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ With Receipt Uploads</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Community Polls & Resident Voting</td>
                    <td className="py-3 px-4 text-center text-slate-400">—</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ Democratic Polling Engine</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">SLA Escalation Engine & Supervisor Reassignment</td>
                    <td className="py-3 px-4 text-center">Standard (48 hrs)</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ Automated Multi-Tier SLA</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Preventive Maintenance Schedules</td>
                    <td className="py-3 px-4 text-center">✓ Included</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ Advanced with Checklist</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Automated Recurring UPI & Card AutoPay</td>
                    <td className="py-3 px-4 text-center">✓ RBI e-Mandate</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ RBI e-Mandate</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">Failed Payment Grace Period</td>
                    <td className="py-3 px-4 text-center">3 Days</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">7 Days Full Protection</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-navy">GST Tax Invoice with SAC 998314 & PDF Download</td>
                    <td className="py-3 px-4 text-center">✓ Instant Download</td>
                    <td className="py-3 px-4 text-center font-bold text-teal bg-teal/5">✓ Instant Download</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>

        {/* FAQ Accordion */}
        <Reveal>
          <div className="max-w-3xl mx-auto space-y-4">
            <h3 className="text-xl font-bold text-navy text-center mb-6">
              Frequently Asked Questions About Subscriptions
            </h3>

            {faqs.map((f, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-bd bg-card overflow-hidden transition shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-4 text-left font-bold text-navy text-sm flex items-center justify-between hover:bg-soft transition"
                >
                  <span>{f.q}</span>
                  <span className={`text-teal transition-transform duration-200 ${activeFaq === idx ? 'rotate-180' : ''}`}>
                    <Icon n="filter" s={14} />
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-bd/40 bg-soft/40">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
};
