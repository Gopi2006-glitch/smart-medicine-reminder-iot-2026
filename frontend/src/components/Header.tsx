import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Bell,
  Clock,
  Sparkles
} from 'lucide-react';
import { DeviceStatus } from '../types';

interface HeaderProps {
  deviceStatus: DeviceStatus | null;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  patientName: string;
}

export const Header: React.FC<HeaderProps> = ({
  deviceStatus,
  isDemoMode,
  onToggleDemoMode,
  unreadCount,
  onOpenNotifications,
  patientName
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isOnline = !!deviceStatus?.esp32_online || deviceStatus?.wifi_status === 'Connected';
  const rssi = deviceStatus?.wifi_rssi ?? -60;

  return (
    <header className="h-16 bg-[#151F32]/95 backdrop-blur-md border-b border-[#1E293B] px-6 flex items-center justify-between sticky top-0 z-20 shadow-lg">
      {/* Left: Patient and Time */}
      <div className="flex items-center gap-6">
        <div>
          <h2 className="text-sm font-bold text-[#F8FAFC] leading-tight">
            Patient: <span className="text-[#00D6A0]">{patientName}</span>
          </h2>
          <span className="text-xs text-[#94A3B8] font-medium">SmartMed Clinical Telemetry Station</span>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#1E293B] border border-[#334155] rounded-lg text-xs font-medium text-[#F8FAFC]">
          <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>{currentDate}</span>
          <span className="text-[#38BDF8]">&bull;</span>
          <span className="font-mono font-semibold text-[#00D6A0]">{currentTime}</span>
        </div>
      </div>

      {/* Right Controls: Mode Toggle, Wi-Fi & Notifications */}
      <div className="flex items-center gap-3">
        {/* Hardware / Demo Mode Toggle */}
        <button
          onClick={onToggleDemoMode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:border-[#38BDF8] hover:text-[#F8FAFC] shadow-sm"
          title="Click to toggle between Physical ESP32 Hardware and Live Simulation"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>{isDemoMode ? 'Demo Simulator (ON)' : 'Hardware Mode (Active)'}</span>
        </button>

        {/* Wi-Fi & ESP32 Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
            isOnline
              ? 'bg-[#00D6A0]/10 border-[#00D6A0]/40 text-[#00D6A0]'
              : 'bg-[#F87171]/10 border-[#F87171]/40 text-[#F87171]'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#00D6A0]" />
              <span>ESP32: {deviceStatus?.ip_address || '--'}</span>
              <span className="font-mono text-[11px] text-[#00D6A0]/80">({rssi} dBm)</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[#F87171]" />
              <span>{isDemoMode ? 'ESP32 Offline (Demo Sim)' : 'ESP32 Offline'}</span>
            </>
          )}
        </div>

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] rounded-xl transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-[#F87171] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-[#151F32]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
