import React from 'react';
import {
  Heart,
  Thermometer,
  Droplets,
  Activity,
  Clock,
  Cpu,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { HealthReading, DeviceStatus, Medicine } from '../types';

interface DashboardPageProps {
  latestHealth: HealthReading | null;
  healthHistory: HealthReading[];
  deviceStatus: DeviceStatus | null;
  remindersOverview: any;
  onNavigate: (page: string) => void;
  isDemoMode: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  latestHealth,
  healthHistory,
  deviceStatus,
  remindersOverview,
  onNavigate,
  isDemoMode
}) => {
  const hasHealth = !!latestHealth;
  const temp = latestHealth?.temperature ?? null;
  const hr = latestHealth?.heart_rate ?? null;
  const spo2 = latestHealth?.spo2 ?? null;
  const finger = hasHealth ? !!latestHealth.finger_detected : false;

  const isEsp32Online = !!deviceStatus?.esp32_online;
  const activeReminder = remindersOverview?.active_reminder || null;

  const tempStatusLabel =
    temp === null || temp <= 0
      ? 'No Signal'
      : temp > 37.2
      ? 'HIGH TEMP'
      : temp < 36.1
      ? 'LOW TEMP'
      : 'Normal';

  const hrStatusLabel = !finger
    ? 'No Finger'
    : !hr || hr <= 0
    ? 'Measuring'
    : hr > 100
    ? 'HIGH HR'
    : hr < 60
    ? 'LOW HR'
    : 'Normal';

  const spo2StatusLabel = !finger
    ? 'No Finger'
    : !spo2 || spo2 <= 0
    ? 'Measuring'
    : spo2 < 90
    ? 'LOW SpO2'
    : 'Normal';

  const i2cOnlineCount =
    (deviceStatus?.tmp117_ok ? 1 : 0) +
    (deviceStatus?.max30102_ok ? 1 : 0) +
    (deviceStatus?.ds3231_ok ? 1 : 0) +
    (deviceStatus?.lcd_ok ? 1 : 0);

  // Format Recharts data
  const chartData = healthHistory.map((item, idx) => ({
    time: item.timestamp ? item.timestamp.split(' ')[1]?.substring(0, 5) || `T-${healthHistory.length - idx}` : `${idx}`,
    heartRate: item.heart_rate,
    spo2: item.spo2,
    temp: item.temperature
  }));

  const summary = remindersOverview?.summary || { total: 3, completed: 0, pending: 0, missed: 0 };
  const nextMed: Medicine | null = remindersOverview?.next_medicine || null;

  return (
    <div className="space-y-6">
      {/* 1. Welcome Section */}
      <div className="bg-gradient-to-r from-[#151F32] via-[#1E293B] to-[#151F32] rounded-2xl p-6 text-[#F8FAFC] shadow-2xl relative overflow-hidden border border-[#38BDF8]/20">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#38BDF8]/15 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-[#00D6A0]/15 text-[#00D6A0] px-2.5 py-0.5 rounded-full border border-[#00D6A0]/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#00D6A0]" />
                {isDemoMode
                  ? 'Interactive Demo Simulator'
                  : isEsp32Online
                  ? 'Physical ESP32 Online'
                  : 'ESP32 Offline — Awaiting Hardware'}
              </span>
              <span className="text-xs text-[#94A3B8]">Clinical Station v2.4</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#F8FAFC]">
              SmartMed Healthcare Control Center
            </h1>

            <p className="text-xs md:text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
              Real-time ESP32 biometric acquisition from TMP117 & MAX30102 combined with 3-compartment automated servo dispensing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('medicines')}
              className="bg-gradient-to-r from-[#00D6A0] to-[#38BDF8] hover:opacity-95 text-[#0B1220] font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Manage Schedules
            </button>
            <button
              onClick={() => onNavigate('chambers')}
              className="bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-semibold text-xs px-4 py-2.5 rounded-xl border border-[#334155] transition-all cursor-pointer"
            >
              Chamber Control
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] font-semibold text-xs px-4 py-2.5 rounded-xl border border-[#334155] transition-all cursor-pointer"
            >
              Weekly Report
            </button>
          </div>
        </div>
      </div>

      {/* 2. Health Monitoring Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate Card */}
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-lg hover:border-[#38BDF8]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider">Heart Rate</span>
            <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 text-[#38BDF8] flex items-center justify-center">
              <Heart className="w-5 h-5 fill-[#38BDF8] text-[#38BDF8] animate-pulse" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#F8FAFC]">
              {finger && hr && hr > 0 ? hr : '--'}
            </span>
            <span className="text-xs font-semibold text-[#38BDF8]">BPM</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs">
            <span className="text-[#94A3B8] font-medium">Normal: 60–100</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                hrStatusLabel.includes('LOW') || hrStatusLabel.includes('HIGH')
                  ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                  : finger
                  ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                  : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
              }`}
            >
              {hrStatusLabel}
            </span>
          </div>
        </div>

        {/* Blood Oxygen SpO2 Card */}
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-lg hover:border-[#00D6A0]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#00D6A0] uppercase tracking-wider">Blood Oxygen (SpO₂)</span>
            <div className="w-9 h-9 rounded-xl bg-[#00D6A0]/10 text-[#00D6A0] flex items-center justify-center">
              <Droplets className="w-5 h-5 text-[#00D6A0]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#F8FAFC]">
              {finger && spo2 && spo2 > 0 ? spo2 : '--'}
            </span>
            <span className="text-xs font-semibold text-[#00D6A0]">%</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs">
            <span className="text-[#94A3B8] font-medium">Normal: 90–100%</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                spo2StatusLabel.includes('LOW')
                  ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                  : finger
                  ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                  : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
              }`}
            >
              {spo2StatusLabel}
            </span>
          </div>
        </div>

        {/* Body Temperature Card */}
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-lg hover:border-[#F59E0B]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider">Body Temperature</span>
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-[#F59E0B]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#F8FAFC]">
              {temp !== null && temp > 0 ? temp.toFixed(1) : '--'}
            </span>
            <span className="text-xs font-semibold text-[#F59E0B]">°C</span>
            <span className="text-xs text-[#94A3B8] font-mono">
              ({temp !== null && temp > 0 ? (temp * 1.8 + 32).toFixed(1) : '--'} °F)
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs">
            <span className="text-[#94A3B8] font-medium">Normal: 36.1–37.2°C</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                tempStatusLabel.includes('HIGH') || tempStatusLabel.includes('LOW')
                  ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'
                  : temp !== null && temp > 0
                  ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                  : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
              }`}
            >
              {tempStatusLabel}
            </span>
          </div>
        </div>

        {/* System Vitals Status Card */}
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-lg hover:border-[#38BDF8]/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider">Sensor Status</span>
            <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/10 text-[#38BDF8] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#38BDF8]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-[#F8FAFC] truncate">
              {hasHealth ? latestHealth?.status : isDemoMode ? 'READY' : 'AWAITING ESP32'}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs">
            <span className="text-[#94A3B8] font-medium">I2C Devices Online</span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${i2cOnlineCount === 4 ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'}`}>
              {i2cOnlineCount}/4 Devices OK
            </span>
          </div>
        </div>
      </div>

      {/* 3. Live Charts and Reminders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Health Graphs (Span 2 Cols) */}
        <div className="lg:col-span-2 bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Live Health Telemetry Waveforms</h2>
              <p className="text-xs text-[#38BDF8]">Simultaneous Heart Rate (BPM) & Blood Oxygen (SpO₂) Waveforms</p>
            </div>
            <button
              onClick={() => onNavigate('health')}
              className="text-xs font-bold text-[#38BDF8] hover:text-[#00D6A0] hover:underline cursor-pointer"
            >
              Detailed Analytics &rarr;
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D6A0" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#00D6A0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, 120]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#151F32', borderRadius: '10px', color: '#F8FAFC', fontSize: '12px', border: '1px solid #1E293B' }}
                />
                <Area type="monotone" dataKey="heartRate" name="Heart Rate (BPM)" stroke="#38BDF8" strokeWidth={2.5} fillOpacity={1} fill="url(#hrGrad)" />
                <Area type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#00D6A0" strokeWidth={2.5} fillOpacity={1} fill="url(#spo2Grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-[#94A3B8] border-t border-[#1E293B] pt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-[#38BDF8]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" /> Heart Rate (BPM)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-[#00D6A0]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00D6A0]" /> SpO₂ (%)
              </span>
            </div>
            <span>Updated: {latestHealth?.timestamp || 'Just now'}</span>
          </div>
        </div>

        {/* Medicine Reminder Overview (1 Col) */}
        <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#F8FAFC]">Today's Medication</h2>
              <button
                onClick={() => onNavigate('medicines')}
                className="text-xs font-bold text-[#38BDF8] hover:underline cursor-pointer"
              >
                View Timetable
              </button>
            </div>

            {/* Next Due Pill Banner */}
            {nextMed ? (
              <div className="bg-[#1E293B] border border-[#38BDF8]/30 rounded-xl p-3.5 mb-4">
                <div className="flex items-center gap-2 text-[#38BDF8] text-xs font-bold uppercase tracking-wider mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Next Due Reminder</span>
                </div>
                <h4 className="font-extrabold text-[#F8FAFC] text-base">{nextMed.name}</h4>
                <p className="text-xs text-[#94A3B8] mt-0.5">{nextMed.dosage} • Compartment {nextMed.compartment_id}</p>
                <div className="mt-2 text-xs font-mono font-bold text-[#00D6A0] bg-[#151F32] border border-[#334155] px-2 py-1 rounded inline-block">
                  Scheduled: {nextMed.scheduled_time} ({nextMed.schedule_period})
                </div>
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-[#94A3B8] bg-[#1E293B] rounded-xl mb-4 border border-[#334155]">
                No upcoming medications scheduled today.
              </div>
            )}

            {/* Summary Counters */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[#00D6A0]/10 border border-[#00D6A0]/30 rounded-xl p-2.5">
                <span className="text-xl font-extrabold text-[#00D6A0] font-mono">{summary.completed}</span>
                <span className="text-[10px] font-semibold text-[#94A3B8] block mt-0.5">Retrieved</span>
              </div>
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-2.5">
                <span className="text-xl font-extrabold text-[#F59E0B] font-mono">{summary.pending}</span>
                <span className="text-[10px] font-semibold text-[#94A3B8] block mt-0.5">Pending</span>
              </div>
              <div className="bg-[#F87171]/10 border border-[#F87171]/30 rounded-xl p-2.5">
                <span className="text-xl font-extrabold text-[#F87171] font-mono">{summary.missed}</span>
                <span className="text-[10px] font-semibold text-[#F87171] block mt-0.5">Missed</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs text-[#94A3B8]">
            <span>{activeReminder ? `Snooze Attempt ${activeReminder.attempt_number}/3` : '3-Attempt 5m Snooze FSM'}</span>
            <button onClick={() => onNavigate('chambers')} className="font-semibold text-[#38BDF8] hover:underline cursor-pointer">
              Control Chambers &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 4. Complete Hardware & Peripheral Diagnostics Board */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#38BDF8]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">Hardware & Sensor Telemetry Board</h2>
          </div>
          <span className="text-xs text-[#94A3B8] font-medium">
            ESP32 Uptime: {Math.floor((deviceStatus?.uptime_seconds ?? 0) / 60)} min
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center text-xs">
          {/* Item 1: ESP32 Core */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">ESP32 Core</span>
            <span className={`text-xs font-mono font-bold mt-1 block ${isEsp32Online ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
              {isEsp32Online ? 'ONLINE' : 'OFFLINE'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">240 MHz</span>
          </div>

          {/* Item 2: TMP117 */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">TMP117</span>
            <span className={`text-xs font-mono font-bold mt-1 block ${deviceStatus?.tmp117_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
              {deviceStatus?.tmp117_ok ? 'I2C 0x48' : 'OFFLINE'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">±0.1°C</span>
          </div>

          {/* Item 3: MAX30102 */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">MAX30102</span>
            <span className={`text-xs font-mono font-bold mt-1 block ${deviceStatus?.max30102_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
              {deviceStatus?.max30102_ok ? 'I2C 0x57' : 'OFFLINE'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">PPG Sensor</span>
          </div>

          {/* Item 4: DS3231 RTC */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">DS3231 RTC</span>
            <span className={`text-xs font-mono font-bold mt-1 block ${deviceStatus?.ds3231_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
              {deviceStatus?.ds3231_ok ? 'SYNCED' : 'UNSYNC'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">I2C 0x68</span>
          </div>

          {/* Item 5: Servo 1 */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">Chamber 1</span>
            <span className="text-xs font-mono font-bold text-[#38BDF8] mt-1 block truncate">
              {deviceStatus?.servo1_state || 'CLOSED'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">GPIO 32</span>
          </div>

          {/* Item 6: Servo 2 */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">Chamber 2</span>
            <span className="text-xs font-mono font-bold text-[#38BDF8] mt-1 block truncate">
              {deviceStatus?.servo2_state || 'CLOSED'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">GPIO 26</span>
          </div>

          {/* Item 7: Servo 3 */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">Chamber 3</span>
            <span className="text-xs font-mono font-bold text-[#38BDF8] mt-1 block truncate">
              {deviceStatus?.servo3_state || 'CLOSED'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5">GPIO 27</span>
          </div>

          {/* Item 8: Ultrasonic Sensor */}
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-2.5">
            <span className="text-[11px] font-bold text-[#F8FAFC] block truncate">Ultrasonic</span>
            <span className={`text-xs font-mono font-bold mt-1 block truncate ${deviceStatus?.ultrasonic_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
              {deviceStatus?.ultrasonic_ok && deviceStatus.ultrasonic_distance > 0
                ? `${deviceStatus.ultrasonic_distance.toFixed(1)} cm`
                : 'SENSOR ERROR'}
            </span>
            <span className="text-[10px] text-[#94A3B8] block mt-0.5 truncate">
              {deviceStatus?.ultrasonic_status || 'HC-SR04'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
