import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Award
} from 'lucide-react';
import { DispensingHistory } from '../types';

interface ReminderHistoryPageProps {
  history: DispensingHistory[];
}

export const ReminderHistoryPage: React.FC<ReminderHistoryPageProps> = ({ history }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredHistory = history.filter((item) => {
    const matchesFilter = filterType === 'ALL' || item.event_type === filterType;
    const matchesSearch =
      item.medicine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const totalDoses = history.length;
  const retrievedDoses = history.filter((h) => h.event_type === 'RETRIEVED' || h.event_type === 'ACKNOWLEDGED').length;
  const missedDoses = history.filter((h) => h.event_type === 'MISSED').length;
  const snoozedEvents = history.filter((h) => h.event_type === 'SNOOZED').length;
  const resolvedCount = retrievedDoses + missedDoses;
  const adherenceRate = resolvedCount > 0 ? Math.round((retrievedDoses / resolvedCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            Dispensing &amp; Reminder History
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Comprehensive audit trail of medication alerts, hand interactions, and missed schedules.
          </p>
        </div>
      </div>

      {/* Adherence Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Adherence Rate</span>
            <Award className="w-5 h-5 text-[#00D6A0]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono text-[#00D6A0]">{adherenceRate}%</span>
            <span className="text-xs font-semibold text-[#94A3B8]">Overall</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2">Doses retrieved vs missed</p>
        </div>

        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Total Recorded</span>
            <History className="w-5 h-5 text-[#38BDF8]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono text-[#F8FAFC]">{totalDoses}</span>
            <span className="text-xs font-semibold text-[#94A3B8]">Events</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2">System audit events</p>
        </div>

        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Retrieved Doses</span>
            <CheckCircle2 className="w-5 h-5 text-[#00D6A0]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono text-[#00D6A0]">{retrievedDoses}</span>
            <span className="text-xs font-semibold text-[#00D6A0]">Confirmed</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2">Acknowledged doses ({snoozedEvents} snooze retries)</p>
        </div>

        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Missed Doses</span>
            <XCircle className="w-5 h-5 text-[#F87171]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono text-[#F87171]">{missedDoses}</span>
            <span className="text-xs font-semibold text-[#F87171]">After 3 Attempts</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2">Unanswered across 3 x 5-min retries</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-[#38BDF8]" />
          <span className="text-xs font-bold text-[#F8FAFC]">Filter Event:</span>
          <div className="flex flex-wrap items-center gap-1 bg-[#0B1220] border border-[#1E293B] p-1 rounded-xl">
            {['ALL', 'ACKNOWLEDGED', 'RETRIEVED', 'SNOOZED', 'MISSED', 'MANUAL_TEST'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === t
                    ? 'bg-[#00D6A0] text-[#0B1220] shadow-xs'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {t === 'MANUAL_TEST' ? 'Tests' : t}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search by medicine or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
          />
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] text-[#94A3B8] bg-[#1E293B]/40 font-semibold">
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Medication Name</th>
                <th className="py-3 px-3">Compartment</th>
                <th className="py-3 px-3">Scheduled</th>
                <th className="py-3 px-3">Interaction Status</th>
                <th className="py-3 px-3">Verification Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#94A3B8] font-medium">
                    No history records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-[#1E293B]/30 transition-colors">
                    <td className="py-3 px-3 font-mono text-[#38BDF8] whitespace-nowrap">{item.timestamp}</td>
                    <td className="py-3 px-3 font-bold text-[#F8FAFC]">{item.medicine_name}</td>
                    <td className="py-3 px-3 font-semibold text-[#94A3B8]">Compartment {item.compartment_id}</td>
                    <td className="py-3 px-3 font-mono font-bold text-[#F8FAFC]">{item.scheduled_time}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          item.event_type === 'RETRIEVED' || item.event_type === 'ACKNOWLEDGED'
                            ? 'bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30'
                            : item.event_type === 'MISSED'
                            ? 'bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30'
                            : item.event_type === 'SNOOZED'
                            ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                            : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
                        }`}
                      >
                        {item.event_type === 'RETRIEVED' || item.event_type === 'ACKNOWLEDGED' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : item.event_type === 'MISSED' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {item.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#94A3B8] max-w-sm">
                      <span className="block font-medium text-[#F8FAFC]">{item.method}</span>
                      {item.notes && <span className="text-[11px] text-[#94A3B8] italic">{item.notes}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
