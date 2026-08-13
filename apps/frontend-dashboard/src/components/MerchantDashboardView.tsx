import React, { useState } from 'react';
import { PlusCircle, Zap, Wallet, FileText, Lock } from 'lucide-react';

interface InvoiceRecord {
  invoiceId: string;
  merchant: string;
  xrplDestination: string;
  amountUsdCents: number;
  requiredXrpFormatted: string;
  status: 'PENDING' | 'FULFILLED' | 'EXPIRED' | 'UNDERPAID';
  createdAt: string;
  receiptTokenId?: number;
}

interface MerchantDashboardViewProps {
  onCreateInvoice: (data: {
    productName: string;
    amountUsdCents: number;
    durationSeconds: number;
    xrplDestination: string;
  }) => void;
  invoices: InvoiceRecord[];
  connectedAccount: string | null;
  onOpenWalletModal: () => void;
}

export const MerchantDashboardView: React.FC<MerchantDashboardViewProps> = ({
  onCreateInvoice,
  invoices,
  connectedAccount,
  onOpenWalletModal,
}) => {
  const [productName, setProductName] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [xrplDestination, setXrplDestination] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isFormValid = productName.trim() !== '' && parseFloat(amountUsd) > 0 && xrplDestination.trim().startsWith('r');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectedAccount || !isFormValid) return;

    setIsCreating(true);
    setTimeout(() => {
      onCreateInvoice({
        productName,
        amountUsdCents: Math.round(parseFloat(amountUsd || '0') * 100),
        durationSeconds: parseInt(durationMinutes, 10) * 60,
        xrplDestination,
      });
      setProductName('');
      setAmountUsd('');
      setXrplDestination('');
      setIsCreating(false);
    }, 500);
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
    UNDERPAID: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          <FileText className="h-3.5 w-3.5 text-sky-600" />
          <span>Merchant Integration Hub</span>
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold text-slate-900 leading-[1.08] tracking-tight">
          Merchant Portal
        </h1>
        <p className="mt-2 text-[15px] text-slate-500 leading-relaxed max-w-xl">
          Generate FTSO-rate locked XRP invoices. Each invoice creates an on-chain record verified by the Flare Data Connector.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">

        {/* ─── Create Invoice Form ─── */}
        <section className="card-light p-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-5">
            <PlusCircle className="h-5 w-5 text-sky-600" />
            <span>New XRP Invoice</span>
          </h2>

          {!connectedAccount ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 border border-slate-200">
                <Lock className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 font-medium mb-1">Wallet Required</p>
              <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">Connect your EVM wallet to create invoices. Your wallet address will be the merchant beneficiary.</p>
              <button
                onClick={onOpenWalletModal}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-md active:scale-[0.97]"
              >
                <Wallet className="h-4 w-4" />
                <span>Connect Wallet</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1 uppercase tracking-wide">Product / Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pro Digital License"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1 uppercase tracking-wide">Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-mono-tech text-slate-900 placeholder:text-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1 uppercase tracking-wide">Quote Duration</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">1 Hour</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1 uppercase tracking-wide">XRPL Receiving Address</label>
                <input
                  type="text"
                  placeholder="rYourXRPLAddress..."
                  value={xrplDestination}
                  onChange={(e) => setXrplDestination(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono-tech text-slate-900 placeholder:text-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || !isFormValid}
                className={`w-full mt-2 py-3 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  isFormValid
                    ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md active:scale-[0.97]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Zap className="h-4 w-4" />
                <span>{isCreating ? 'Creating…' : 'Generate FTSO Invoice'}</span>
              </button>
            </form>
          )}
        </section>

        {/* ─── Invoice History ─── */}
        <section className="card-light p-6">
          <h2 className="text-base font-bold text-slate-900 mb-5">Invoice History</h2>

          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 border border-slate-100">
                <FileText className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No invoices yet</p>
              <p className="text-xs text-slate-400 mt-1">Create your first invoice to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-mono-tech uppercase tracking-wider">
                    <th className="pb-3 pr-4">Invoice ID</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 pr-4 font-mono-tech text-sky-700 font-medium">
                        {inv.invoiceId.slice(0, 10)}…{inv.invoiceId.slice(-6)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono-tech font-bold text-slate-900">${(inv.amountUsdCents / 100).toFixed(2)}</span>
                        <span className="text-slate-400 ml-1">({inv.requiredXrpFormatted} XRP)</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColors[inv.status] || ''}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 font-mono-tech text-slate-500">
                        {inv.receiptTokenId ? `#${inv.receiptTokenId}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
