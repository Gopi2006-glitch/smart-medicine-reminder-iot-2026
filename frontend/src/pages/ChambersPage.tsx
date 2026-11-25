import React, { useState } from 'react';
import {
  DoorOpen,
  DoorClosed,
  ShieldAlert,
  OctagonAlert,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Clock
} from 'lucide-react';
import { ChambersData, ChamberItem } from '../types';

interface ChambersPageProps {
  chambersData: ChambersData | null;
  onOpenChamber: (chamberId: number) => Promise<{ success?: boolean; confirmed?: boolean; status?: string; message?: string; error?: string }>;
  onCloseChamber: (chamberId: number) => Promise<{ success?: boolean; confirmed?: boolean; status?: string; message?: string; error?: string }>;
  onEmergencyStop: () => Promise<void>;
  onClearEmergencyStop: () => Promise<void>;
  onRefresh: () => void;
}

export const ChambersPage: React.FC<ChambersPageProps> = ({
  chambersData,
  onOpenChamber,
  onCloseChamber,
  onEmergencyStop,
  onClearEmergencyStop,
  onRefresh
}) => {
  const [confirmOpenModal, setConfirmOpenModal] = useState<ChamberItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busyChamber, setBusyChamber] = useState<number | null>(null);

  const chambers = chambersData?.chambers || [
    { chamber_id: 1 as const, gpio_pin: 32, medicine_name: 'Chamber 1', scheduled_time: '09:00', schedule_period: 'Morning', status: 'CLOSED', last_operation_at: null },
    { chamber_id: 2 as const, gpio_pin: 26, medicine_name: 'Chamber 2', scheduled_time: '12:30', schedule_period: 'Afternoon', status: 'CLOSED', last_operation_at: null },
    { chamber_id: 3 as const, gpio_pin: 27, medicine_name: 'Chamber 3', scheduled_time: '21:00', schedule_period: 'Night', status: 'CLOSED', last_operation_at: null }
  ];

  const isEstop = !!chambersData?.emergency_stopped;
  const isOnline = !!chambersData?.esp32_online;
  const isDemo = !!chambersData?.is_demo_mode;
  const openAngle = chambersData?.servo_open_angle ?? 90;
  const closeAngle = chambersData?.servo_close_angle ?? 0;

  const handleConfirmOpen = async () => {
    if (!confirmOpenModal) return;
    const cid = confirmOpenModal.chamber_id;
    setConfirmOpenModal(null);
    setBusyChamber(cid);
    try {
      const res = await onOpenChamber(cid);
      if (!res?.success) {
        setFeedback({ type: 'err', text: res?.error || `Failed to open Chamber ${cid}` });
      } else if (res.status === 'QUEUED') {
        setFeedback({ type: 'warn', text: res.message || `Chamber ${cid} OPEN queued (ESP32 offline — not physically executed yet).` });
      } else {
        setFeedback({ type: 'ok', text: res.message || `Chamber ${cid} OPEN command sent.` });
      }
    } finally {
      setBusyChamber(null);
      onRefresh();
    }
  };

  const handleClose = async (cid: number) => {
    setBusyChamber(cid);
    try {
      const res = await onCloseChamber(cid);
      if (!res?.success) {
        setFeedback({ type: 'err', text: res?.error || `Failed to close Chamber ${cid}` });
      } else if (res.status === 'QUEUED') {
        setFeedback({ type: 'warn', text: res.message || `Chamber ${cid} CLOSE queued (ESP32 offline — unconfirmed).` });
      } else {
        setFeedback({ type: 'ok', text: res.message || `Chamber ${cid} CLOSE command sent.` });
      }
    } finally {
      setBusyChamber(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Emergency Stop Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            Three-Chamber Control Center
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Independent manual OPEN / CLOSE actuation for Chambers 1–3 (GPIO 32, GPIO 26, GPIO 27) with safety interlocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-bold text-xs px-3.5 py-2.5 rounded-xl border border-[#334155] shadow-sm cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Refresh State</span>
          </button>

          {isEstop ? (
            <button
              onClick={async () => {
                await onClearEmergencyStop();
                setFeedback({ type: 'ok', text: 'Emergency Stop cleared. Normal chamber control restored.' });
              }}
              className="flex items-center gap-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0B1220]" />
              <span>Reset Emergency Stop</span>
            </button>
          ) : (
            <button
              onClick={async () => {
                await onEmergencyStop();
                setFeedback({ type: 'err', text: 'EMERGENCY STOP ACTIVATED: All servos closing and buzzer silenced.' });
              }}
              className="flex items-center gap-2 bg-[#F87171] hover:bg-[#ef4444] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg cursor-pointer transition-all"
            >
              <OctagonAlert className="w-4 h-4" />
              <span>EMERGENCY STOP ALL</span>
            </button>
          )}
        </div>
      </div>

      {/* Hardware Connectivity / E-Stop Banners */}
      {isEstop && (
        <div className="bg-[#151F32] border-2 border-[#F87171] rounded-2xl p-4 flex items-center gap-3 text-xs text-[#F8FAFC]">
          <OctagonAlert className="w-5 h-5 text-[#F87171] shrink-0" />
          <div>
            <strong className="font-extrabold text-[#F87171] block">EMERGENCY STOP LOCKOUT ACTIVE</strong>
            Opening chambers is disabled until Emergency Stop is cleared. Close operations remain permitted for safety.
          </div>
        </div>
      )}

      {!isDemo && !isOnline && (
        <div className="bg-[#151F32] border border-[#F87171]/40 rounded-2xl p-4 flex items-center gap-3 text-xs text-[#F8FAFC]">
          <WifiOff className="w-5 h-5 text-[#F87171] shrink-0" />
          <div>
            <strong className="font-bold text-[#F87171]">ESP32 Hardware Offline — Commands Queue Unconfirmed: </strong>
            Requests sent right now are marked <code className="font-mono font-bold text-[#38BDF8]">QUEUED</code> in the database and will only execute once an ESP32 reconnects. No physical actuation is faked.
          </div>
        </div>
      )}

      {isDemo && (
        <div className="bg-[#151F32] border border-[#38BDF8]/30 rounded-2xl p-3.5 text-xs text-[#94A3B8]">
          <strong className="font-bold text-[#38BDF8]">Demo Simulator Active: </strong>
          Manual chamber operations simulate MOVING -&gt; OPEN/CLOSED transitions cleanly in software (<code className="font-mono text-[#F8FAFC]">DEMO_SIMULATED</code>).
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold border flex items-center justify-between ${
            feedback.type === 'err'
              ? 'bg-[#151F32] border-[#F87171] text-[#F87171]'
              : feedback.type === 'warn'
              ? 'bg-[#151F32] border-[#F59E0B] text-[#F59E0B]'
              : 'bg-[#151F32] border-[#00D6A0] text-[#00D6A0]'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-[11px] underline ml-4 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Independent 3-Chamber Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {chambers.map((ch) => {
          const isOpen = ch.status === 'OPEN';
          const isMoving = ch.status === 'MOVING' || busyChamber === ch.chamber_id;
          const isError = ch.status === 'ERROR';

          return (
            <div
              key={ch.chamber_id}
              className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg flex flex-col justify-between space-y-5 hover:border-[#38BDF8]/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#1E293B] border border-[#334155] text-[#38BDF8] font-extrabold text-sm flex items-center justify-center">
                      C{ch.chamber_id}
                    </div>
                    <div>
                      <h2 className="font-extrabold text-[#F8FAFC] text-base">
                        Chamber {ch.chamber_id} ({ch.schedule_period})
                      </h2>
                      <span className="font-mono text-[11px] font-bold text-[#38BDF8]">
                        SG90 Servo • GPIO {ch.gpio_pin}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      isError || isMoving
                        ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                        : isOpen
                        ? 'bg-[#00D6A0] text-[#0B1220]'
                        : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
                    }`}
                  >
                    {ch.status}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#1E293B] border border-[#334155] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Assigned Medicine:</span>
                    <span className="font-bold text-[#F8FAFC] truncate max-w-[150px]">{ch.medicine_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Scheduled Time:</span>
                    <span className="font-mono font-bold text-[#38BDF8]">{ch.scheduled_time || '--:--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Target Angles:</span>
                    <span className="font-mono text-[#F8FAFC]">
                      Open {openAngle}° / Close {closeAngle}°
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-[#334155]">
                    <span className="text-[#94A3B8] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#38BDF8]" /> Last Op:
                    </span>
                    <span className="font-mono text-[11px] text-[#38BDF8]">
                      {ch.last_operation_at || 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmOpenModal(ch)}
                  disabled={isOpen || isMoving || isEstop}
                  className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    isOpen || isMoving || isEstop
                      ? 'bg-[#1E293B] text-[#64748B] border border-[#334155] cursor-not-allowed'
                      : 'bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] cursor-pointer shadow-md'
                  }`}
                >
                  <DoorOpen className="w-4 h-4" />
                  <span>Open</span>
                </button>

                <button
                  onClick={() => handleClose(ch.chamber_id)}
                  disabled={(!isOpen && !isError) || isMoving}
                  className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    (!isOpen && !isError) || isMoving
                      ? 'bg-[#1E293B] text-[#64748B] border border-[#334155] cursor-not-allowed'
                      : 'bg-[#38BDF8] hover:bg-[#0284c7] text-[#0B1220] cursor-pointer shadow-md'
                  }`}
                >
                  <DoorClosed className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Operation History Audit Table */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#F8FAFC]">Chamber Actuation & Interlock Audit Log</h2>
            <p className="text-xs text-[#94A3B8]">Separates manual control from automatic scheduled dispensing and records confirmation status</p>
          </div>
          <span className="text-xs font-mono text-[#38BDF8]">
            {(chambersData?.operations || []).length} Recent Ops
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-[#94A3B8] bg-[#1E293B] font-semibold">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Chamber / Pin</th>
                <th className="py-3 px-3">Medicine</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3">Execution Status</th>
                <th className="py-3 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {(chambersData?.operations || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#94A3B8]">
                    No chamber operations recorded yet.
                  </td>
                </tr>
              ) : (
                (chambersData?.operations || []).map((op) => (
                  <tr key={op.id} className="hover:bg-[#1E293B]/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[#38BDF8] whitespace-nowrap">{op.timestamp}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#F8FAFC]">
                      {op.chamber_id > 0 ? `Chamber ${op.chamber_id}` : 'ALL'} {op.gpio_pin ? `(GPIO ${op.gpio_pin})` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-[#94A3B8]">{op.medicine_name || '--'}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#F8FAFC]">{op.action}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-[#1E293B] text-[#94A3B8] border border-[#334155] font-bold text-[10px]">
                        {op.mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          op.status === 'CONFIRMED'
                            ? 'bg-[#00D6A0] text-[#0B1220]'
                            : op.status === 'QUEUED' || op.status === 'EXECUTING'
                            ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                            : op.status === 'REJECTED'
                            ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                            : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#94A3B8] max-w-xs truncate">{op.notes || '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Open Confirmation Modal */}
      {confirmOpenModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1220]/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151F32] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1E293B]">
            <div className="flex items-center gap-3 text-[#F59E0B] mb-3">
              <ShieldAlert className="w-7 h-7 shrink-0 text-[#F59E0B]" />
              <h3 className="font-extrabold text-[#F8FAFC] text-base">
                Confirm Opening Chamber {confirmOpenModal.chamber_id}?
              </h3>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed mb-3">
              This will actuate <strong className="text-[#F8FAFC]">Servo {confirmOpenModal.chamber_id} (GPIO {confirmOpenModal.gpio_pin})</strong> to {openAngle}° for <strong className="text-[#F8FAFC]">{confirmOpenModal.medicine_name}</strong>.
            </p>
            {!isDemo && !isOnline && (
              <div className="flex items-center gap-2 bg-[#F87171]/10 border border-[#F87171]/40 rounded-xl p-3 mb-4 text-xs text-[#F8FAFC]">
                <AlertTriangle className="w-4 h-4 text-[#F87171] shrink-0" />
                <span>ESP32 is currently OFFLINE — opening will be queued as unconfirmed until hardware connects.</span>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setConfirmOpenModal(null)}
                className="px-4 py-2 border border-[#334155] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOpen}
                className="px-5 py-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Confirm & Open Chamber
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
