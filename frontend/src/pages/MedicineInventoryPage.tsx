import React, { useState } from 'react';
import {
  Boxes,
  Sliders,
  History,
  Info,
  RefreshCw
} from 'lucide-react';
import { InventoryItem, DispensingHistory, UltrasonicSnapshot } from '../types';

interface MedicineInventoryPageProps {
  inventory: InventoryItem[];
  dispensingHistory: DispensingHistory[];
  ultrasonic?: UltrasonicSnapshot | null;
  onUpdateConfig: (config: Partial<InventoryItem> & { ultrasonic_threshold_cm?: number }) => Promise<void>;
  onRefresh: () => void;
}

export const MedicineInventoryPage: React.FC<MedicineInventoryPageProps> = ({
  inventory,
  dispensingHistory,
  ultrasonic,
  onUpdateConfig,
  onRefresh
}) => {
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [fullDist, setFullDist] = useState(3.0);
  const [emptyDist, setEmptyDist] = useState(15.0);
  const [thresholdPercent, setThresholdPercent] = useState(25);
  const [detectThresholdCm, setDetectThresholdCm] = useState(ultrasonic?.threshold_cm ?? 5.0);

  const openCalibration = (item: InventoryItem) => {
    setEditingItem(item);
    setFullDist(item.full_distance_cm);
    setEmptyDist(item.empty_distance_cm);
    setThresholdPercent(item.low_stock_threshold_percent);
  };

  const handleSaveCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    await onUpdateConfig({
      compartment_id: editingItem.compartment_id,
      full_distance_cm: fullDist,
      empty_distance_cm: emptyDist,
      low_stock_threshold_percent: thresholdPercent
    });

    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            Medicine Inventory &amp; Ultrasonic Proximity
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Compartment fill-level estimation using HC-SR04 ultrasonic time-of-flight acoustic sensing.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#0B1220]" />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* Live Ultrasonic Object Detection Status */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#38BDF8]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#38BDF8]">HC-SR04 Live Object Detection</span>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                !ultrasonic?.sensor_connected
                  ? 'bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30'
                  : ultrasonic?.object_detected
                  ? 'bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30'
                  : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
              }`}
            >
              {ultrasonic?.status || 'SENSOR ERROR'}
            </span>
          </div>
          <p className="text-xs text-[#94A3B8]">
            Measured distance:{' '}
            <strong className="font-mono text-[#F8FAFC]">
              {ultrasonic?.sensor_connected && ultrasonic.measured_distance_cm >= 0
                ? `${ultrasonic.measured_distance_cm.toFixed(1)} cm`
                : 'SENSOR ERROR / Disconnected'}
            </strong>{' '}
            (Rule: &le; {ultrasonic?.threshold_cm ?? 5.0} cm &rarr; Object detected)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-[#F8FAFC]">Detection Threshold (cm):</label>
          <input
            type="number"
            step="0.5"
            min="1"
            max="50"
            value={detectThresholdCm}
            onChange={(e) => setDetectThresholdCm(parseFloat(e.target.value) || 5.0)}
            className="w-20 px-2.5 py-1.5 bg-[#1E293B] border border-[#334155] rounded-xl font-mono text-[#F8FAFC] focus:outline-none focus:border-[#00D6A0]"
          />
          <button
            onClick={() => onUpdateConfig({ ultrasonic_threshold_cm: detectThresholdCm })}
            className="px-3 py-1.5 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold rounded-xl cursor-pointer transition-colors"
          >
            Update Rule
          </button>
        </div>
      </div>

      {/* Engineering Note Card */}
      <div className="bg-[#1E293B]/60 border border-[#334155] rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
        <Info className="w-5 h-5 text-[#38BDF8] shrink-0 mt-0.5" />
        <div className="text-xs text-[#94A3B8] leading-relaxed">
          <strong className="font-bold text-[#38BDF8]">Physical Modeling Limitation: </strong>
          HC-SR04 measures obstacle presence / top-surface distance only; it explicitly does not count exact individual tablets. Valid reads at &le; {ultrasonic?.threshold_cm ?? 5.0} cm report "Object detected", &gt; threshold reports "Object not detected", and echo faults report "SENSOR ERROR".
        </div>
      </div>

      {/* 3 Compartments Stock Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {inventory.map((comp) => {
          const isLow = comp.estimated_stock_percent <= comp.low_stock_threshold_percent;

          return (
            <div
              key={comp.compartment_id}
              className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#334155] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#1E293B] text-[#38BDF8] font-bold text-xs flex items-center justify-center border border-[#334155]">
                      C{comp.compartment_id}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#F8FAFC] text-sm">{comp.medicine_name}</h3>
                      <span className="text-[11px] text-[#94A3B8] font-medium">Compartment {comp.compartment_id}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isLow ? 'bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30 animate-pulse' : 'bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30'
                    }`}
                  >
                    {isLow ? 'LOW STOCK' : 'SUFFICIENT'}
                  </span>
                </div>

                {/* Fill Percentage & Progress Bar */}
                <div className="space-y-2 mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold font-mono text-[#F8FAFC]">
                      {comp.estimated_stock_percent}%
                    </span>
                    <span className="text-xs font-semibold text-[#94A3B8]">
                      Echo Dist: {comp.current_distance_cm >= 0 ? `${comp.current_distance_cm.toFixed(1)} cm` : 'SENSOR ERROR'}
                    </span>
                  </div>

                  <div className="w-full bg-[#0B1220] border border-[#1E293B] h-3 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-[#F87171]' : 'bg-[#00D6A0]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, comp.estimated_stock_percent))}%` }}
                    />
                  </div>
                </div>

                {/* Sensor Details */}
                <div className="mt-4 pt-3 border-t border-[#1E293B] text-xs space-y-1 text-[#94A3B8]">
                  <div className="flex justify-between">
                    <span>Calibrated Full Depth:</span>
                    <span className="font-mono font-semibold text-[#F8FAFC]">{comp.full_distance_cm} cm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Calibrated Empty Depth:</span>
                    <span className="font-mono font-semibold text-[#F8FAFC]">{comp.empty_distance_cm} cm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Low Alert Threshold:</span>
                    <span className="font-mono font-semibold text-[#F8FAFC]">{comp.low_stock_threshold_percent}%</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openCalibration(comp)}
                className="w-full py-2 bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] text-xs font-bold rounded-xl border border-[#334155] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Calibrate Dimensions</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Servo Operation & Dispensing Audit Log */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#38BDF8]" />
          <h2 className="text-base font-bold text-[#F8FAFC]">Compartment Actuation &amp; Retrieval Audit Log</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B] text-[#94A3B8] bg-[#1E293B]/40 font-semibold">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Medication</th>
                <th className="py-3 px-3">Compartment</th>
                <th className="py-3 px-3">Verification Method</th>
                <th className="py-3 px-3">Result</th>
                <th className="py-3 px-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {dispensingHistory.slice(0, 8).map((d) => (
                <tr key={d.id} className="hover:bg-[#1E293B]/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-[#38BDF8]">{d.timestamp}</td>
                  <td className="py-3 px-3 font-bold text-[#F8FAFC]">{d.medicine_name}</td>
                  <td className="py-3 px-3 font-semibold text-[#94A3B8]">Compartment {d.compartment_id}</td>
                  <td className="py-3 px-3 text-[#94A3B8]">{d.method}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.event_type === 'RETRIEVED' || d.event_type === 'ACKNOWLEDGED'
                          ? 'bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30'
                          : d.event_type === 'MISSED'
                          ? 'bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30'
                          : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'
                      }`}
                    >
                      {d.event_type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#94A3B8] max-w-xs truncate">{d.notes || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calibration Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-[#0B1220]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151F32] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1E293B] animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-extrabold text-[#F8FAFC] text-lg mb-1">
              Calibrate Compartment {editingItem.compartment_id} Dimensions
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4">
              Configure the ultrasonic echo distance range for {editingItem.medicine_name}.
            </p>

            <form onSubmit={handleSaveCalibration} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#F8FAFC] mb-1">Full Level Distance (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={fullDist}
                  onChange={(e) => setFullDist(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] font-mono text-[#F8FAFC]"
                />
                <span className="text-[11px] text-[#94A3B8]">Distance when box is full of medication pills.</span>
              </div>

              <div>
                <label className="block font-bold text-[#F8FAFC] mb-1">Empty Level Distance (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={emptyDist}
                  onChange={(e) => setEmptyDist(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] font-mono text-[#F8FAFC]"
                />
                <span className="text-[11px] text-[#94A3B8]">Distance when box floor is empty.</span>
              </div>

              <div>
                <label className="block font-bold text-[#F8FAFC] mb-1">Low-Stock Alert Threshold (%)</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  required
                  value={thresholdPercent}
                  onChange={(e) => setThresholdPercent(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] font-mono text-[#F8FAFC]"
                />
                <span className="text-[11px] text-[#94A3B8]">Trigger alert when estimated stock drops below this percentage.</span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-[#334155] rounded-xl font-semibold text-[#94A3B8] hover:bg-[#1E293B] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Save Calibration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
