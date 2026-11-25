import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  AlertCircle,
  X
} from 'lucide-react';
import { Medicine } from '../types';

interface MedicineManagementPageProps {
  medicines: Medicine[];
  onAddMedicine: (med: Partial<Medicine>) => Promise<void>;
  onUpdateMedicine: (id: number, med: Partial<Medicine>) => Promise<void>;
  onDeleteMedicine: (id: number) => Promise<void>;
}

export const MedicineManagementPage: React.FC<MedicineManagementPageProps> = ({
  medicines,
  onAddMedicine,
  onUpdateMedicine,
  onDeleteMedicine,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [compartmentId, setCompartmentId] = useState<1 | 2 | 3>(1);
  const [schedulePeriod, setSchedulePeriod] = useState<'Morning' | 'Afternoon' | 'Night'>('Morning');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openAddModal = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setInstructions('');
    setFrequency('Daily');
    setCompartmentId(1);
    setSchedulePeriod('Morning');
    setScheduledTime('09:00');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (med: Medicine) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setInstructions(med.instructions || '');
    setFrequency(med.frequency || 'Daily');
    setCompartmentId(med.compartment_id as 1 | 2 | 3);
    setSchedulePeriod(med.schedule_period as 'Morning' | 'Afternoon' | 'Night');
    setScheduledTime(med.scheduled_time);
    setStartDate(med.start_date);
    setEndDate(med.end_date || '');
    setIsActive(!!med.is_active);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dosage || !scheduledTime) return;

    const payload = {
      name,
      dosage,
      instructions,
      frequency,
      compartment_id: compartmentId,
      schedule_period: schedulePeriod,
      scheduled_time: scheduledTime,
      start_date: startDate,
      end_date: endDate || null,
      is_active: isActive ? 1 : 0
    };

    if (editingMed) {
      await onUpdateMedicine(editingMed.id, payload);
    } else {
      await onAddMedicine(payload);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            Prescription & Schedule Management
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Configure medication dosages and link them directly to Compartments 1, 2, or 3.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Prescription</span>
        </button>
      </div>

      {/* Safety Notice Card */}
      <div className="bg-[#151F32] border border-[#38BDF8]/30 rounded-2xl p-4 flex items-start gap-3.5 shadow-lg">
        <AlertCircle className="w-5 h-5 text-[#38BDF8] shrink-0 mt-0.5" />
        <div className="text-xs text-[#94A3B8] leading-relaxed">
          <strong className="font-bold text-[#38BDF8]">Safety Protocol: </strong>
          SmartMed never modifies prescribed dosages automatically. Servo flap activation strictly adheres to the schedule configured below. Ensure each physical compartment holds the matching medication.
        </div>
      </div>

      {/* Compartment Schedule Timetable */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg space-y-4">
        <h2 className="text-base font-bold text-[#F8FAFC]">Daily Compartment Schedule Timetable</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((compNum) => {
            const med = medicines.find((m) => m.compartment_id === compNum && m.is_active);
            const periodName = compNum === 1 ? 'Morning Chamber' : compNum === 2 ? 'Afternoon Chamber' : 'Night Chamber';
            const gpioPin = compNum === 1 ? 'GPIO 32' : compNum === 2 ? 'GPIO 26' : 'GPIO 27';

            return (
              <div
                key={compNum}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                  med
                    ? 'bg-[#1E293B] border-[#334155] shadow-md'
                    : 'bg-[#151F32] border-dashed border-[#334155]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#151F32] text-[#00D6A0] font-bold text-xs flex items-center justify-center border border-[#00D6A0]/40">
                        C{compNum}
                      </span>
                      <span className="text-xs font-bold text-[#F8FAFC]">{periodName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#38BDF8] bg-[#151F32] px-2 py-0.5 rounded border border-[#334155]">
                      {gpioPin}
                    </span>
                  </div>

                  {med ? (
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-extrabold text-[#F8FAFC]">{med.name}</h3>
                      <p className="text-xs font-semibold text-[#00D6A0]">{med.dosage}</p>
                      <p className="text-xs text-[#94A3B8] italic">"{med.instructions}"</p>
                      <div className="pt-2">
                        <span className="text-xs font-mono font-bold text-[#F8FAFC] bg-[#151F32] border border-[#334155] px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-[#38BDF8]" />
                          {med.scheduled_time} ({med.schedule_period})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-[#94A3B8]">
                      <p className="font-semibold text-[#F8FAFC]">Compartment {compNum} Unassigned</p>
                      <p className="text-[11px] text-[#94A3B8] mt-1">Click "Add New Prescription" to link medicine.</p>
                    </div>
                  )}
                </div>

                {med && (
                  <div className="mt-4 pt-3 border-t border-[#334155] flex items-center justify-between">
                    <button
                      onClick={() => openEditModal(med)}
                      className="text-xs font-semibold text-[#38BDF8] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => onDeleteMedicine(med.id)}
                      className="text-xs font-semibold text-[#F87171] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Complete Prescription Table */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-lg space-y-4">
        <h2 className="text-base font-bold text-[#F8FAFC]">All Registered Prescriptions</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-[#94A3B8] bg-[#1E293B] font-semibold">
                <th className="py-3 px-3">Medicine Name</th>
                <th className="py-3 px-3">Dosage</th>
                <th className="py-3 px-3">Instructions</th>
                <th className="py-3 px-3">Compartment</th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {medicines.map((m) => (
                <tr key={m.id} className="hover:bg-[#1E293B]/50 transition-colors">
                  <td className="py-3 px-3 font-bold text-[#F8FAFC]">{m.name}</td>
                  <td className="py-3 px-3 text-[#94A3B8] font-semibold">{m.dosage}</td>
                  <td className="py-3 px-3 text-[#94A3B8] max-w-xs truncate">{m.instructions || '--'}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-[10px] bg-[#1E293B] text-[#38BDF8] border border-[#334155] px-2 py-0.5 rounded">
                      Comp {m.compartment_id}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-[#F8FAFC]">
                    {m.scheduled_time} ({m.schedule_period})
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.is_active ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40' : 'bg-[#1E293B] text-[#94A3B8] border border-[#334155]'}`}>
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(m)}
                      className="p-1 hover:text-[#38BDF8] text-[#94A3B8] rounded transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5 inline" />
                    </button>
                    <button
                      onClick={() => onDeleteMedicine(m.id)}
                      className="p-1 hover:text-[#F87171] text-[#94A3B8] rounded transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Medicine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1220]/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151F32] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#1E293B] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
              <h3 className="font-extrabold text-[#F8FAFC] text-lg">
                {editingMed ? 'Edit Prescription' : 'Add New Prescription'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#94A3B8] hover:text-[#F8FAFC] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#F8FAFC] mb-1">Medicine Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin HCl, Lisinopril"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D6A0] text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#F8FAFC] mb-1">Dosage *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500 mg (1 tablet)"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D6A0] text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#F8FAFC] mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D6A0] text-[#F8FAFC]"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Twice Daily">Twice Daily</option>
                    <option value="As Needed">As Needed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#F8FAFC] mb-1">Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Take with food and water"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D6A0] text-[#F8FAFC]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#F8FAFC] mb-1">Compartment *</label>
                  <select
                    value={compartmentId}
                    onChange={(e) => setCompartmentId(parseInt(e.target.value, 10) as 1 | 2 | 3)}
                    className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D6A0] font-bold text-[#F8FAFC]"
                  >
                    <option value={1}>Compartment 1</option>
                    <option value={2}>Compartment 2</option>
                    <option value={3}>Compartment 3</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#F8FAFC] mb-1">Period</label>
                  <select
                    value={schedulePeriod}
                    onChange={(e) => setSchedulePeriod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D6A0] text-[#F8FAFC]"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Night">Night</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#F8FAFC] mb-1">Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#00D6A0] text-[#F8FAFC]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#00D6A0] rounded"
                />
                <label htmlFor="activeToggle" className="font-semibold text-[#F8FAFC]">
                  Enable active automated reminder & servo flap
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#334155] rounded-xl font-semibold text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] rounded-xl font-bold cursor-pointer"
                >
                  {editingMed ? 'Save Changes' : 'Create Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
