// ==============================================================================
// SmartResolve / Fixnora Executive Revenue Analytics Dashboard
// Platform MRR, ARR, active hostels (₹800) vs societies (₹2000), monthly trend charts,
// renewal success metrics, and SaaS growth indicators.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Primitives';
import { Icon } from '../../../components/ui/Icon';
import { fetchPlatformRevenueAnalytics } from '../../../lib/subscriptionService';
import type { RevenueAnalytics } from '../../../types/database';

export const RevenueAnalyticsSection: React.FC = () => {
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeline, setSelectedTimeline] = useState<'6m' | '12m'>('6m');

  useEffect(() => {
    fetchPlatformRevenueAnalytics()
      .then((data) => {
        setAnalytics(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching analytics', err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading || !analytics) {
    return (
      <div className="p-8 text-center space-y-3">
        <Icon n="refresh-cw" s={24} className="animate-spin text-teal mx-auto" />
        <p className="text-xs text-muted-foreground">Compiling platform revenue analytics...</p>
      </div>
    );
  }

  const maxMonthVal = Math.max(...analytics.monthly_trend.map((m) => m.total));
  const hostelTotalShare = (analytics.active_hostels * 800) / analytics.mrr;
  const societyTotalShare = (analytics.active_societies * 2000) / analytics.mrr;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bd/60 pb-4">
        <div>
          <h2 className="text-lg font-bold text-navy flex items-center gap-2">
            Platform Revenue & Subscription Analytics
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
              Live SaaS Financials
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Core revenue streams: Hostel Tier (₹800/mo) and Society Tier (₹2,000/mo)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-bd bg-soft p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedTimeline('6m')}
              className={`px-3 py-1 rounded-md transition ${
                selectedTimeline === '6m' ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Past 6 Months
            </button>
            <button
              type="button"
              onClick={() => setSelectedTimeline('12m')}
              className={`px-3 py-1 rounded-md transition ${
                selectedTimeline === '12m' ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Annual Run
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-wider text-[10px]">Monthly Recurring (MRR)</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/10 text-teal">
              <Icon n="chart" s={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-navy">
            ₹{analytics.mrr.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
            <span className="text-xs">↑</span>
            <span>+14.2% MoM Expansion</span>
          </div>
        </Card>

        {/* ARR */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-wider text-[10px]">Annual Run Rate (ARR)</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
              <Icon n="shield" s={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-navy">
            ₹{analytics.arr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Projected 12-month run rate
          </div>
        </Card>

        {/* Active Accounts Breakdown */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-wider text-[10px]">Active Subscriptions</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-700">
              <Icon n="users" s={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-navy">
            {analytics.active_subscriptions} Units
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="text-teal font-medium">{analytics.active_societies} Societies</span>
            <span className="text-blue-600 font-medium">{analytics.active_hostels} Hostels</span>
          </div>
        </Card>

        {/* Success & Churn */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-wider text-[10px]">Payment Success Rate</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <Icon n="check" s={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-navy">
            {analytics.success_rate}%
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>UPI & Card Autopay</span>
            <span className="text-emerald-700 font-semibold">{analytics.churn_rate}% Churn</span>
          </div>
        </Card>
      </div>

      {/* Revenue Trend Visual & Plan Mix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <Card className="lg:col-span-2 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-bd/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-navy">Monthly Revenue Trend & Plan Distribution</h3>
              <p className="text-xs text-muted-foreground">Recurring subscription volume over time</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Hostels (₹800)
              </span>
              <span className="flex items-center gap-1.5 text-teal">
                <span className="h-2.5 w-2.5 rounded-full bg-teal" />
                Societies (₹2,000)
              </span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="pt-2">
            <div className="h-56 flex items-end justify-between gap-3 sm:gap-6 border-b border-bd/60 pb-2">
              {analytics.monthly_trend.map((m, idx) => {
                const totalHeightPct = Math.round((m.total / (maxMonthVal * 1.15)) * 100);
                const hostelHeightPct = Math.round((m.hostel_revenue / m.total) * totalHeightPct);
                const societyHeightPct = totalHeightPct - hostelHeightPct;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="opacity-0 group-hover:opacity-100 transition text-[10px] font-bold text-navy bg-white border border-bd px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                      ₹{m.total.toLocaleString('en-IN')}
                    </div>

                    <div className="w-full max-w-[48px] rounded-t-md overflow-hidden flex flex-col justify-end bg-soft/50 shadow-sm transition hover:opacity-90">
                      {/* Society Portion */}
                      <div
                        style={{ height: `${societyHeightPct}%` }}
                        className="w-full bg-[#1e4d58] transition-all duration-500"
                        title={`Societies: ₹${m.society_revenue.toLocaleString('en-IN')}`}
                      />
                      {/* Hostel Portion */}
                      <div
                        style={{ height: `${hostelHeightPct}%` }}
                        className="w-full bg-blue-500 transition-all duration-500"
                        title={`Hostels: ₹${m.hostel_revenue.toLocaleString('en-IN')}`}
                      />
                    </div>

                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                      {m.month.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="rounded-lg bg-soft p-3">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                Hostel Monthly Revenue
              </span>
              <span className="text-sm font-bold text-blue-600 mt-0.5 block">
                ₹{(analytics.active_hostels * 800).toLocaleString('en-IN')}/mo
              </span>
            </div>

            <div className="rounded-lg bg-soft p-3">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                Society Monthly Revenue
              </span>
              <span className="text-sm font-bold text-teal mt-0.5 block">
                ₹{(analytics.active_societies * 2000).toLocaleString('en-IN')}/mo
              </span>
            </div>

            <div className="rounded-lg bg-soft p-3 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">
                Avg Revenue Per Account
              </span>
              <span className="text-sm font-bold text-navy mt-0.5 block">
                ₹{Math.round(analytics.mrr / analytics.active_subscriptions).toLocaleString('en-IN')}/mo
              </span>
            </div>
          </div>
        </Card>

        {/* Plan Breakdown & Pricing Model Cards */}
        <div className="space-y-6">
          {/* Plan Ratio Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
              Revenue Model Breakdown
            </h3>

            {/* Visual ratio bar */}
            <div className="space-y-2">
              <div className="h-3 w-full rounded-full bg-soft overflow-hidden flex">
                <div
                  style={{ width: `${Math.round(societyTotalShare * 100)}%` }}
                  className="bg-teal"
                  title="Society Plan"
                />
                <div
                  style={{ width: `${Math.round(hostelTotalShare * 100)}%` }}
                  className="bg-blue-500"
                  title="Hostel Plan"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal" />
                  <span className="font-semibold text-navy">Society Tier</span>
                  <span className="text-muted-foreground">({Math.round(societyTotalShare * 100)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="font-semibold text-navy">Hostel Tier</span>
                  <span className="text-muted-foreground">({Math.round(hostelTotalShare * 100)}%)</span>
                </div>
              </div>
            </div>

            <div className="border-t border-bd/60 pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-navy">Hostel Plan</p>
                  <p className="text-[11px] text-muted-foreground">₹800/mo base price</p>
                </div>
                <span className="font-bold text-blue-600 text-sm">
                  {analytics.active_hostels} Hostels
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-navy">Society Plan</p>
                  <p className="text-[11px] text-muted-foreground">₹2,000/mo base price</p>
                </div>
                <span className="font-bold text-teal text-sm">
                  {analytics.active_societies} Societies
                </span>
              </div>
            </div>
          </Card>

          {/* GST & Statutory Compliance Summary Card */}
          <Card className="p-6 space-y-3 bg-soft/40">
            <div className="flex items-center gap-2 text-navy font-bold text-xs uppercase tracking-wider">
              <Icon n="file" s={16} c="text-teal" />
              <span>Statutory & Tax Metrics</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Fixnora complies with Indian Goods & Services Tax (GST) Act:
            </p>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between border-b border-bd/40 pb-1">
                <span className="text-muted-foreground">HSN/SAC Code:</span>
                <span className="font-mono font-bold text-navy">998314</span>
              </div>
              <div className="flex justify-between border-b border-bd/40 pb-1">
                <span className="text-muted-foreground">Applicable Tax Rate:</span>
                <span className="font-semibold text-navy">18% (9% CGST + 9% SGST)</span>
              </div>
              <div className="flex justify-between border-b border-bd/40 pb-1">
                <span className="text-muted-foreground">Est. GST Collected (MTD):</span>
                <span className="font-semibold text-emerald-700">₹{Math.round(analytics.mrr * 0.18).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-muted-foreground">E-Mandate Compliance:</span>
                <span className="font-semibold text-emerald-700">NPCI / RBI e-Mandate</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
