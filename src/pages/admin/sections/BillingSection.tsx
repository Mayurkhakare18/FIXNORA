// ==============================================================================
// SmartResolve / Fixnora Billing & Subscription Management Section
// Society & Hostel Admin Portal: Active plan, recurring auto-pay, renewal reminders,
// grace period dunning management, payment history, and GST invoice download
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Card, Pill, Btn } from '../../../components/ui/Primitives';
import { Icon } from '../../../components/ui/Icon';
import {
  fetchSocietySubscription,
  fetchSubscriptionInvoices,
  toggleAutoRenewal,
  processRecurringRenewal,
  simulatePaymentFailure,
  retryFailedPayment,
  fetchRenewalReminders,
  resetSubscriptionSimulation,
  SUBSCRIPTION_PLANS,
  computeGstBreakdown,
} from '../../../lib/subscriptionService';
import type { Subscription, SubscriptionInvoice, RenewalReminder, Society } from '../../../types/database';
import { PaymentGatewayModal } from '../../../components/subscription/PaymentGatewayModal';
import { GstInvoiceModal } from '../../../components/subscription/GstInvoiceModal';

interface BillingSectionProps {
  society: Society;
}

export const BillingSection: React.FC<BillingSectionProps> = ({ society }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [reminders, setReminders] = useState<RenewalReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<SubscriptionInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      const [subData, invData, remData] = await Promise.all([
        fetchSocietySubscription(society.id),
        fetchSubscriptionInvoices(society.id),
        fetchRenewalReminders(society.id),
      ]);
      setSubscription(subData);
      setInvoices(invData);
      setReminders(remData);
    } catch (e) {
      console.error('Failed to load billing data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [society.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleAutoRenewal = async () => {
    if (!subscription) return;
    setIsActionLoading(true);
    try {
      const nextState = !subscription.auto_renewal;
      const updated = await toggleAutoRenewal(society.id, nextState);
      setSubscription(updated);
      showToast(nextState ? 'Recurring auto-pay enabled.' : 'Auto-renewal paused. Service will stop at period end.');
    } catch (e: any) {
      showToast('Error updating auto-renewal');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSimulateRenewal = async () => {
    setIsActionLoading(true);
    try {
      const result = await processRecurringRenewal(society.id);
      setSubscription(result.subscription);
      setInvoices((prev) => [result.invoice, ...prev]);
      showToast(`Recurring renewal successful! New invoice #${result.invoice.invoice_number} created.`);
    } catch (e: any) {
      showToast('Failed to process renewal simulation');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSimulateFailure = async () => {
    setIsActionLoading(true);
    try {
      const failedSub = await simulatePaymentFailure(society.id);
      setSubscription(failedSub);
      const invData = await fetchSubscriptionInvoices(society.id);
      setInvoices(invData);
      showToast('Payment failure triggered: 7-day grace period activated.');
    } catch (e: any) {
      showToast('Simulation error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    setIsActionLoading(true);
    try {
      const result = await retryFailedPayment(society.id);
      setSubscription(result.subscription);
      setInvoices((prev) => [result.invoice, ...prev]);
      showToast('Dues cleared successfully! Subscription restored to Active.');
    } catch (e: any) {
      showToast('Payment retry failed.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetSimulation = () => {
    resetSubscriptionSimulation(society.id);
    loadBillingData();
    showToast('Subscription data reset to default.');
  };

  if (isLoading || !subscription) {
    return (
      <div className="p-8 text-center space-y-3">
        <Icon n="refresh-cw" s={24} className="animate-spin text-teal mx-auto" />
        <p className="text-xs text-muted-foreground">Loading subscription & billing details...</p>
      </div>
    );
  }

  const plan = SUBSCRIPTION_PLANS[subscription.plan_type];
  const gst = computeGstBreakdown(subscription.amount);
  const isPastDue = subscription.status === 'past_due';

  const daysToRenewal = Math.ceil(
    (new Date(subscription.next_billing_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.plan_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="rounded-xl border border-teal/40 bg-teal/10 p-4 text-xs font-semibold text-teal flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Icon n="check" s={16} />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-teal hover:opacity-75">
            <Icon n="x" s={14} />
          </button>
        </div>
      )}

      {/* Dunning Alert: Failed Payment & 7-Day Grace Period */}
      {isPastDue && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50/90 p-5 shadow-md space-y-3 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600 shrink-0">
                <Icon n="alert" s={22} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                  Action Required: Recurring Payment Failed
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-200 text-red-800">
                    7-Day Grace Period Active
                  </span>
                </h3>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  The automated recurring payment of ₹{gst.totalAmount.toLocaleString('en-IN')} for your{' '}
                  <strong>{plan.name}</strong> was rejected by the bank. To prevent service disruption of complaint management and resident access, please clear dues before{' '}
                  <strong>
                    {subscription.grace_period_until
                      ? new Date(subscription.grace_period_until).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '7 days'}
                  </strong>
                  .
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:self-center shrink-0">
              <Btn
                type="button"
                v="p"
                disabled={isActionLoading}
                onClick={handleRetryPayment}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2.5 shadow"
              >
                Retry Payment Now
              </Btn>
              <Btn
                type="button"
                v="secondary"
                onClick={() => setShowCheckoutModal(true)}
                className="text-xs px-3.5 py-2.5 bg-white border border-red-300 text-red-900"
              >
                Change Card / UPI
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Renewal Reminder Notice */}
      {!isPastDue && daysToRenewal <= 7 && daysToRenewal >= 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Icon n="clock" s={18} c="text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-950">
                Subscription Renews in {daysToRenewal} {daysToRenewal === 1 ? 'day' : 'days'} (
                {new Date(subscription.next_billing_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                )
              </p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                ₹{gst.totalAmount.toLocaleString('en-IN')} (incl. 18% GST) will be automatically debited from{' '}
                {subscription.payment_method_brand || 'UPI AutoPay'}.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-200 text-amber-900 uppercase tracking-wider hidden sm:inline">
            Auto-Pay Ready
          </span>
        </div>
      )}

      {/* Primary KPI & Plan Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Plan Card */}
        <Card className="lg:col-span-2 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-bd/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal/10 text-teal border border-teal/20">
                <Icon n="shield" s={24} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-navy">{plan.name}</h3>
                  <Pill tone={isPastDue ? 'h' : 't'}>
                    {isPastDue ? 'Past Due (Grace Period)' : 'Active & Renews Automatically'}
                  </Pill>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.subtitle}</p>
              </div>
            </div>

            <div className="text-right sm:self-center">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-navy">
                  ₹{subscription.amount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-muted-foreground">
                  /{subscription.billing_interval === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">
                + ₹{gst.taxAmount.toLocaleString('en-IN')} (18% GST) = ₹{gst.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-lg bg-soft p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Billing Cycle
              </span>
              <span className="text-sm font-bold text-navy capitalize mt-1 block">
                {subscription.billing_interval}
              </span>
            </div>

            <div className="rounded-lg bg-soft p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Next Billing Date
              </span>
              <span className="text-sm font-bold text-navy mt-1 block">
                {new Date(subscription.next_billing_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="rounded-lg bg-soft p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Auto-Renewal Status
              </span>
              <span
                className={`text-sm font-bold mt-1 block ${
                  subscription.auto_renewal ? 'text-teal' : 'text-amber-600'
                }`}
              >
                {subscription.auto_renewal ? 'Enabled (Auto-Debit)' : 'Paused'}
              </span>
            </div>

            <div className="rounded-lg bg-soft p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Compliant SAC Code
              </span>
              <span className="text-sm font-bold text-navy mt-1 font-mono block">
                998314 (SaaS)
              </span>
            </div>
          </div>

          {/* Included Features List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy mb-3">
              Included In Current {plan.name}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {plan.features.slice(0, 6).map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                    <Icon n="check" s={12} />
                  </span>
                  <span className="font-medium text-navy/90">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-bd/60">
            <div className="flex items-center gap-2">
              <Btn
                type="button"
                v="p"
                onClick={() => setShowCheckoutModal(true)}
                className="text-xs px-4 py-2 flex items-center gap-1.5 shadow"
              >
                <Icon n="refresh-cw" s={14} />
                <span>Switch / Upgrade Plan</span>
              </Btn>

              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleToggleAutoRenewal}
                className={`text-xs px-3.5 py-2 rounded-lg font-semibold border transition ${
                  subscription.auto_renewal
                    ? 'border-bd text-muted-foreground hover:bg-soft'
                    : 'border-teal bg-teal/10 text-teal'
                }`}
              >
                {subscription.auto_renewal ? 'Pause Recurring Mandate' : 'Resume Recurring Mandate'}
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground">
              Need hostel or society enterprise custom terms? Contact support
            </span>
          </div>
        </Card>

        {/* Right Column: Payment Method & Renewal Reminders */}
        <div className="space-y-6">
          {/* Active Payment Method Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
                Payment Mandate on File
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Verified
              </span>
            </div>

            <div className="rounded-xl border border-bd p-3.5 bg-soft/50 space-y-2">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-white text-xs font-bold">
                  {subscription.payment_method_type === 'upi_autopay' ? 'UPI' : 'CARD'}
                </span>
                <div>
                  <p className="text-xs font-bold text-navy">
                    {subscription.payment_method_brand || 'UPI AutoPay'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {subscription.upi_id || `Card ending in •••• ${subscription.payment_method_last4 || '9842'}`}
                  </p>
                </div>
              </div>

              {subscription.mandate_id && (
                <div className="text-[10px] text-muted-foreground border-t border-bd/40 pt-2 flex items-center justify-between">
                  <span>Mandate ID:</span>
                  <span className="font-mono text-navy font-semibold">{subscription.mandate_id}</span>
                </div>
              )}
            </div>

            <Btn
              type="button"
              v="secondary"
              onClick={() => setShowCheckoutModal(true)}
              className="w-full text-xs py-2"
            >
              Update Payment Mandate
            </Btn>
          </Card>

          {/* Renewal Reminders Timeline Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
              Automated Renewal Reminders
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Fixnora sends proactive alerts prior to recurring auto-debit:
            </p>

            <div className="space-y-2.5 text-xs pt-1">
              {reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-soft border border-bd/40"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                        rem.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {rem.days_before}d
                    </span>
                    <div>
                      <span className="font-semibold text-navy capitalize">{rem.channel} Alert</span>
                      <span className="text-[10px] text-muted-foreground block">
                        {rem.days_before} days prior to due date
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      rem.status === 'sent'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {rem.status === 'sent' ? 'Dispatched' : 'Scheduled'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Developer & Sandbox Simulation Toolbar */}
      <div className="rounded-xl border border-bd/80 bg-soft/60 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-navy flex items-center gap-1.5">
              <Icon n="refresh-cw" s={14} c="text-teal" />
              Developer & Sandbox Simulation Bar
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Simulate recurring renewals, payment failures, or reset test data without calling external APIs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isActionLoading}
              onClick={handleSimulateRenewal}
              className="px-3 py-1.5 rounded-lg bg-card border border-bd text-xs font-semibold text-navy hover:bg-white transition"
              title="Processes a monthly renewal and logs new invoice"
            >
              Simulate Monthly Renewal
            </button>

            <button
              type="button"
              disabled={isActionLoading}
              onClick={handleSimulateFailure}
              className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
              title="Simulates failed payment debit and triggers 7-day grace period"
            >
              Simulate Failed Payment
            </button>

            <button
              type="button"
              disabled={isActionLoading}
              onClick={handleResetSimulation}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-navy transition"
            >
              Reset Data
            </button>
          </div>
        </div>
      </div>

      {/* Payment History & GST Invoices Table */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-bd/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-navy">Payment History & Tax Invoices</h3>
            <p className="text-xs text-muted-foreground">
              Review all past subscription charges and download GST-compliant tax invoices (SAC 998314)
            </p>
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-bd bg-soft px-3 py-1.5 text-xs text-navy placeholder:text-muted-foreground/60 focus:bg-card focus:outline-none focus:border-teal"
            />
            <div className="inline-flex rounded-lg border border-bd bg-soft p-0.5 text-xs font-semibold">
              {(['all', 'paid', 'failed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md capitalize transition ${
                    statusFilter === st ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-bd text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Plan / Description</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Base (₹)</th>
                <th className="py-2.5 px-3">GST (18%)</th>
                <th className="py-2.5 px-3">Total (₹)</th>
                <th className="py-2.5 px-3">Payment Method</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">GST Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bd/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No payment history matches the criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-soft/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-navy">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-navy block">{inv.plan_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        SAC: {inv.sac_code || '998314'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-3 font-medium text-navy">
                      ₹{inv.base_amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      ₹{inv.tax_amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-bold text-navy">
                      ₹{inv.total_amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {inv.payment_method}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Btn
                        type="button"
                        v="secondary"
                        onClick={() => {
                          setSelectedInvoiceForModal(inv);
                          setShowInvoiceModal(true);
                        }}
                        className="py-1 px-2.5 text-xs inline-flex items-center gap-1"
                      >
                        <Icon n="download" s={12} />
                        <span>GST Invoice</span>
                      </Btn>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment Gateway Modal */}
      <PaymentGatewayModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        societyId={society.id}
        initialPlanType={subscription.plan_type}
        initialInterval={subscription.billing_interval}
        onSuccess={(res) => {
          setSubscription(res.subscription);
          setInvoices((prev) => [res.invoice, ...prev]);
          showToast(`Subscription updated to ${res.subscription.plan_name}!`);
        }}
      />

      {/* GST Invoice Modal */}
      <GstInvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        invoice={selectedInvoiceForModal}
        society={society}
      />
    </div>
  );
};
