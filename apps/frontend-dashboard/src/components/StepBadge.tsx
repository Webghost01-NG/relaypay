import React from 'react';

interface StepBadgeProps {
  currentStep: number;
  totalSteps: number;
  label: string;
}

export const StepBadge: React.FC<StepBadgeProps> = ({ currentStep, totalSteps, label }) => {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/20 bg-[#00F0FF]/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#00F0FF] uppercase">
      <span className="pulse-dot"></span>
      <span>
        Step {currentStep} of {totalSteps}: {label}
      </span>
    </div>
  );
};
