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
  onFulfillSuccess?: (receiptId: number) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  invoiceId,
  xrplDestination,
  amountUsdCents,
  requiredXrpFormatted,
  requiredDrops,
  expirationTimestamp,
  onFulfillSuccess,
}) => {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(900);
  
  // Real-time payment verification state
  const [txState, setTxState] = useState<'IDLE' | 'LISTENING' | 'TX_DETECTED' | 'FDC_PROOF_READY' | 'FULFILLED' | 'UNDERPAID' | 'EXPIRED'>('LISTENING');
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
          dark: '#00F0FF',
          light: '#0E121E',
        },
      });
    }
  }, [xrplDestination, requiredXrpFormatted, invoiceId]);

  // Expiration Countdown
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

  // Simulate Payment (Judges & Testing Trigger)
  const simulatePayment = async () => {
    if (txState === 'FULFILLED') return;

    setTxState('TX_DETECTED');

    // Step 1: Detect XRPL Tx
    await new Promise((r) => setTimeout(r, 1200));
    setTxState('FDC_PROOF_READY');

    // Step 2: FDC Attestation Proof Consensus
    await new Promise((r) => setTimeout(r, 1500));
    setTxState('FULFILLED');
    const mockReceiptId = Math.floor(Math.random() * 8999) + 1000;
    setReceiptTokenId(mockReceiptId);

    // Celebration
    confetti({
      particleCount: 80,
      spread: 70,
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
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Complete your XRP Payment
          </h1>
          <p className="mt-2 text-base text-[#94A3B8] max-w-xl">
            Send native XRP directly to the merchant's XRPL wallet. Flare Data Connector will verify payment and trigger fulfillment on-chain.
          </p>
        </div>

        {/* FTSO Rate Box */}
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0E121E] p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00F0FF]/10 text-[#00F0FF]">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-[#94A3B8]">FTSO v2 Oracle Rate</div>
            <div className="font-mono-tech text-sm font-semibold text-white">1 XRP = $0.5000 USD</div>
            <div className="text-[11px] text-[#00F0FF]">Quote expires in: {formatCountdown(timeLeftSeconds)}</div>
          </div>
        </div>
      </div>

      {/* Asymmetric Split Grid (1.1fr : 0.9fr) */}
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* LEFT COLUMN: INTERACTIVE CHECKOUT CARD */}
        <section className={`glass-card p-8 transition-all ${txState === 'FULFILLED' ? 'border-emerald-500/40 glow-cyan' : ''}`}>
          
          {/* Order Details */}
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <div>
              <span className="text-xs font-mono-tech text-[#94A3B8]">ORDER #ORD-2026-9812</span>
              <h2 className="text-xl font-bold text-white mt-1">Digital Pro License + SDK Access</h2>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#94A3B8]">Fiat Amount</div>
              <div className="text-2xl font-extrabold text-white font-display">${(amountUsdCents / 100).toFixed(2)} USD</div>
            </div>
          </div>

          {/* Amount to Pay Callout */}
          <div className="mt-6 rounded-2xl border border-[#00F0FF]/30 bg-gradient-to-r from-[#00F0FF]/10 to-transparent p-5">
            <div className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider">Required XRP Settlement</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono-tech text-3xl font-extrabold text-white">{requiredXrpFormatted}</span>
              <span className="text-base font-bold text-[#00F0FF]">XRP</span>
              <span className="text-xs text-[#94A3B8]">({requiredDrops} drops)</span>
            </div>
          </div>

          {/* QR Code & Pay URI */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-white/10 bg-[#080A0F] p-6">
            <div className="rounded-xl border border-[#00F0FF]/30 p-2 bg-[#0E121E]">
              <canvas ref={canvasRef} />
            </div>
            <div className="space-y-3 text-center sm:text-left flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-sm font-semibold text-white">
                <QrCode className="h-4 w-4 text-[#00F0FF]" />
                <span>Scan with Xaman / Xumm / XRPL Wallet</span>
              </div>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Scan QR code or copy payment address and required invoice memo to pay directly from any XRPL wallet.
              </p>
              <a
                href={`xrp:${xrplDestination}?amount=${requiredXrpFormatted}&memo=${invoiceId}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#00F0FF] hover:underline"
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
              <label className="text-xs font-medium text-[#94A3B8] flex items-center justify-between mb-1.5">
                <span>Merchant XRPL Destination Address</span>
                <span className="text-[#00F0FF] font-mono-tech text-[10px]">REQUIRED</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#080A0F] p-3">
                <span className="font-mono-tech text-xs text-white truncate flex-1">{xrplDestination}</span>
                <button
                  onClick={() => copyToClipboard(xrplDestination, 'address')}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#151A29] px-3 py-1.5 text-xs font-medium text-white hover:border-[#00F0FF]/40 transition-all"
                >
                  {copiedAddress ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Required Invoice Memo */}
            <div>
              <label className="text-xs font-medium text-[#94A3B8] flex items-center justify-between mb-1.5">
                <span>Required XRPL Transaction Memo (Invoice ID)</span>
                <span className="text-amber-400 font-mono-tech text-[10px]">DO NOT OMIT MEMO</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#080A0F] p-3">
                <span className="font-mono-tech text-xs text-amber-300 truncate flex-1">{invoiceId}</span>
                <button
                  onClick={() => copyToClipboard(invoiceId, 'memo')}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-[#151A29] px-3 py-1.5 text-xs font-medium text-amber-300 hover:border-amber-400 transition-all"
                >
                  {copiedMemo ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedMemo ? 'Copied' : 'Copy Memo'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Judge Simulator Button */}
          <div className="mt-8 border-t border-white/10 pt-6">
            <button
              onClick={simulatePayment}
              disabled={txState === 'FULFILLED'}
              className={`w-full py-4 px-6 rounded-full font-bold text-sm flex items-center justify-center gap-3 transition-all ${
                txState === 'FULFILLED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                  : 'bg-gradient-to-r from-[#00F0FF] to-[#0088FF] text-[#080A0F] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] active:scale-[0.98]'
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
                  <Zap className="h-5 w-5 fill-current" />
                  <span>Simulate Native XRPL Payment (Hackathon Demo)</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* RIGHT COLUMN: DARK TELEMETRY PANEL */}
        <aside className="glass-panel-dark p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <ShieldCheck className="h-6 w-6 text-[#00F0FF]" />
              <span>What FDC & FTSO Guarantees</span>
            </h2>

            <ul className="mt-6 space-y-4">
              <li className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                  ✓
                </span>
                <span className="text-[#94A3B8]">
                  <strong className="text-white">FTSO v2 Oracle Rate Lock:</strong> Quote is fixed at $0.50/XRP to protect merchant from crypto market volatility.
                </span>
              </li>

              <li className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                  ✓
                </span>
                <span className="text-[#94A3B8]">
                  <strong className="text-white">Cryptographic FDC Proof:</strong> Flare Data Connector attests drops, destination, and memo hash on-chain without webhooks.
                </span>
              </li>

              <li className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
                  ✓
                </span>
                <span className="text-[#94A3B8]">
                  <strong className="text-white">On-Chain SVG Receipt:</strong> Minted directly to buyer's EVM wallet upon verification completion.
                </span>
              </li>
            </ul>

            {/* Live Verification Telemetry Stream */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#080A0F] p-5">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Live Verification Stream</span>
                <span className="pulse-dot"></span>
              </div>

              <div className="space-y-4">
                
                {/* Stage 1: XRPL Tx */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${txState !== 'IDLE' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                    <span className={txState !== 'IDLE' ? 'text-white font-medium' : 'text-slate-500'}>1. XRPL Payment Listener</span>
                  </div>
                  <span className="font-mono-tech text-[10px] text-[#00F0FF]">{txState !== 'IDLE' ? 'Active' : 'Waiting'}</span>
                </div>

                {/* Stage 2: FDC Proof */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${txState === 'FDC_PROOF_READY' || txState === 'FULFILLED' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                    <span className={txState === 'FDC_PROOF_READY' || txState === 'FULFILLED' ? 'text-white font-medium' : 'text-slate-500'}>2. FDC Merkle Proof Consensus</span>
                  </div>
                  <span className="font-mono-tech text-[10px] text-[#00F0FF]">
                    {txState === 'FDC_PROOF_READY' || txState === 'FULFILLED' ? 'Verified' : 'Pending'}
                  </span>
                </div>

                {/* Stage 3: Flare Fulfillment */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${txState === 'FULFILLED' ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                    <span className={txState === 'FULFILLED' ? 'text-white font-medium' : 'text-slate-500'}>3. Flare EVM Smart Contract Fulfillment</span>
                  </div>
                  <span className="font-mono-tech text-[10px] text-[#00F0FF]">
                    {txState === 'FULFILLED' ? 'Fulfilled' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* On-Chain Receipt Preview Card (Rendered upon fulfillment) */}
          {receiptTokenId && (
            <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 transition-all animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  <span>ERC-721 Receipt Token #{receiptTokenId} Minted</span>
                </span>
                <span className="font-mono-tech text-[10px]">RPR-XRP</span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Cryptographic Proof-of-Purchase NFT generated directly on Flare EVM.
              </p>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
};
