import React, { useState, useEffect } from 'react';
import {
  Calendar,
  AlertCircle,
  TrendingUp,
  Activity,
  Pill,
  Cpu,
  Printer,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { api } from '../services/api';
import { WeeklyReportResponse } from '../types';

interface WeeklyReportPageProps {
  isDemoMode: boolean;
}

const isoDateOffset = (daysOffset: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
};

export const WeeklyReportPage: React.FC<WeeklyReportPageProps> = ({ isDemoMode }) => {
  const [startDate, setStartDate] = useState<string>(() => isoDateOffset(-6));
  const [endDate, setEndDate] = useState<string>(() => isoDateOffset(0));
  const [includeDemo, setIncludeDemo] = useState<boolean>(isDemoMode);
  const [report, setReport] = useState<WeeklyReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getWeeklyReport(startDate, endDate, includeDemo);
      if (res.success) {
        setReport(res);
      } else {
        setError('Unable to calculate weekly report from database.');
      }
    } catch (e: any) {
      setError(e?.message || 'Network error loading weekly report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, includeDemo]);

  const formatDelta = (curr: number | null, prev: number | null, unit = '') => {
    if (curr === null || prev === null) return 'No prior comparison';
    const diff = Number((curr - prev).toFixed(2));
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}${unit} vs prior period`;
  };

  const h = report?.health_report;
  const m = report?.medicine_report;
  const d = report?.device_report;
  const prov = report?.provenance;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            Weekly Clinical &amp; Adherence Report
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Calculated strictly from stored SQLite telemetry, medication logs, and hardware audit events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#151F32] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#38BDF8]" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="font-mono bg-transparent text-[#F8FAFC] focus:outline-none"
            />
            <span className="text-[#94A3B8]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="font-mono bg-transparent text-[#F8FAFC] focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 bg-[#151F32] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-semibold text-[#F8FAFC] cursor-pointer">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#00D6A0]"
            />
            <span>Include Demo Samples</span>
          </label>

          <button
            onClick={loadReport}
            disabled={loading}
            className="flex items-center gap-1.5 bg-[#151F32] hover:bg-[#1E293B] text-[#F8FAFC] font-bold text-xs px-3.5 py-2 rounded-xl border border-[#1E293B] cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#38BDF8] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export / Print PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="bg-gradient-to-r from-[#151F32] via-[#1E293B] to-[#151F32] border border-[#334155] text-[#F8FAFC] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-[#00D6A0]">
              SmartMed Clinical Analytics Report
            </span>
            <h2 className="text-xl font-extrabold mt-0.5">
              Window: {report?.period.start_date || startDate} to {report?.period.end_date || endDate} ({report?.period.span_days || 7} Days)
            </h2>
          </div>
          <div className="text-xs font-mono bg-[#0B1220]/60 border border-[#334155] rounded-xl px-3.5 py-2">
            Data Source: <strong className="text-[#38BDF8]">{includeDemo ? 'Real ESP32 + Demo Samples' : 'Real ESP32 Records Only'}</strong>
          </div>
        </div>
        {prov && (
          <div className="mt-3 pt-3 border-t border-[#334155] flex flex-wrap gap-4 text-[11px] text-[#94A3B8]">
            <span>Real Telemetry Rows: <strong className="text-[#F8FAFC]">{prov.real_health_count}</strong></span>
            <span>Demo Telemetry Rows: <strong className="text-[#F8FAFC]">{prov.demo_health_count}</strong></span>
            <span>Real Medication Events: <strong className="text-[#F8FAFC]">{prov.real_disp_count}</strong></span>
            <span>Demo Medication Events: <strong className="text-[#F8FAFC]">{prov.demo_disp_count}</strong></span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-[#F87171]/15 border border-[#F87171] rounded-2xl p-4 text-xs font-semibold text-[#F87171] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#F87171]" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Health Metrics Summary */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#38BDF8]" />
          <h3 className="text-base font-extrabold text-[#F8FAFC]">1. Health Telemetry Summary</h3>
        </div>

        {!h?.has_sufficient_data ? (
          <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 text-center space-y-1">
            <p className="text-sm font-bold text-[#F8FAFC]">Insufficient Data</p>
            <p className="text-xs text-[#94A3B8]">
              No stored {includeDemo ? '' : 'real ESP32 '}health readings exist for {startDate} &ndash; {endDate}. Connect hardware or enable "Include Demo Samples" to inspect demo records.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5">
                <span className="text-xs font-bold text-[#94A3B8] uppercase">Average Heart Rate</span>
                <div className="text-3xl font-extrabold font-mono text-[#38BDF8] mt-1">
                  {h.avg_hr ?? '--'} <span className="text-sm text-[#94A3B8]">BPM</span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1">Min/Max: {h.min_hr ?? '--'} / {h.max_hr ?? '--'} BPM</p>
                <p className="text-[11px] font-semibold text-[#00D6A0] mt-1">{formatDelta(h.avg_hr, h.prev_period?.avg_hr, ' BPM')}</p>
              </div>

              <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5">
                <span className="text-xs font-bold text-[#94A3B8] uppercase">Average SpO₂</span>
                <div className="text-3xl font-extrabold font-mono text-[#00D6A0] mt-1">
                  {h.avg_spo2 ?? '--'} <span className="text-sm text-[#94A3B8]">%</span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1">Lowest Recorded: {h.min_spo2 ?? '--'}%</p>
                <p className="text-[11px] font-semibold text-[#00D6A0] mt-1">{formatDelta(h.avg_spo2, h.prev_period?.avg_spo2, '%')}</p>
              </div>

              <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5">
                <span className="text-xs font-bold text-[#94A3B8] uppercase">Body Temperature</span>
                <div className="text-3xl font-extrabold font-mono text-[#F59E0B] mt-1">
                  {h.avg_temp ?? '--'} <span className="text-sm text-[#94A3B8]">°C</span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Range: {h.min_temp ?? '--'} &ndash; {h.max_temp ?? '--'}°C (&Delta; {h.temp_variation ?? '--'}°C)
                </p>
                <p className="text-[11px] font-semibold text-[#00D6A0] mt-1">{formatDelta(h.avg_temp, h.prev_period?.avg_temp, '°C')}</p>
              </div>

              <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5">
                <span className="text-xs font-bold text-[#94A3B8] uppercase">Abnormal Health Alerts</span>
                <div className="text-3xl font-extrabold font-mono text-[#F87171] mt-1">
                  {h.abnormal_reading_count}
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  LOW: <strong className="text-[#F8FAFC]">{h.low_alert_count}</strong> &bull; HIGH: <strong className="text-[#F8FAFC]">{h.high_alert_count}</strong>
                </p>
                <p className="text-[11px] font-semibold text-[#94A3B8] mt-1">{h.reading_count} samples analyzed</p>
              </div>
            </div>

            {h.daily_series.length > 0 && (
              <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-[#38BDF8]" />
                  <h4 className="text-sm font-bold text-[#F8FAFC]">Daily Average Biometric Trends</h4>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={h.daily_series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#151F32', borderRadius: '10px', color: '#F8FAFC', border: '1px solid #334155', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="avg_hr" name="Avg HR (BPM)" stroke="#38BDF8" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="avg_spo2" name="Avg SpO₂ (%)" stroke="#00D6A0" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="avg_temp" name="Avg Temp (°C)" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 2. Medication Adherence Summary */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-[#00D6A0]" />
          <h3 className="text-base font-extrabold text-[#F8FAFC]">2. Medication Adherence Summary</h3>
        </div>

        {!m?.has_sufficient_data ? (
          <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 text-center space-y-1">
            <p className="text-sm font-bold text-[#F8FAFC]">Insufficient Data</p>
            <p className="text-xs text-[#94A3B8]">No medication dispensing events stored in the selected window.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3">
                  <span className="text-2xl font-extrabold font-mono text-[#00D6A0]">
                    {m.adherence_percent !== null ? `${m.adherence_percent}%` : '--'}
                  </span>
                  <span className="block text-[10px] font-bold text-[#94A3B8] mt-0.5">Adherence</span>
                </div>
                <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3">
                  <span className="text-2xl font-extrabold font-mono text-[#F8FAFC]">{m.acknowledged_count}</span>
                  <span className="block text-[10px] font-bold text-[#94A3B8] mt-0.5">Taken / Ack</span>
                </div>
                <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3">
                  <span className="text-2xl font-extrabold font-mono text-[#F87171]">{m.missed_count}</span>
                  <span className="block text-[10px] font-bold text-[#F87171] mt-0.5">Missed</span>
                </div>
                <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3">
                  <span className="text-2xl font-extrabold font-mono text-[#F59E0B]">{m.snooze_attempts_total}</span>
                  <span className="block text-[10px] font-bold text-[#94A3B8] mt-0.5">Snoozes</span>
                </div>
              </div>

              {m.daily_series.length > 0 && (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.daily_series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#151F32', borderRadius: '10px', color: '#F8FAFC', border: '1px solid #334155', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="taken" name="Taken / Acknowledged" fill="#00D6A0" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="missed" name="Missed" fill="#F87171" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5 space-y-3">
              <h4 className="text-sm font-bold text-[#F8FAFC]">Per-Medicine Adherence Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#1E293B] bg-[#1E293B]/40 text-[#94A3B8] font-semibold">
                      <th className="py-2.5 px-3">Medicine</th>
                      <th className="py-2.5 px-3">Chamber</th>
                      <th className="py-2.5 px-3">Taken</th>
                      <th className="py-2.5 px-3">Missed</th>
                      <th className="py-2.5 px-3">Snoozes</th>
                      <th className="py-2.5 px-3">Adherence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]">
                    {m.per_medicine.map((pm, idx) => (
                      <tr key={idx} className="hover:bg-[#1E293B]/30 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#F8FAFC]">{pm.medicine_name}</td>
                        <td className="py-2.5 px-3 font-mono text-[#38BDF8]">C{pm.compartment_id}</td>
                        <td className="py-2.5 px-3 font-mono text-[#00D6A0] font-bold">{pm.taken}</td>
                        <td className="py-2.5 px-3 font-mono text-[#F87171] font-bold">{pm.missed}</td>
                        <td className="py-2.5 px-3 font-mono text-[#F59E0B]">{pm.snoozes}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#F8FAFC]">
                          {pm.adherence_percent !== null ? `${pm.adherence_percent}%` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Device & Sensor Audit Summary */}
      <section className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#38BDF8]" />
            <h3 className="text-base font-extrabold text-[#F8FAFC]">3. Hardware, Servo &amp; Ultrasonic Diagnostics</h3>
          </div>
          <span className="text-xs font-mono font-bold text-[#00D6A0]">
            Ultrasonic: {d?.ultrasonic_current?.status || 'Unknown'} ({d?.servo_operation_count || 0} servo ops)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
            <h4 className="font-bold text-[#F8FAFC] mb-2">Recent Health Alerts ({h?.recent_alerts?.length || 0})</h4>
            {(!h?.recent_alerts || h.recent_alerts.length === 0) ? (
              <p className="text-[#94A3B8]">No abnormal health alerts recorded in this period.</p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {h.recent_alerts.map((al) => (
                  <li key={al.id} className="flex justify-between items-center bg-[#151F32] px-2.5 py-1.5 rounded-lg border border-[#1E293B]">
                    <span>
                      <strong className="text-[#F87171]">{al.direction}</strong> {al.parameter}: {al.value}
                    </span>
                    <span className="font-mono text-[10px] text-[#38BDF8]">{al.timestamp}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
            <h4 className="font-bold text-[#F8FAFC] mb-2">
              Connectivity &amp; Sensor Errors ({d?.connectivity_history?.length || 0} events, {d?.sensor_errors?.length || 0} sensor errors)
            </h4>
            {(!d?.connectivity_history || d.connectivity_history.length === 0) ? (
              <p className="text-[#94A3B8]">No connectivity drops or sensor error events recorded in this period.</p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {d.connectivity_history.map((ev) => (
                  <li key={ev.id} className="flex justify-between items-center bg-[#151F32] px-2.5 py-1.5 rounded-lg border border-[#1E293B]">
                    <span className="truncate max-w-[230px]">
                      <strong className={ev.event_type === 'OFFLINE' || ev.event_type === 'SENSOR_ERROR' ? 'text-[#F87171]' : 'text-[#00D6A0]'}>
                        {ev.event_type}
                      </strong>{' '}
                      <span className="text-[#94A3B8]">{ev.details}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#38BDF8]">{ev.timestamp}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
