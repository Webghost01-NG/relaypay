import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { StepBadge } from './StepBadge';

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

  // Live XRPL Payment Listener State
  const [txState, setTxState] = useState<'IDLE' | 'LISTENING' | 'TX_DETECTED' | 'FDC_PROOF_READY' | 'FULFILLED' | 'EXPIRED'>('LISTENING');
  const [receiptTokenId, setReceiptTokenId] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR Code
  useEffect(() => {
    const payUrl = `xrp:${xrplDestination}?amount=${requiredXrpFormatted}&memo=${invoiceId}`;
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, payUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      });
    }
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
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  // Simulate Payment / Live FDC Verification Trigger
  const simulatePayment = async () => {
    if (txState === 'FULFILLED') return;

    setTxState('TX_DETECTED');
    await new Promise((r) => setTimeout(r, 1200));
    setTxState('FDC_PROOF_READY');

    await new Promise((r) => setTimeout(r, 1500));
    setTxState('FULFILLED');
    const mockReceiptId = Math.floor(Math.random() * 8999) + 1000;
    setReceiptTokenId(mockReceiptId);

    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
    });

    if (onFulfillSuccess) {
      onFulfillSuccess(mockReceiptId);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <StepBadge currentStep={2} totalSteps={3} label="Pay Native XRP" />
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.05] tracking-tight">
            Complete your XRP Payment
          </h1>
          <p className="mt-2 text-base text-slate-600 max-w-xl">
            Send native XRP directly to the merchant's XRPL wallet. Flare Data Connector attests drops & memo on-chain to trigger non-custodial fulfillment.
          </p>
        </div>

        {/* FTSO Rate Badge */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">FTSO v2 Oracle Rate</div>
            <div className="font-mono-tech text-sm font-bold text-slate-900">1 XRP = $0.5000 USD</div>
            <div className="text-[11px] text-sky-600 font-semibold">Quote expires in: {formatCountdown(timeLeftSeconds)}</div>
          </div>
        </div>
      </div>

      {/* Asymmetric Split Grid (1.1fr : 0.9fr) */}
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* LEFT COLUMN: CRISP LIGHT ACTION CARD */}
        <section className={`light-card p-8 transition-all ${txState === 'FULFILLED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}`}>
          
          {/* Order Details Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div>
              <span className="text-xs font-mono-tech text-slate-500">ORDER #ORD-2026-9812</span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Digital Pro License + SDK Access</h2>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Fiat Amount</div>
              <div className="text-2xl font-extrabold text-slate-900 font-display">${(amountUsdCents / 100).toFixed(2)} USD</div>
            </div>
          </div>

          {/* Amount to Pay Callout */}
          <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
            <div className="text-xs font-bold text-sky-700 uppercase tracking-wider">Required XRP Settlement</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono-tech text-3xl font-extrabold text-slate-900">{requiredXrpFormatted}</span>
              <span className="text-base font-bold text-sky-600">XRP</span>
              <span className="text-xs text-slate-500">({requiredDrops} drops)</span>
            </div>
          </div>

          {/* QR Code & Pay URI */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
            <div className="rounded-xl border border-slate-200 p-2 bg-white shadow-sm">
              <canvas ref={canvasRef} />
            </div>
            <div className="space-y-3 text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-bold text-slate-900">
                <QrCode className="h-4 w-4 text-sky-600" />
                <span>Scan via Xaman / Xumm Wallet</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Scan QR code or copy payment address and required invoice memo to pay directly from any XRPL wallet.
              </p>
              <a
                href={`xrp:${xrplDestination}?amount=${requiredXrpFormatted}&memo=${invoiceId}`}
                className="inline-flex items-center gap-2 text-xs font-bold text-sky-600 hover:underline"
              >
                <span>Open in Native XRPL Wallet</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Destination Address & Required Memo Inputs */}
          <div className="mt-6 space-y-4">
            
            {/* XRPL Address */}
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                <span>Merchant XRPL Destination Address</span>
                <span className="text-sky-600 font-mono-tech text-[10px]">REQUIRED</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="font-mono-tech text-xs text-slate-900 truncate flex-1">{xrplDestination}</span>
                <button
                  onClick={() => copyToClipboard(xrplDestination, 'address')}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-slate-900 transition-all shadow-sm"
                >
                  {copiedAddress ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Required Invoice Memo */}
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                <span>Required XRPL Transaction Memo (Invoice ID)</span>
                <span className="text-amber-600 font-mono-tech text-[10px]">DO NOT OMIT MEMO</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50/50 p-3">
                <span className="font-mono-tech text-xs text-amber-900 truncate flex-1">{invoiceId}</span>
                <button
                  onClick={() => copyToClipboard(invoiceId, 'memo')}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:border-amber-900 transition-all shadow-sm"
                >
                  {copiedMemo ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedMemo ? 'Copied' : 'Copy Memo'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Web3 EVM Wallet Connector & Simulation Controls */}
          <div className="mt-8 border-t border-slate-100 pt-6 space-y-3">
            {!connectedAccount ? (
              <button
                onClick={onOpenWalletModal}
                className="w-full py-3.5 px-6 rounded-full font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                <span>Connect Wallet to Receive ERC-721 NFT</span>
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>EVM Wallet Connected: {connectedAccount.slice(0, 6)}...{connectedAccount.slice(-4)}</span>
                </span>
                <span className="text-[10px] font-mono-tech text-emerald-600">RECEIPT RECIPIENT</span>
              </div>
            )}

            {/* Simulation Trigger Button */}
            <button
              onClick={simulatePayment}
              disabled={txState === 'FULFILLED'}
              className={`w-full py-4 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-3 transition-all ${
                txState === 'FULFILLED'
                  ? 'bg-emerald-600 text-white shadow-md cursor-default'
                  : 'bg-gradient-to-r from-sky-500 to-slate-900 text-white hover:shadow-lg active:scale-[0.98]'
              }`}
            >
              {txState === 'FULFILLED' ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Payment Cryptographically Verified & Fulfilled!</span>
                </>
              ) : txState === 'TX_DETECTED' || txState === 'FDC_PROOF_READY' ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Verifying FDC Proof on Flare EVM...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 fill-current text-sky-300" />
                  <span>Simulate Native XRPL Payment (Hackathon Demo)</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* RIGHT COLUMN: HIGH-CONTRAST DARK OBSIDIAN PROTOCOL PANEL */}
        <aside className="dark-panel p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <ShieldCheck className="h-6 w-6 text-sky-400" />
              <span>What FDC & FTSO Guarantees</span>
            </h2>

            <ul className="mt-6 space-y-4">
              <li className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sky-400 font-bold">
                  ✓
                </span>
                <span className="text-slate-300">
                  <strong className="text-white">FTSO v2 Oracle Rate Lock:</strong> Quote is fixed at $0.50/XRP to protect merchant from crypto market volatility.
                </span>
              </li>

              <li className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sky-400 font-bold">
                  ✓
                </span>
                <span className="text-slate-300">
                  <strong className="text-white">Cryptographic FDC Proof:</strong> Flare Data Connector attests drops, destination, and memo hash on-chain without webhooks.
                </span>
              </li>

              <li className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sky-400 font-bold">
                  ✓
                </span>
                <span className="text-slate-300">
                  <strong className="text-white">On-Chain SVG Receipt:</strong> Minted directly to buyer's EVM wallet upon verification completion.
                </span>
              </li>
            </ul>

            {/* Live Verification Telemetry Stream */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#080A0F] p-5">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Live Verification Stream</span>
                <span className="pulse-dot-green"></span>
              </div>

              <div className="space-y-4">
                
                {/* Stage 1: XRPL Tx */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${txState !== 'IDLE' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                    <span className={txState !== 'IDLE' ? 'text-white font-medium' : 'text-slate-500'}>1. XRPL Payment Listener</span>
                  </div>
                  <span className="font-mono-tech text-[10px] text-sky-400">{txState !== 'IDLE' ? 'Active' : 'Waiting'}</span>
                </div>

                {/* Stage 2: FDC Proof */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${txState === 'FDC_PROOF_READY' || txState === 'FULFILLED' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                    <span className={txState === 'FDC_PROOF_READY' || txState === 'FULFILLED' ? 'text-white font-medium' : 'text-slate-500'}>2. FDC Merkle Proof Consensus</span>
                  </div>
                  <span className="font-mono-tech text-[10px] text-sky-400">
                    {txState === 'FDC_PROOF_READY' || txState === 'FULFILLED' ? 'Verified' : 'Pending'}
                  </span>
                </div>

                {/* Stage 3: Flare Fulfillment */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${txState === 'FULFILLED' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                    <span className={txState === 'FULFILLED' ? 'text-white font-medium' : 'text-slate-500'}>3. Flare EVM Smart Contract Fulfillment</span>
                  </div>
                  <span className="font-mono-tech text-[10px] text-sky-400">
                    {txState === 'FULFILLED' ? 'Fulfilled' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* On-Chain Receipt Preview Card */}
          {receiptTokenId && (
            <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  <span>ERC-721 Receipt Token #{receiptTokenId} Minted</span>
                </span>
                <span className="font-mono-tech text-[10px]">RPR-XRP</span>
              </div>
              <p className="text-xs text-slate-300">
                Cryptographic Proof-of-Purchase NFT generated directly on Flare EVM.
              </p>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
};
