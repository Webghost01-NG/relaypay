import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Copy,
  CheckCircle2,
  Clock,
  Zap,
  ShieldCheck,
  ExternalLink,
  QrCode,
  Sparkles,
  RefreshCw,
  Wallet,
  Lock,
} from 'lucide-react';

interface CheckoutViewProps {
  invoiceId: string;
  merchantAddress: string;
  xrplDestination: string;
  amountUsdCents: number;
  requiredXrpFormatted: string;
  requiredDrops: string;
  expirationTimestamp: number;
  connectedAccount: string | null;
  onOpenWalletModal: () => void;
  onFulfillSuccess?: (receiptId: number) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  invoiceId,
  xrplDestination,
  amountUsdCents,
  requiredXrpFormatted,
  requiredDrops,
  expirationTimestamp,
  connectedAccount,
  onOpenWalletModal,
  onFulfillSuccess,
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(900);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Live XRPL Payment Listener State
  const [txState, setTxState] = useState<'IDLE' | 'LISTENING' | 'TX_DETECTED' | 'FDC_PROOF_READY' | 'FULFILLED' | 'EXPIRED'>('LISTENING');
  const [receiptTokenId, setReceiptTokenId] = useState<number | null>(null);

  // Generate QR Code as data URL (reliable in React)
  useEffect(() => {
    const payUrl = `xrp:${xrplDestination}?amount=${requiredXrpFormatted}&dt=${invoiceId.slice(0, 10)}`;
    QRCode.toDataURL(payUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url: string) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [xrplDestination, requiredXrpFormatted, invoiceId]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expirationTimestamp - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      if (remaining === 0 && txState !== 'FULFILLED') {
        setTxState('EXPIRED');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expirationTimestamp, txState]);

  const copyToClipboard = (text: string, type: 'address' | 'memo') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else {
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerPercentage = Math.min(100, (timeLeftSeconds / 900) * 100);

  // Simulate Payment / Live FDC Verification Trigger
  const simulatePayment = async () => {
    if (!connectedAccount) return;
    if (txState === 'FULFILLED') return;

    setTxState('TX_DETECTED');
    await new Promise((r) => setTimeout(r, 1500));
    setTxState('FDC_PROOF_READY');

    await new Promise((r) => setTimeout(r, 1800));
    setTxState('FULFILLED');
    const mintedReceiptId = Math.floor(Math.random() * 8999) + 1000;
    setReceiptTokenId(mintedReceiptId);

    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });

    if (onFulfillSuccess) {
      onFulfillSuccess(mintedReceiptId);
    }
  };

