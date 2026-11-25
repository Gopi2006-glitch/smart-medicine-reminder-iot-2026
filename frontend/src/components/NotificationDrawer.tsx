import React from 'react';
import { X, CheckCheck, AlertTriangle, Bell, Clock, Cpu, Pill } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
  onClearAll: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onClearAll,
}) => {
  if (!isOpen) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'REMINDER':
        return <Pill className="w-4 h-4 text-[#00D6A0]" />;
      case 'MISSED':
      case 'HEALTH_ALERT':
        return <AlertTriangle className="w-4 h-4 text-[#F87171]" />;
      case 'HARDWARE':
        return <Cpu className="w-4 h-4 text-[#38BDF8]" />;
      default:
        return <Bell className="w-4 h-4 text-[#38BDF8]" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
      case 'HIGH':
        return <span className="text-[10px] bg-[#F87171] text-white px-2 py-0.5 rounded font-bold">URGENT</span>;
      case 'NORMAL':
        return <span className="text-[10px] bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40 px-2 py-0.5 rounded font-bold">NORMAL</span>;
      default:
        return <span className="text-[10px] bg-[#1E293B] text-[#94A3B8] px-2 py-0.5 rounded border border-[#334155]">INFO</span>;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0B1220]/75 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-md bg-[#151F32] h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 border-l border-[#1E293B]">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between bg-[#1E293B] text-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[#38BDF8]" />
            <h3 className="font-bold text-[#F8FAFC] text-base">System Notifications</h3>
            <span className="text-xs bg-[#151F32] text-[#38BDF8] font-bold px-2.5 py-0.5 rounded-full border border-[#334155]">
              {unreadCount} Unread
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClearAll}
              className="text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] flex items-center gap-1 p-1 hover:bg-[#151F32] rounded cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#151F32] rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B1220]">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#94A3B8] space-y-2">
              <Bell className="w-10 h-10 stroke-1 opacity-50 text-[#38BDF8]" />
              <p className="text-sm font-semibold">No recent notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  n.is_read
                    ? 'bg-[#151F32] border-[#1E293B] opacity-75 hover:opacity-100 shadow-xs'
                    : 'bg-[#1E293B] border-[#38BDF8]/40 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(n.type)}
                    <h4 className="text-xs font-bold text-[#F8FAFC]">{n.title}</h4>
                  </div>
                  {getPriorityBadge(n.priority)}
                </div>

                <p className="text-xs text-[#94A3B8] pl-6 leading-relaxed mb-2">{n.message}</p>

                <div className="flex items-center justify-between pl-6 text-[11px] text-[#38BDF8]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#94A3B8]" />
                    <span className="text-[#94A3B8]">{n.timestamp}</span>
                  </span>
                  {!n.is_read && (
                    <span className="text-[10px] text-[#00D6A0] font-bold hover:underline">
                      Click to mark read
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-[#151F32] border-t border-[#1E293B] text-center">
          <p className="text-[11px] text-[#94A3B8] font-semibold">
            SmartMed IoT Automatic Telemetry Alert Engine
          </p>
        </div>
      </div>
    </div>
  );
};
