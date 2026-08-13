import React, { useState } from 'react';
import { PlusCircle, Zap } from 'lucide-react';

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
}

export const MerchantDashboardView: React.FC<MerchantDashboardViewProps> = ({
  onCreateInvoice,
  invoices,
}) => {
  const [productName, setProductName] = useState('Pro Digital Subscription');
  const [amountUsd, setAmountUsd] = useState('49.99');
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [xrplDestination, setXrplDestination] = useState('rMerchantAddress1234567890abcdef');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    setTimeout(() => {
      onCreateInvoice({
        productName,
        amountUsdCents: Math.round(parseFloat(amountUsd || '0') * 100),
        durationSeconds: parseInt(durationMinutes, 10) * 60,
        xrplDestination,
      });
      setIsCreating(false);
    }, 600);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0E121E] px-3.5 py-1.5 text-xs font-semibold text-[#00F0FF]">
            <span>Merchant Integration Hub</span>
          </div>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-white">Merchant Portal</h1>
          <p className="mt-1 text-base text-[#94A3B8]">
            Generate FTSO-rate locked XRP invoices, view verified customer payments, and manage fulfillment settings.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        {/* Create Invoice Form */}
        <section className="glass-card p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
            <PlusCircle className="h-5 w-5 text-[#00F0FF]" />
            <span>Generate New XRP Invoice</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#94A3B8] block mb-1">Product SKU / Item Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#080A0F] p-3 text-sm text-white focus:border-[#00F0FF] focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1">Price ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#080A0F] p-3 text-sm font-mono-tech text-white focus:border-[#00F0FF] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1">Quote Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#080A0F] p-3 text-sm text-white focus:border-[#00F0FF] focus:outline-none"
                >
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[#94A3B8] block mb-1">XRPL Destination Address</label>
              <input
                type="text"
                value={xrplDestination}
                onChange={(e) => setXrplDestination(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#080A0F] p-3 text-xs font-mono-tech text-white focus:border-[#00F0FF] focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full mt-4 py-3.5 px-6 rounded-full font-bold text-sm bg-gradient-to-r from-[#00F0FF] to-[#0088FF] text-[#080A0F] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>{isCreating ? 'Creating Invoice...' : 'Generate FTSO Invoice'}</span>
            </button>
          </form>
        </section>

        {/* Historical Invoices Table */}
        <section className="glass-card p-6">
          <h2 className="text-xl font-bold text-white mb-6">Recent Customer Invoices</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#94A3B8] font-mono-tech">
                  <th className="pb-3">INVOICE ID</th>
                  <th className="pb-3">AMOUNT</th>
                  <th className="pb-3">STATUS</th>
                  <th className="pb-3">RECEIPT NFT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-mono-tech text-[#00F0FF]">
                      {inv.invoiceId.slice(0, 10)}...{inv.invoiceId.slice(-6)}
                    </td>
                    <td className="py-3 font-mono-tech text-white">
                      ${(inv.amountUsdCents / 100).toFixed(2)} ({inv.requiredXrpFormatted} XRP)
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          inv.status === 'FULFILLED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono-tech text-slate-400">
                      {inv.receiptTokenId ? `#${inv.receiptTokenId}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
