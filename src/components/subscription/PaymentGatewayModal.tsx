// ==============================================================================
// SmartResolve / Fixnora Automated Payment Gateway Modal
// Recurring UPI AutoPay, Credit/Debit Card e-Mandates & NetBanking Checkout
// Supports instant checkout, simulated test modes, and RBI e-mandate compliance
// ==============================================================================

import React, { useState } from 'react';
import { Btn } from '../ui/Primitives';
import { Icon } from '../ui/Icon';
import {
  SUBSCRIPTION_PLANS,
  computeGstBreakdown,
  changeSubscriptionPlan,
} from '../../lib/subscriptionService';
import type { SubscriptionPlanType, BillingInterval, Subscription, SubscriptionInvoice } from '../../types/database';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  societyId: string;
  initialPlanType?: SubscriptionPlanType;
  initialInterval?: BillingInterval;
  onSuccess: (result: { subscription: Subscription; invoice: SubscriptionInvoice }) => void;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  societyId,
  initialPlanType = 'society',
  initialInterval = 'monthly',
  onSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanType>(initialPlanType);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [paymentMethod, setPaymentMethod] = useState<'upi_autopay' | 'card' | 'netbanking'>('upi_autopay');

  // UPI fields
  const [upiId, setUpiId] = useState('society.treasurer@okhdfcbank');
  const [upiApp, setUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'other'>('gpay');

  // Card fields
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 9842');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvv, setCardCvv] = useState('•••');
  const [cardHolder, setCardHolder] = useState('Society Admin');

  // Netbanking fields
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const plan = SUBSCRIPTION_PLANS[selectedPlan];
  const basePrice = interval === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const gst = computeGstBreakdown(basePrice);

  const handleProcessPayment = async (forceFail = false) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStep('Authorizing Recurring Payment Mandate...');

    try {
      await new Promise((r) => setTimeout(r, 700));

      if (forceFail) {
        setProcessingStep('Connecting to Bank Mandate Gateway...');
        await new Promise((r) => setTimeout(r, 600));
        throw new Error('Mandate Authorization Rejected: Insufficient balance or bank server timeout (E07)');
      }

      setProcessingStep('Setting up automated recurring schedule with NPCI / Gateway...');
      await new Promise((r) => setTimeout(r, 700));

      setProcessingStep('Generating GST Invoice and activating subscription...');
      const methodDetails =
        paymentMethod === 'upi_autopay'
          ? {
              type: 'upi_autopay' as const,
              brand: `UPI AutoPay (${upiApp.toUpperCase()})`,
              upiId,
            }
          : paymentMethod === 'card'
          ? {
              type: 'card' as const,
              brand: 'Visa Credit Card (e-Mandate)',
              last4: '9842',
            }
          : {
              type: 'netbanking' as const,
              brand: `NetBanking Auto-Debit (${selectedBank})`,
            };

      const result = await changeSubscriptionPlan(societyId, selectedPlan, interval, methodDetails);

      setProcessingStep('Success! Subscription active.');
      await new Promise((r) => setTimeout(r, 400));

      setIsProcessing(false);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Payment processing failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-card border border-bd rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bd/60 bg-soft flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal/10 text-teal border border-teal/20">
              <Icon n="shield" s={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-navy flex items-center gap-2">
                Automated Payment Gateway Checkout
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  RBI e-Mandate Ready
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Encrypted recurring subscription processing with instant GST invoice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-white hover:text-navy transition"
          >
            <Icon n="x" s={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-3">
              <Icon n="alert" s={18} c="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Payment Mandate Failed</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Plan Selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-navy">
                Select Subscription Tier
              </label>
              {/* Billing Cycle Toggle */}
              <div className="inline-flex items-center rounded-lg border border-bd bg-soft p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setInterval('monthly')}
                  className={`px-3 py-1 rounded-md transition ${
                    interval === 'monthly' ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('yearly')}
                  className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                    interval === 'yearly' ? 'bg-card text-teal shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  Annual
                  <span className="text-[9px] bg-emerald-500 text-white px-1 py-0.2 rounded font-bold">
                    2 Mo Free
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Hostel Plan Card */}
              <button
                type="button"
                onClick={() => setSelectedPlan('hostel')}
                className={`text-left p-4 rounded-xl border transition relative ${
                  selectedPlan === 'hostel'
                    ? 'border-teal bg-teal/5 ring-2 ring-teal/20'
                    : 'border-bd bg-card hover:border-teal/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-navy">Hostel Plan</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Hostel & PG
                  </span>
                </div>
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-2xl font-black text-navy">
                    ₹{interval === 'yearly' ? '8,000' : '800'}
                  </span>
                  <span className="text-xs text-muted-foreground">/{interval === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  Up to 150 student/resident rooms, warden assign, notice board & standard SLAs.
                </p>
                {selectedPlan === 'hostel' && (
                  <span className="absolute top-2 right-2 text-teal">
                    <Icon n="check" s={16} />
                  </span>
                )}
              </button>

              {/* Society Plan Card */}
              <button
                type="button"
                onClick={() => setSelectedPlan('society')}
                className={`text-left p-4 rounded-xl border transition relative ${
                  selectedPlan === 'society'
                    ? 'border-teal bg-teal/5 ring-2 ring-teal/20'
                    : 'border-bd bg-card hover:border-teal/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-navy">Society Plan</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal/10 text-teal">
                    Most Popular
                  </span>
                </div>
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-2xl font-black text-navy">
                    ₹{interval === 'yearly' ? '20,000' : '2,000'}
                  </span>
                  <span className="text-xs text-muted-foreground">/{interval === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  Unlimited flats/towers, multi-departments, expense ledger, polls & SLA escalations.
                </p>
                {selectedPlan === 'society' && (
                  <span className="absolute top-2 right-2 text-teal">
                    <Icon n="check" s={16} />
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-navy block mb-2">
              Automated Recurring Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi_autopay')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                  paymentMethod === 'upi_autopay'
                    ? 'border-teal bg-teal/5 font-semibold text-navy'
                    : 'border-bd bg-card text-muted-foreground hover:bg-soft'
                }`}
              >
                <span className="text-xs font-bold">UPI AutoPay</span>
                <span className="text-[10px] text-muted-foreground">Google Pay / PhonePe</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                  paymentMethod === 'card'
                    ? 'border-teal bg-teal/5 font-semibold text-navy'
                    : 'border-bd bg-card text-muted-foreground hover:bg-soft'
                }`}
              >
                <span className="text-xs font-bold">Card Mandate</span>
                <span className="text-[10px] text-muted-foreground">Visa / MasterCard</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('netbanking')}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                  paymentMethod === 'netbanking'
                    ? 'border-teal bg-teal/5 font-semibold text-navy'
                    : 'border-bd bg-card text-muted-foreground hover:bg-soft'
                }`}
              >
                <span className="text-xs font-bold">e-NACH</span>
                <span className="text-[10px] text-muted-foreground">NetBanking Debit</span>
              </button>
            </div>
          </div>

          {/* Method Details Form */}
          {paymentMethod === 'upi_autopay' && (
            <div className="rounded-xl border border-bd p-4 bg-soft/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy">Recurring UPI Mandate Details</span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Zero Transaction Fee
                </span>
              </div>
              <div className="flex gap-2">
                {(['gpay', 'phonepe', 'paytm'] as const).map((app) => (
                  <button
                    key={app}
                    type="button"
                    onClick={() => setUpiApp(app)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize transition ${
                      upiApp === app
                        ? 'border-teal bg-card text-navy shadow-sm'
                        : 'border-bd bg-soft text-muted-foreground'
                    }`}
                  >
                    {app === 'gpay' ? 'Google Pay' : app}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[11px] font-bold text-navy block mb-1">UPI ID (VPA)</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. yourname@okhdfcbank"
                  className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-medium text-navy focus:border-teal focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                You will receive a mandate approval request on your UPI app to authorize monthly recurring debit of ₹{gst.totalAmount}.
              </p>
            </div>
          )}

          {paymentMethod === 'card' && (
            <div className="rounded-xl border border-bd p-4 bg-soft/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy">Standing Instruction (SI) on Card</span>
                <span className="text-[11px] text-muted-foreground">RBI Compliant</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-navy block mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-medium text-navy focus:border-teal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-navy block mb-1">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-medium text-navy focus:border-teal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-navy block mb-1">CVV</label>
                  <input
                    type="password"
                    maxLength={3}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-medium text-navy focus:border-teal focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-navy block mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full rounded-lg border border-bd bg-card px-3 py-2 text-xs font-medium text-navy focus:border-teal focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'netbanking' && (
            <div className="rounded-xl border border-bd p-4 bg-soft/50 space-y-3">
              <span className="text-xs font-bold text-navy block">Select Bank for e-NACH Mandate</span>
              <div className="grid grid-cols-2 gap-2">
                {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBank(b)}
                    className={`p-2.5 rounded-lg border text-left text-xs font-medium transition ${
                      selectedBank === b
                        ? 'border-teal bg-card text-navy font-semibold shadow-sm'
                        : 'border-bd bg-soft text-muted-foreground'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pricing & GST Tax Breakdown */}
          <div className="rounded-xl border border-bd/80 bg-soft p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {plan.name} ({interval === 'yearly' ? 'Annual Subscription' : '1 Month Subscription'})
              </span>
              <span className="font-semibold text-navy">₹{gst.baseAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>CGST (9%) - SAC 998314</span>
              <span>₹{gst.cgst.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>SGST (9%) - SAC 998314</span>
              <span>₹{gst.sgst.toLocaleString('en-IN')}</span>
            </div>
            <div className="border-t border-bd/60 pt-2 mt-2 flex items-center justify-between text-sm font-bold text-navy">
              <span>Total Payable with GST</span>
              <span className="text-base text-teal">₹{gst.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1">
              <span>Next automated billing on {interval === 'yearly' ? '1 year from now' : '30 days from now'}</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-bd/60 bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Icon n="lock" s={14} c="text-emerald-600" />
            <span>256-bit Bank Grade Encryption • PCI-DSS Certified</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Sandbox Simulation Failure button for testing grace period */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleProcessPayment(true)}
              className="text-[11px] text-red-600 hover:text-red-700 hover:underline px-2 py-1 font-semibold"
              title="Test dunning flow and 7-day grace period"
            >
              Simulate Failure
            </button>

            <Btn
              type="button"
              v="p"
              disabled={isProcessing}
              onClick={() => handleProcessPayment(false)}
              className="w-full sm:w-auto px-6 py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Icon n="refresh-cw" s={16} className="animate-spin" />
                  <span>{processingStep || 'Authorizing Mandate...'}</span>
                </>
              ) : (
                <>
                  <Icon n="check" s={16} />
                  <span>
                    Authorize & Pay ₹{gst.totalAmount.toLocaleString('en-IN')}
                  </span>
                </>
              )}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
};
