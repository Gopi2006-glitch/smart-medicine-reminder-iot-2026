import React from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';

interface AlertBannerProps {
  activeReminder: {
    active: boolean;
    medicineName: string;
    compartmentId: number;
    time: string;
    attemptNumber?: number;
    maxAttempts?: number;
    snoozeCount?: number;
  } | null;
  onAcknowledge: (compartmentId: number) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  activeReminder,
  onAcknowledge,
}) => {
  if (!activeReminder || !activeReminder.active) return null;

  const attempt = activeReminder.attemptNumber ?? 1;
  const maxAttempts = activeReminder.maxAttempts ?? 3;
  const snoozes = activeReminder.snoozeCount ?? Math.max(0, attempt - 1);

  return (
    <div className="bg-gradient-to-r from-[#151F32] via-[#1E293B] to-[#151F32] text-[#F8FAFC] px-6 py-3.5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#00D6A0] transition-all z-30 print:hidden">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#00D6A0]/20 border border-[#00D6A0]/40 text-[#00D6A0] flex items-center justify-center shrink-0 animate-bounce">
          <BellRing className="w-5 h-5 text-[#00D6A0]" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#00D6A0]/20 text-[#00D6A0] text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#00D6A0]/40">
              MEDICINE REMINDER • ATTEMPT {attempt}/{maxAttempts}
            </span>
            <span className="text-xs text-[#94A3B8] font-medium">
              Snoozes: {snoozes} • 5-min acknowledgement window active
            </span>
          </div>

          <h3 className="text-base font-extrabold tracking-tight mt-0.5 text-[#F8FAFC]">
            Chamber {activeReminder.compartmentId} Open: {activeReminder.medicineName} ({activeReminder.time})
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Press physical Acknowledge button on device or click Acknowledge below to silence buzzer and close chamber.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onAcknowledge(activeReminder.compartmentId)}
          className="bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <CheckCircle2 className="w-4 h-4 text-[#0B1220]" />
          <span>Acknowledge & Close Chamber</span>
        </button>
      </div>
    </div>
  );
};
