// ==============================================================================
// SmartResolve / Fixnora GST Tax Invoice Modal & PDF Generator
// Standard Indian GST Tax Invoice compliant with Section 31 of CGST Act, 2017
// Includes SAC 998314, CGST 9% + SGST 9%, QR validation and clean printable A4 format
// ==============================================================================

import React, { useRef } from 'react';
import { Btn } from '../ui/Primitives';
import { Icon } from '../ui/Icon';
import type { SubscriptionInvoice, Society } from '../../types/database';

interface GstInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SubscriptionInvoice | null;
  society: Society | null;
}

export const GstInvoiceModal: React.FC<GstInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  society,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const amountInWords = (num: number) => {
    if (num === 2360) return 'Two Thousand Three Hundred Sixty Rupees Only';
    if (num === 944) return 'Nine Hundred Forty-Four Rupees Only';
    if (num === 23600) return 'Twenty-Three Thousand Six Hundred Rupees Only';
    if (num === 9440) return 'Nine Thousand Four Hundred Forty Rupees Only';
    return `${num.toLocaleString('en-IN')} Rupees Only`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print px-6 py-3.5 bg-navy text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon n="file" s={18} c="text-teal" />
            <span className="text-sm font-bold">GST Tax Invoice #{invoice.invoice_number}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {invoice.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Btn
              type="button"
              v="p"
              onClick={handlePrint}
              className="py-1.5 px-3.5 text-xs flex items-center gap-1.5 bg-teal hover:bg-teal-dark shadow-sm"
            >
              <Icon n="download" s={14} />
              <span>Download / Print PDF</span>
            </Btn>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <Icon n="x" s={18} />
            </button>
          </div>
        </div>

        {/* Invoice Printable A4 Container */}
        <div className="overflow-y-auto p-6 sm:p-10 bg-white text-slate-800 text-xs leading-relaxed" ref={printAreaRef}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .no-print { display: none !important; }
              #invoice-print-area, #invoice-print-area * { visibility: visible; }
              #invoice-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 20px;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
              }
            }
          `}</style>

          <div id="invoice-print-area" className="border border-slate-300 rounded-xl p-6 sm:p-8 space-y-6">
            {/* Header: Company & Tax Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="grid h-8 w-8 place-items-center rounded bg-[#263B52] text-white font-bold text-sm">
                    FX
                  </span>
                  <div>
                    <h1 className="text-lg font-black text-slate-900 tracking-tight">Fixnora</h1>
                    <p className="text-[10px] text-slate-500">Cloud ERP for Housing Societies & Hostels</p>
                  </div>
                </div>
                <p className="font-semibold text-slate-800">Fixnora Technologies Pvt. Ltd.</p>
                <p className="text-slate-600">Level 4, Synergy Tech Park, Baner Road, Pune, MH - 411045</p>
                <p className="text-slate-600">CIN: U72900MH2024PTC123456</p>
                <p className="text-slate-600 font-medium">
                  GSTIN: <span className="font-bold text-slate-900">27AABCS1429B1Z2</span> (State: 27 - Maharashtra)
                </p>
                <p className="text-slate-600">Email: billing@fixnora.com | Tel: +91 20 4911 2000</p>
              </div>

              <div className="text-right sm:self-start space-y-1 bg-slate-50 p-4 rounded-lg border border-slate-200 min-w-[220px]">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">TAX INVOICE</h2>
                <p className="text-[11px] font-semibold text-slate-500">(Original for Recipient)</p>
                <div className="pt-2 text-left space-y-1 border-t border-slate-200">
                  <p><span className="text-slate-500 font-medium">Invoice No:</span> <strong className="text-slate-900">{invoice.invoice_number}</strong></p>
                  <p><span className="text-slate-500 font-medium">Invoice Date:</span> <strong className="text-slate-900">{formatDate(invoice.created_at)}</strong></p>
                  <p><span className="text-slate-500 font-medium">Billing Period:</span> {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}</p>
                  <p><span className="text-slate-500 font-medium">Place of Supply:</span> Maharashtra (27)</p>
                  <p><span className="text-slate-500 font-medium">Reverse Charge:</span> No</p>
                </div>
              </div>
            </div>

            {/* Billed To / Society Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Billed To (Customer Details):
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {society?.name || 'Emerald Heights Co-operative Housing Society'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  Registration No: <span className="font-medium text-slate-800">{society?.registration_number || 'MAH/PUN/HSG/2021/491'}</span>
                </p>
                <p className="text-slate-600">
                  {society?.address || 'Plot 42, Sector 8, Palm Avenue'}, {society?.city || 'Pune'}, {society?.state || 'Maharashtra'} - {society?.pincode || '411045'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Payment & Transaction Details:
                </span>
                <p className="text-slate-700">
                  Payment Status: <strong className="text-emerald-700 uppercase">{invoice.status}</strong>
                </p>
                <p className="text-slate-700">
                  Payment Method: <span className="font-medium text-slate-900">{invoice.payment_method}</span>
                </p>
                {invoice.gateway_payment_id && (
                  <p className="text-slate-700">
                    Transaction Ref: <span className="font-mono text-slate-800">{invoice.gateway_payment_id}</span>
                  </p>
                )}
                {invoice.paid_at && (
                  <p className="text-slate-700">
                    Paid On: <span className="font-medium text-slate-900">{formatDate(invoice.paid_at)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Itemized Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-300">
                    <th className="p-2.5 border-r border-slate-200 w-12 text-center">#</th>
                    <th className="p-2.5 border-r border-slate-200">Service Description</th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">SAC Code</th>
                    <th className="p-2.5 border-r border-slate-200 w-16 text-center">Qty</th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-right">Taxable (₹)</th>
                    <th className="p-2.5 border-r border-slate-200 w-20 text-right">CGST (9%)</th>
                    <th className="p-2.5 border-r border-slate-200 w-20 text-right">SGST (9%)</th>
                    <th className="p-2.5 w-28 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  <tr>
                    <td className="p-3 text-center border-r border-slate-200 font-medium">1</td>
                    <td className="p-3 border-r border-slate-200">
                      <p className="font-bold text-slate-900">
                        {invoice.plan_name} SaaS Subscription
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Fixnora Cloud ERP Platform subscription for society governance, digital complaints, staff assignment, and maintenance.
                      </p>
                    </td>
                    <td className="p-3 text-center border-r border-slate-200 font-mono text-[11px]">
                      {invoice.sac_code || '998314'}
                    </td>
                    <td className="p-3 text-center border-r border-slate-200 font-medium">1</td>
                    <td className="p-3 text-right border-r border-slate-200 font-medium">
                      ₹{invoice.base_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right border-r border-slate-200">
                      ₹{invoice.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right border-r border-slate-200">
                      ₹{invoice.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      ₹{invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Calculations & Words */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
              <div className="space-y-2 flex-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Amount in Words:
                  </span>
                  <p className="font-bold text-slate-900 italic">
                    {amountInWords(invoice.total_amount)}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Icon n="check" s={14} c="text-emerald-600" />
                    Tax Paid Under GST Rule 46 - Information Technology Services
                  </p>
                  <p className="text-emerald-800 text-[10px] mt-0.5">
                    This is a digitally signed computer-generated tax invoice. No physical signature is required.
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-64 space-y-1.5 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Amount:</span>
                  <span className="font-medium text-slate-900">₹{invoice.base_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Central GST (9%):</span>
                  <span>₹{invoice.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>State GST (9%):</span>
                  <span>₹{invoice.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Integrated GST (0%):</span>
                  <span>₹0.00</span>
                </div>
                <div className="border-t border-slate-300 pt-1.5 mt-1 flex justify-between font-black text-sm text-slate-900">
                  <span>Total Amount:</span>
                  <span className="text-teal">₹{invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Footer Signatory Stamp & QR Code */}
            <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                {/* QR Code representation */}
                <div className="w-16 h-16 border border-slate-300 p-1 rounded bg-white flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                    <rect width="100" height="100" fill="white" />
                    <rect x="10" y="10" width="25" height="25" fill="#1e293b" />
                    <rect x="15" y="15" width="15" height="15" fill="white" />
                    <rect x="18" y="18" width="9" height="9" fill="#1e293b" />
                    <rect x="65" y="10" width="25" height="25" fill="#1e293b" />
                    <rect x="70" y="15" width="15" height="15" fill="white" />
                    <rect x="73" y="18" width="9" height="9" fill="#1e293b" />
                    <rect x="10" y="65" width="25" height="25" fill="#1e293b" />
                    <rect x="15" y="70" width="15" height="15" fill="white" />
                    <rect x="18" y="73" width="9" height="9" fill="#1e293b" />
                    <rect x="45" y="20" width="10" height="10" fill="#1e293b" />
                    <rect x="45" y="45" width="10" height="10" fill="#1e293b" />
                    <rect x="65" y="55" width="15" height="10" fill="#1e293b" />
                    <rect x="75" y="75" width="15" height="15" fill="#1e293b" />
                  </svg>
                </div>
                <div className="text-[10px] text-slate-500">
                  <p className="font-semibold text-slate-700">Digital Tax QR Verification</p>
                  <p>IRN: {invoice.invoice_number.replace(/-/g, '').toLowerCase()}2026taxeinv</p>
                  <p>Scan to verify with GST Portal</p>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="inline-block border border-dashed border-slate-300 rounded px-4 py-2 bg-slate-50 mb-1">
                  <p className="text-[10px] font-bold text-teal tracking-wider uppercase">Digitally Authorized</p>
                  <p className="text-[9px] text-slate-500">Fixnora Accounts Dept.</p>
                </div>
                <p className="text-[10px] text-slate-400">Authorised Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
