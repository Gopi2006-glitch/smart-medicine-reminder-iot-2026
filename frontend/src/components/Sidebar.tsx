import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Pill,
  Boxes,
  History,
  Cpu,
  Settings,
  Info,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  FileBarChart
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onSelectPage: (page: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isDemoMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  collapsed,
  onToggleCollapse,
  isDemoMode
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'health', label: 'Health Monitoring', icon: Activity },
    { id: 'medicines', label: 'Medicine Schedules', icon: Pill },
    { id: 'chambers', label: 'Chamber Control', icon: DoorOpen },
    { id: 'inventory', label: 'Medicine Inventory', icon: Boxes },
    { id: 'history', label: 'Reminder History', icon: History },
    { id: 'reports', label: 'Weekly Reports', icon: FileBarChart },
    { id: 'device', label: 'IoT Device Monitoring', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'about', label: 'About Project', icon: Info },
  ];

  return (
    <aside
      className={`bg-[#151F32] border-r border-[#1E293B] flex flex-col justify-between transition-all duration-300 z-30 shrink-0 h-screen sticky top-0 text-[#94A3B8] ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D6A0] to-[#38BDF8] text-[#0B1220] flex items-center justify-center shrink-0 shadow-md shadow-[#00D6A0]/20 font-bold">
              <HeartPulse className="w-6 h-6" />
            </div>
            {!collapsed && (
              <div>
                <span className="font-extrabold text-[#F8FAFC] text-lg tracking-tight leading-none block">
                  Smart<span className="text-[#00D6A0]">Med</span>
                </span>
                <span className="text-[10px] text-[#38BDF8] font-semibold uppercase tracking-wider block mt-0.5">
                  IoT Health System
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] rounded-lg transition-colors cursor-pointer"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 text-xs font-semibold">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  active
                    ? 'bg-[#1E293B] text-[#F8FAFC] border-l-4 border-[#00D6A0] shadow-sm font-bold'
                    : 'text-[#94A3B8] hover:bg-[#1E293B]/70 hover:text-[#F8FAFC]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? 'text-[#00D6A0]' : 'text-[#38BDF8]/80'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Badge */}
      <div className="p-3 border-t border-[#1E293B]">
        {!collapsed ? (
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#F8FAFC]">Hardware State</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                  isDemoMode
                    ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                    : 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                }`}
              >
                {isDemoMode ? 'Demo Simulator' : 'Live ESP32'}
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-snug">
              3-Compartment automated dispenser armed.
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className={`w-3 h-3 rounded-full ${
                isDemoMode ? 'bg-[#38BDF8]' : 'bg-[#00D6A0]'
              }`}
              title={isDemoMode ? 'Demo Mode Active' : 'Live Hardware Connected'}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
