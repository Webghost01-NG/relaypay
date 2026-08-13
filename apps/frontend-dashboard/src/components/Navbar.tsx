import React from 'react';
import { Zap, Github } from 'lucide-react';

interface NavbarProps {
  currentRole: 'checkout' | 'merchant';
  onRoleChange: (role: 'checkout' | 'merchant') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRole, onRoleChange }) => {
  return (
    <header className="border-b border-white/10 bg-[#080A0F]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#00F0FF] to-[#0088FF] text-[#080A0F] shadow-[0_0_20px_rgba(0,240,255,0.4)]">
            <Zap className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-extrabold tracking-tight text-white">RELAYPAY</span>
              <span className="rounded-full bg-[#00F0FF]/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#00F0FF] uppercase border border-[#00F0FF]/20">
                XRPL + FLARE
              </span>
            </div>
            <p className="text-xs text-[#94A3B8]">Non-Custodial XRP Merchant Checkout & SDK</p>
          </div>
        </div>

        {/* Status Pill & Role Switcher */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <span className="pulse-dot"></span>
            <span>Coston2 Testnet Live</span>
          </div>

          <div className="flex items-center rounded-full border border-white/10 bg-[#0E121E] p-1">
            <button
              onClick={() => onRoleChange('checkout')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                currentRole === 'checkout'
                  ? 'bg-[#00F0FF] text-[#080A0F] shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Buyer Checkout
            </button>
            <button
              onClick={() => onRoleChange('merchant')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                currentRole === 'merchant'
                  ? 'bg-[#00F0FF] text-[#080A0F] shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Merchant Portal
            </button>
          </div>

          <a
            href="https://github.com/Webghost01-NG/relaypay"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0E121E] px-3.5 py-1.5 text-xs font-medium text-[#94A3B8] hover:border-[#00F0FF]/40 hover:text-white transition-all"
          >
            <Github className="h-4 w-4" />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
};
