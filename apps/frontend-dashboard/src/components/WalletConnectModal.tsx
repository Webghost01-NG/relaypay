import React, { useState } from 'react';
import { Wallet, ShieldCheck, CheckCircle2, X, ExternalLink, RefreshCw } from 'lucide-react';
import { BrowserProvider } from 'ethers';

interface WalletConnectProps {
  isOpen: boolean;
  onClose: () => void;
  account: string | null;
  onAccountConnected: (address: string) => void;
  onAccountDisconnected: () => void;
}

export const WalletConnectModal: React.FC<WalletConnectProps> = ({
  isOpen,
  onClose,
  account,
  onAccountConnected,
  onAccountDisconnected,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const connectEvmWallet = async () => {
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new BrowserProvider((window as any).ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        if (accounts && accounts.length > 0) {
          onAccountConnected(accounts[0]);
          onClose();
        }
      } else {
        setErrorMessage('No EVM wallet extension detected. Please install MetaMask or Coinbase Wallet.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect Web3 wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">Connect Web3 Wallet</h3>
              <p className="text-xs text-slate-500">Flare EVM & XRPL Receipt NFT Manager</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {account ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Wallet Connected</span>
                </span>
                <span className="font-mono-tech">{account.slice(0, 6)}...{account.slice(-4)}</span>
              </div>
              <button
                onClick={() => {
                  onAccountDisconnected();
                  onClose();
                }}
                className="mt-3 w-full rounded-full border border-emerald-600/30 bg-white py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          ) : (
            <>
              {/* EVM Browser Wallet */}
              <button
                onClick={connectEvmWallet}
                disabled={isConnecting}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-900 hover:bg-white transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white group-hover:scale-105 transition-transform">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">MetaMask / Browser Wallet</div>
                    <div className="text-xs text-slate-500">Connect Flare EVM wallet to receive receipts</div>
                  </div>
                </div>
                {isConnecting ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-slate-600" />
                ) : (
                  <span className="text-xs font-bold text-slate-900 group-hover:translate-x-0.5 transition-transform">Connect →</span>
                )}
              </button>

              {/* Xaman XRPL Wallet */}
              <button
                onClick={() => {
                  onAccountConnected('rXrplUserWalletDemo1234567890');
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-900 hover:bg-white transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-600 text-white group-hover:scale-105 transition-transform">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Xaman / Xumm XRPL Wallet</div>
                    <div className="text-xs text-slate-500">Sign native XRP transactions directly</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900 group-hover:translate-x-0.5 transition-transform">Connect →</span>
              </button>
            </>
          )}

          {errorMessage && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-600 border border-rose-200">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
