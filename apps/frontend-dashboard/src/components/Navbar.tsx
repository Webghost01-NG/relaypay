import React from 'react';
import { Zap, Wallet, Github } from 'lucide-react';

interface NavbarProps {
  currentRole: 'checkout' | 'merchant';
  onRoleChange: (role: 'checkout' | 'merchant') => void;
  connectedAccount: string | null;
  onOpenWalletModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  connectedAccount,
  onOpenWalletModal,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white shadow-md">
            <Zap className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-extrabold tracking-tight text-slate-900">RELAYPAY</span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-sky-700 uppercase">
                XRPL + FLARE
              </span>
            </div>
            <p className="text-xs text-slate-500">Non-Custodial XRP Merchant Checkout & SDK</p>
          </div>
        </div>

        {/* Role Switcher & Real Wallet Connect Button */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="pulse-dot-green"></span>
            <span>Flare Coston2 Live</span>
          </div>

          <div className="flex items-center rounded-full border border-slate-200 bg-slate-100 p-1">
            <button
              onClick={() => onRoleChange('checkout')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                currentRole === 'checkout'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buyer Checkout
            </button>
            <button
              onClick={() => onRoleChange('merchant')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                currentRole === 'merchant'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Merchant Portal
            </button>
          </div>

          {/* Web3 Wallet Connect Button */}
          <button
            onClick={onOpenWalletModal}
            className="flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          >
            <Wallet className="h-4 w-4" />
            <span>
              {connectedAccount
                ? `${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`
                : 'Connect Wallet'}
            </span>
          </button>

          <a
            href="https://github.com/Webghost01-NG/relaypay"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <Github className="h-4 w-4" />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
};
