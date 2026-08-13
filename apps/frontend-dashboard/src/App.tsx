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

  // Active Invoice state for checkout view
  const [activeInvoice, setActiveInvoice] = useState({
    invoiceId: '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
    merchantAddress: '0x0000000000000000000000000000000000000000',
    xrplDestination: 'rMerchantAddress1234567890abcdef',
    amountUsdCents: 4999,
    requiredXrpFormatted: '99.98',
    requiredDrops: '99980000',
    expirationTimestamp: Date.now() + 900 * 1000,
  });

  // Table of invoices for merchant view
  const [invoices, setInvoices] = useState<InvoiceItem[]>([
    {
      invoiceId: '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
      merchant: '0x0000000000000000000000000000000000000000',
      xrplDestination: 'rMerchantAddress1234567890abcdef',
      amountUsdCents: 4999,
      requiredXrpFormatted: '99.98',
      status: 'PENDING',
      createdAt: '2026-08-13 09:45:00',
    },
  ]);

  const handleCreateInvoice = (data: {
    productName: string;
    amountUsdCents: number;
    durationSeconds: number;
    xrplDestination: string;
  }) => {
    const newInvoiceId = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const xrpCalc = (data.amountUsdCents / 100 / 0.5).toFixed(2);
    const dropsCalc = (parseFloat(xrpCalc) * 1000000).toString();

    const newInv = {
      invoiceId: newInvoiceId,
      merchantAddress: connectedAccount || '0x0000000000000000000000000000000000000000',
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
        merchant: connectedAccount || '0x0000000000000000000000000000000000000000',
        xrplDestination: data.xrplDestination,
        amountUsdCents: data.amountUsdCents,
        requiredXrpFormatted: xrpCalc,
        status: 'PENDING',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
      ...prev,
    ]);

    // Automatically navigate to checkout view to inspect generated invoice
    setCurrentRole('checkout');
  };

  const handleFulfillSuccess = (receiptTokenId: number) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceId === activeInvoice.invoiceId
          ? { ...inv, status: 'FULFILLED', receiptTokenId }
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
          <MerchantDashboardView onCreateInvoice={handleCreateInvoice} invoices={invoices} />
        )}
      </main>

      {/* Web3 Wallet Connect Modal */}
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