  const verificationStages = [
    {
      label: 'XRPL Payment Detected',
      active: txState !== 'IDLE' && txState !== 'LISTENING',
      status: txState !== 'IDLE' && txState !== 'LISTENING' ? 'Confirmed' : 'Listening…',
    },
    {
      label: 'FDC Merkle Proof Consensus',
      active: txState === 'FDC_PROOF_READY' || txState === 'FULFILLED',
      status: txState === 'FDC_PROOF_READY' || txState === 'FULFILLED' ? 'Verified' : 'Pending',
    },
    {
      label: 'Smart Contract Fulfillment',
      active: txState === 'FULFILLED',
      status: txState === 'FULFILLED' ? 'Fulfilled' : 'Pending',
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">

      {/* Page Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-700">
          <span className="pulse-dot-green"></span>
          <span>Step 2 of 3 — Pay Native XRP</span>
        </div>
        <h1 className="mt-4 font-display text-4xl md:text-[2.75rem] font-extrabold text-slate-900 leading-[1.08]">
          Complete your Payment
        </h1>
        <p className="mt-2 text-[15px] text-slate-500 max-w-xl leading-relaxed">
          Send native XRP to the merchant's XRPL address. Flare Data Connector verifies the transaction on-chain to trigger automatic fulfillment.
        </p>
      </div>

      {/* ─── Two Column Grid ─── */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">

        {/* ═══ LEFT: Payment Card ═══ */}
        <div className={`card-light p-7 transition-all duration-300 ${txState === 'FULFILLED' ? 'border-emerald-400 shadow-emerald-100/60 shadow-lg' : ''}`}>

          {/* Invoice Summary Row */}
          <div className="flex items-start justify-between pb-5 border-b border-slate-100">
            <div>
              <p className="text-[11px] font-mono-tech text-slate-400 tracking-wide uppercase">Invoice</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate max-w-[240px]">
                {invoiceId.slice(0, 14)}…{invoiceId.slice(-8)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">Total Due</p>
              <p className="text-2xl font-extrabold text-slate-900 font-display tracking-tight">
                ${(amountUsdCents / 100).toFixed(2)}
              </p>
            </div>
          </div>

          {/* XRP Amount Callout */}
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-50 to-sky-50/40 border border-slate-200/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">XRP Settlement Amount</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono-tech text-3xl font-extrabold text-slate-900">{requiredXrpFormatted}</span>
                  <span className="text-sm font-bold text-sky-600">XRP</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-mono-tech">{Number(requiredDrops).toLocaleString()} drops</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>FTSO v2 Oracle Rate</span>
                </div>
                <span className="font-mono-tech text-xs font-bold text-slate-700">1 XRP = $0.50</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all duration-1000"
                      style={{ width: `${timerPercentage}%` }}
                    />
                  </div>
                  <span className={`font-mono-tech text-[11px] font-bold ${timeLeftSeconds < 60 ? 'text-rose-500' : 'text-slate-600'}`}>
                    {formatCountdown(timeLeftSeconds)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code + Scan Prompt */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm flex-shrink-0">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="XRPL Payment QR Code"
                  width={180}
                  height={180}
                  className="rounded-xl"
                />
              ) : (
                <div className="h-[180px] w-[180px] rounded-xl bg-slate-100 grid place-items-center">
                  <QrCode className="h-10 w-10 text-slate-300" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-bold text-slate-900">
                <QrCode className="h-4 w-4 text-sky-600" />
                <span>Scan with Xaman Wallet</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Open Xaman (Xumm) on your phone and scan this QR code, or copy the destination address and memo below to pay manually.
              </p>
              <a
                href={`xrp:${xrplDestination}?amount=${requiredXrpFormatted}&dt=${invoiceId.slice(0, 10)}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors"
              >
                <span>Open in Native Wallet</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Copy Fields */}
          <div className="mt-5 space-y-3">
            {/* Destination */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">XRPL Destination</label>
                <span className="text-[10px] font-bold text-sky-600 font-mono-tech">REQUIRED</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="font-mono-tech text-xs text-slate-800 truncate flex-1">{xrplDestination}</span>
                <button
                  onClick={() => copyToClipboard(xrplDestination, 'address')}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-slate-400 transition-all flex-shrink-0"
                >
                  {copiedAddress ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedAddress ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
            {/* Memo */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Invoice Memo</label>
                <span className="text-[10px] font-bold text-amber-600 font-mono-tech">DO NOT OMIT</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5">
                <span className="font-mono-tech text-[11px] text-amber-900 truncate flex-1">{invoiceId}</span>
                <button
                  onClick={() => copyToClipboard(invoiceId, 'memo')}
                  className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:border-amber-500 transition-all flex-shrink-0"
                >
                  {copiedMemo ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedMemo ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Zone */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">

            {/* Wallet Status */}
            {connectedAccount ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800 font-semibold">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Wallet: {connectedAccount.slice(0, 6)}…{connectedAccount.slice(-4)}</span>
                </span>
                <span className="text-[10px] font-mono-tech text-emerald-600 uppercase">Receipt Recipient</span>
              </div>
            ) : (
              <button
                onClick={onOpenWalletModal}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-all shadow-md active:scale-[0.97]"
              >
                <Wallet className="h-4 w-4" />
                <span>Connect EVM Wallet to Continue</span>
              </button>
            )}

            {/* Simulate Payment Button */}
            <button
              onClick={simulatePayment}
              disabled={!connectedAccount || txState === 'FULFILLED' || txState === 'TX_DETECTED' || txState === 'FDC_PROOF_READY'}
              className={`w-full flex items-center justify-center gap-2.5 rounded-full px-6 py-4 text-sm font-bold transition-all ${
                txState === 'FULFILLED'
                  ? 'bg-emerald-600 text-white cursor-default shadow-lg shadow-emerald-200/50'
                  : !connectedAccount
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : txState === 'TX_DETECTED' || txState === 'FDC_PROOF_READY'
                      ? 'bg-sky-600 text-white cursor-wait'
                      : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200/60 active:scale-[0.98]'
              }`}
            >
              {txState === 'FULFILLED' ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Payment Verified & Receipt Minted</span>
                </>
              ) : txState === 'TX_DETECTED' || txState === 'FDC_PROOF_READY' ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Verifying via Flare Data Connector…</span>
                </>
              ) : !connectedAccount ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Connect Wallet First</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>Simulate XRPL Payment (Demo)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═══ RIGHT: Protocol Verification Panel (Dark) ═══ */}
        <aside className="panel-dark p-7 flex flex-col">

          <div className="flex items-center gap-2.5 mb-6">
            <ShieldCheck className="h-5 w-5 text-sky-400" />
            <h2 className="text-lg font-bold text-white">Protocol Verification</h2>
          </div>

          {/* Guarantees */}
          <ul className="space-y-4 mb-8">
            {[
              {
                title: 'FTSO v2 Rate Lock',
                desc: 'Oracle-sourced XRP/USD rate protects merchants from volatility during the quote window.',
              },
              {
                title: 'FDC Merkle Proof',
                desc: 'Flare Data Connector cryptographically attests the XRPL transaction drops, destination, and memo.',
              },
              {
                title: 'On-Chain Receipt NFT',
                desc: 'ERC-721 proof-of-purchase with full-chain SVG artwork, minted to the buyer\u2019s EVM wallet.',
              },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold">✓</span>
                <span className="text-slate-400">
                  <strong className="text-slate-200">{item.title}:</strong>{' '}
                  {item.desc}
                </span>
              </li>
            ))}
          </ul>

          {/* Live Verification Stream */}
          <div className="rounded-2xl border border-white/8 bg-[#060810] p-5 flex-1">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Live Verification</span>
              <span className="pulse-dot-green"></span>
            </div>

            <div className="space-y-5">
              {verificationStages.map((stage, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2.5 w-2.5 rounded-full transition-colors duration-500 ${stage.active ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                    <span className={`text-xs transition-colors ${stage.active ? 'text-white font-medium' : 'text-slate-500'}`}>
                      {idx + 1}. {stage.label}
                    </span>
                  </div>
                  <span className={`font-mono-tech text-[10px] ${stage.active ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {stage.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Tx Hash Display (after detection) */}
            {(txState === 'TX_DETECTED' || txState === 'FDC_PROOF_READY' || txState === 'FULFILLED') && (
              <div className="mt-5 pt-4 border-t border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">XRPL Tx Hash</p>
                <p className="font-mono-tech text-[11px] text-sky-400 truncate">
                  {invoiceId.slice(0, 42)}…
                </p>
              </div>
            )}
          </div>

          {/* Receipt NFT Card */}
          {receiptTokenId && (
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  <span>Receipt NFT #{receiptTokenId}</span>
                </span>
                <span className="font-mono-tech text-[10px] text-emerald-500">ERC-721</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Minted to {connectedAccount?.slice(0, 6)}…{connectedAccount?.slice(-4)} on Flare EVM.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
