import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { CheckoutView } from './components/CheckoutView';
import { MerchantDashboardView } from './components/MerchantDashboardView';
import { WalletConnectModal } from './components/WalletConnectModal';

interface InvoiceItem {
  invoiceId: string;
  merchant: string;
  xrplDestination: string;
  amountUsdCents: number;
  requiredXrpFormatted: string;
  status: 'PENDING' | 'FULFILLED' | 'EXPIRED' | 'UNDERPAID';
  createdAt: string;
  receiptTokenId?: number;
}

export function App() {
  const [currentRole, setCurrentRole] = useState<'checkout' | 'merchant'>('checkout');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);

  // Active Invoice — starts null until merchant creates one or user scans one
  const [activeInvoice, setActiveInvoice] = useState<{
    invoiceId: string;
    merchantAddress: string;
    xrplDestination: string;
    amountUsdCents: number;
    requiredXrpFormatted: string;
    requiredDrops: string;
    expirationTimestamp: number;
  } | null>(null);

  // Invoice history for merchant view — starts empty, no dummy data
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);

  const handleCreateInvoice = (data: {
    productName: string;
    amountUsdCents: number;
    durationSeconds: number;
    xrplDestination: string;
  }) => {
    const newInvoiceId = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    // Live FTSO v2 rate would come from sdk — using placeholder conversion for now
    const xrpUsdRate = 0.5;
    const xrpCalc = (data.amountUsdCents / 100 / xrpUsdRate).toFixed(2);
    const dropsCalc = (parseFloat(xrpCalc) * 1_000_000).toString();

    const newInv = {
      invoiceId: newInvoiceId,
      merchantAddress: connectedAccount || '',
      xrplDestination: data.xrplDestination,
      amountUsdCents: data.amountUsdCents,
      requiredXrpFormatted: xrpCalc,
      requiredDrops: dropsCalc,
      expirationTimestamp: Date.now() + data.durationSeconds * 1000,
    };

    setActiveInvoice(newInv);
    setInvoices((prev) => [
      {
        invoiceId: newInvoiceId,
        merchant: connectedAccount || '',
        xrplDestination: data.xrplDestination,
        amountUsdCents: data.amountUsdCents,
        requiredXrpFormatted: xrpCalc,
        status: 'PENDING',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
      ...prev,
    ]);

    setCurrentRole('checkout');
  };

  const handleFulfillSuccess = (receiptTokenId: number) => {
    if (!activeInvoice) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceId === activeInvoice.invoiceId
          ? { ...inv, status: 'FULFILLED' as const, receiptTokenId }
          : inv
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        connectedAccount={connectedAccount}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
      />

      <main>
        {currentRole === 'checkout' ? (
          activeInvoice ? (
            <CheckoutView
              invoiceId={activeInvoice.invoiceId}
              merchantAddress={activeInvoice.merchantAddress}
              xrplDestination={activeInvoice.xrplDestination}
              amountUsdCents={activeInvoice.amountUsdCents}
              requiredXrpFormatted={activeInvoice.requiredXrpFormatted}
              requiredDrops={activeInvoice.requiredDrops}
              expirationTimestamp={activeInvoice.expirationTimestamp}
              connectedAccount={connectedAccount}
              onOpenWalletModal={() => setIsWalletModalOpen(true)}
              onFulfillSuccess={handleFulfillSuccess}
            />
          ) : (
            /* Empty state: no active invoice yet */
            <div className="mx-auto max-w-2xl px-6 py-24 text-center">
              <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-slate-100 border border-slate-200">
                <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <h2 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">No Active Invoice</h2>
              <p className="mt-3 text-base text-slate-500 leading-relaxed max-w-md mx-auto">
                Switch to the <strong>Merchant Portal</strong> to generate a new XRP invoice with live FTSO rate locking, then return here to complete payment.
              </p>
              <button
                onClick={() => setCurrentRole('merchant')}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-all shadow-md active:scale-[0.97]"
              >
                <span>Go to Merchant Portal</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )
        ) : (
          <MerchantDashboardView
            onCreateInvoice={handleCreateInvoice}
            invoices={invoices}
            connectedAccount={connectedAccount}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
          />
        )}
      </main>

      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        account={connectedAccount}
        onAccountConnected={setConnectedAccount}
        onAccountDisconnected={() => setConnectedAccount(null)}
      />
    </div>
  );
}

export default App;
