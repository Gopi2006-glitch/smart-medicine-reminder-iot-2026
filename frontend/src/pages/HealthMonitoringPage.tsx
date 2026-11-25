import React, { useState } from 'react';
import {
  Info,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { HealthReading, HealthAlert } from '../types';

interface HealthMonitoringPageProps {
  latestHealth: HealthReading | null;
  healthHistory: HealthReading[];
  healthAlerts?: HealthAlert[];
  onRefresh: () => void;
}

export const HealthMonitoringPage: React.FC<HealthMonitoringPageProps> = ({
  latestHealth,
  healthHistory,
  healthAlerts = [],
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'hr' | 'spo2' | 'temp'>('all');

  const hasReading = !!latestHealth;
  const temp = latestHealth?.temperature ?? null;
  const hr = latestHealth?.heart_rate ?? null;
  const spo2 = latestHealth?.spo2 ?? null;
  const finger = hasReading ? !!latestHealth.finger_detected : false;

  const hrOutOfRange = finger && hr !== null && hr > 0 && (hr < 60 || hr > 100);
  const spo2OutOfRange = finger && spo2 !== null && spo2 > 0 && spo2 < 90;
  const tempOutOfRange = temp !== null && temp > 0 && (temp < 36.1 || temp > 37.2);

  // Prepare chart series
  const chartData = healthHistory.map((item, idx) => ({
    time: item.timestamp ? item.timestamp.split(' ')[1]?.substring(0, 5) || `T-${idx}` : `${idx}`,
    heartRate: item.heart_rate,
    spo2: item.spo2,
    temp: item.temperature,
    status: item.status
  }));

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            Biometric Telemetry & Waveforms
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Real-time biometric acquisition from Texas Instruments TMP117 and Maxim MAX30102.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#0B1220]" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Medical Disclaimer Banner */}
      <div className="bg-[#151F32] border border-[#38BDF8]/30 rounded-2xl p-4 flex items-start gap-3.5 shadow-lg">
        <Info className="w-5 h-5 text-[#38BDF8] shrink-0 mt-0.5" />
        <div className="text-xs text-[#94A3B8] leading-relaxed">
          <strong className="font-bold text-[#38BDF8]">Clinical & Biomedical Disclaimer: </strong>
          SmartMed provides informational health monitoring and is not a substitute for professional medical diagnosis. Sensor measurements represent academic engineering estimations from photoplethysmography (PPG) and ambient probe thermometry.
        </div>
      </div>

      {/* Live Vitals Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Heart Rate */}
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider">Heart Rate (HR)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${hrOutOfRange ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40' : finger ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'}`}>
              {!finger ? 'No Finger' : !hr || hr <= 0 ? 'Measuring' : hr < 60 ? 'LOW (<60)' : hr > 100 ? 'HIGH (>100)' : 'Normal'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-[#F8FAFC]">{finger && hr && hr > 0 ? hr : '--'}</span>
            <span className="text-sm font-semibold text-[#38BDF8]">BPM</span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-2">
            Normal resting range: 60 – 100 BPM. Alert below 60 (LOW) or above 100 BPM (HIGH).
          </p>
        </div>

        {/* SpO2 */}
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#00D6A0] uppercase tracking-wider">Blood Oxygen (SpO₂)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${spo2OutOfRange ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40' : finger ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'}`}>
              {!finger ? 'No Finger' : !spo2 || spo2 <= 0 ? 'Measuring' : spo2 < 90 ? 'LOW (<90%)' : 'Normal'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-[#F8FAFC]">{finger && spo2 && spo2 > 0 ? spo2 : '--'}</span>
            <span className="text-sm font-semibold text-[#00D6A0]">%</span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-2">
            Normal capillary saturation: 90% – 100%. Low alert below 90%.
          </p>
        </div>

        {/* Temperature */}
        <div className="bg-[#151F32] rounded-2xl p-5 border border-[#1E293B] shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider">Body Temperature</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tempOutOfRange ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40' : temp && temp > 0 ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'}`}>
              {!temp || temp <= 0 ? 'No Signal' : temp < 36.1 ? 'LOW (<36.1°C)' : temp > 37.2 ? 'HIGH (>37.2°C)' : 'Normal'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-mono text-[#F8FAFC]">{temp !== null && temp > 0 ? temp.toFixed(1) : '--'}</span>
            <span className="text-sm font-semibold text-[#F59E0B]">°C</span>
            <span className="text-xs text-[#94A3B8] font-mono ml-1">
              ({temp !== null && temp > 0 ? (temp * 1.8 + 32).toFixed(1) : '--'} °F)
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-2">
            Normal range: 36.1°C – 37.2°C. Alert below 36.1°C (LOW) or above 37.2°C (HIGH).
          </p>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#F8FAFC]">Multi-Parameter Health History Chart</h2>
            <p className="text-xs text-[#38BDF8]">Interactive multi-parameter time-series visualization</p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-[#1E293B] p-1 rounded-xl border border-[#334155] self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'all' ? 'bg-[#00D6A0] text-[#0B1220] shadow-xs' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
            >
              All Metrics
            </button>
            <button
              onClick={() => setActiveTab('hr')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'hr' ? 'bg-[#38BDF8] text-[#0B1220] shadow-xs' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
            >
              Heart Rate
            </button>
            <button
              onClick={() => setActiveTab('spo2')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'spo2' ? 'bg-[#00D6A0] text-[#0B1220] shadow-xs' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
            >
              SpO₂
            </button>
            <button
              onClick={() => setActiveTab('temp')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'temp' ? 'bg-[#F59E0B] text-[#0B1220] shadow-xs' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}`}
            >
              Temperature
            </button>
          </div>
        </div>

        {/* Chart View */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#151F32', borderRadius: '12px', color: '#F8FAFC', fontSize: '12px', border: '1px solid #1E293B' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

              {(activeTab === 'all' || activeTab === 'hr') && (
                <Line type="monotone" dataKey="heartRate" name="Heart Rate (BPM)" stroke="#38BDF8" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              )}
              {(activeTab === 'all' || activeTab === 'spo2') && (
                <Line type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#00D6A0" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              )}
              {(activeTab === 'all' || activeTab === 'temp') && (
                <Line type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#F59E0B" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Records Table */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#F8FAFC]">Recorded Telemetry Logs</h2>
          <span className="text-xs text-[#38BDF8]">Showing last {healthHistory.length} measurements</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-[#94A3B8] bg-[#1E293B] font-semibold">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Temperature (°C)</th>
                <th className="py-3 px-3">Heart Rate (BPM)</th>
                <th className="py-3 px-3">SpO₂ (%)</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Clinical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {healthHistory.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#1E293B]/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-[#38BDF8]">{row.timestamp}</td>
                  <td className="py-3 px-3 font-mono font-bold text-[#F8FAFC]">{row.temperature.toFixed(1)} °C</td>
                  <td className="py-3 px-3 font-mono font-bold text-[#F8FAFC]">{row.heart_rate} BPM</td>
                  <td className="py-3 px-3 font-mono font-bold text-[#F8FAFC]">{row.spo2} %</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.finger_detected ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'}`}>
                      {row.finger_detected ? 'Present' : 'Absent'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.status === 'NORMAL' ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40' : 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stored Health Alerts Table */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#F8FAFC]">Stored Abnormal Health Alerts (LOW / HIGH)</h2>
            <p className="text-xs text-[#94A3B8]">Logged with 30-second buzzer cooldown so noisy samples never flood alerts</p>
          </div>
          <span className="text-xs font-mono text-[#38BDF8]">{healthAlerts.length} alerts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-[#94A3B8] bg-[#1E293B] font-semibold">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Parameter</th>
                <th className="py-3 px-3">Direction</th>
                <th className="py-3 px-3">Measured Value</th>
                <th className="py-3 px-3">Threshold</th>
                <th className="py-3 px-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {healthAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#94A3B8]">No abnormal health alerts recorded.</td>
                </tr>
              ) : (
                healthAlerts.map((al) => (
                  <tr key={al.id} className="hover:bg-[#1E293B]/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[#38BDF8]">{al.timestamp}</td>
                    <td className="py-2.5 px-3 font-bold text-[#F8FAFC]">{al.parameter}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${al.direction === 'HIGH' ? 'bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40' : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'}`}>
                        {al.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#F8FAFC]">{al.value}</td>
                    <td className="py-2.5 px-3 font-mono text-[#94A3B8]">{al.threshold}</td>
                    <td className="py-2.5 px-3 text-[#94A3B8]">{al.message}</td>
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
