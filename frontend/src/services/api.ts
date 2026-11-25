import {
  HealthReading,
  HealthAlert,
  DeviceStatus,
  Medicine,
  DispensingHistory,
  NotificationItem,
  InventoryItem,
  UltrasonicSnapshot,
  ChambersData,
  WeeklyReportResponse,
  SystemSettings
} from '../types';

const API_BASE = '/api';

export const api = {
  // Health
  getLatestHealth: async (): Promise<{
    success: boolean;
    has_data?: boolean;
    data: HealthReading | null;
    alerts?: HealthAlert[];
    thresholds?: Record<string, number>;
    device: DeviceStatus;
  }> => {
    const res = await fetch(`${API_BASE}/health/latest`);
    return res.json();
  },

  getHealthHistory: async (
    limit = 50,
    date?: string,
    includeDemo?: boolean
  ): Promise<{ success: boolean; count?: number; include_demo?: boolean; data: HealthReading[] }> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (date) params.set('date', date);
    if (includeDemo !== undefined) params.set('include_demo', includeDemo ? '1' : '0');
    const res = await fetch(`${API_BASE}/health/history?${params.toString()}`);
    return res.json();
  },

  getHealthAlerts: async (
    limit = 30,
    includeDemo = false
  ): Promise<{ success: boolean; data: HealthAlert[] }> => {
    const res = await fetch(`${API_BASE}/health/alerts?limit=${limit}&include_demo=${includeDemo ? 1 : 0}`);
    return res.json();
  },

  // Medicines
  getMedicines: async (): Promise<{ success: boolean; data: Medicine[] }> => {
    const res = await fetch(`${API_BASE}/medicines`);
    return res.json();
  },

  createMedicine: async (med: Partial<Medicine>): Promise<{ success: boolean; id: number }> => {
    const res = await fetch(`${API_BASE}/medicines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(med)
    });
    return res.json();
  },

  updateMedicine: async (id: number, med: Partial<Medicine>): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/medicines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(med)
    });
    return res.json();
  },

  deleteMedicine: async (id: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/medicines/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Reminders & Snooze Lifecycle
  getRemindersOverview: async (): Promise<{ success: boolean; data: any }> => {
    const res = await fetch(`${API_BASE}/reminders`);
    return res.json();
  },

  acknowledgeReminder: async (compartment_id: number, event_type = 'ACKNOWLEDGED'): Promise<{ success: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE}/reminders/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compartment_id, event_type })
    });
    return res.json();
  },

  triggerDemoReminder: async (compartment_id = 1, fast_mode = true): Promise<{ success: boolean; error?: string; message?: string }> => {
    const res = await fetch(`${API_BASE}/reminders/trigger-demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compartment_id, fast_mode })
    });
    return res.json();
  },

  // Three-Chamber Control
  getChambers: async (): Promise<{ success: boolean; data: ChambersData }> => {
    const res = await fetch(`${API_BASE}/chambers`);
    return res.json();
  },

  openChamber: async (chamberId: number): Promise<{ success: boolean; confirmed?: boolean; status?: string; message?: string; error?: string }> => {
    const res = await fetch(`${API_BASE}/chambers/${chamberId}/open`, { method: 'POST' });
    return res.json();
  },

  closeChamber: async (chamberId: number): Promise<{ success: boolean; confirmed?: boolean; status?: string; message?: string; error?: string }> => {
    const res = await fetch(`${API_BASE}/chambers/${chamberId}/close`, { method: 'POST' });
    return res.json();
  },

  emergencyStop: async (): Promise<{ success: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE}/device/emergency-stop`, { method: 'POST' });
    return res.json();
  },

  clearEmergencyStop: async (): Promise<{ success: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE}/device/emergency-stop/clear`, { method: 'POST' });
    return res.json();
  },

  // Device Status & Commands
  getDeviceStatus: async (): Promise<{ success: boolean; data: DeviceStatus }> => {
    const res = await fetch(`${API_BASE}/device/status`);
    return res.json();
  },

  sendDeviceCommand: async (command: string, compartment = 1, duration = 3000): Promise<{ success: boolean; message?: string; error?: string }> => {
    const res = await fetch(`${API_BASE}/device/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, compartment, duration })
    });
    return res.json();
  },

  // Inventory & Ultrasonic
  getInventory: async (): Promise<{ success: boolean; ultrasonic?: UltrasonicSnapshot; data: InventoryItem[] }> => {
    const res = await fetch(`${API_BASE}/inventory`);
    return res.json();
  },

  updateInventoryConfig: async (config: Partial<InventoryItem> & { ultrasonic_threshold_cm?: number }): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/inventory/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  },

  // Dispensing History
  getDispensingHistory: async (includeDemo?: boolean): Promise<{ success: boolean; data: DispensingHistory[] }> => {
    const q = includeDemo !== undefined ? `?include_demo=${includeDemo ? 1 : 0}` : '';
    const res = await fetch(`${API_BASE}/dispensing/history${q}`);
    return res.json();
  },

  // Weekly Reports
  getWeeklyReport: async (startDate?: string, endDate?: string, includeDemo = false): Promise<WeeklyReportResponse> => {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    params.set('include_demo', includeDemo ? '1' : '0');
    const res = await fetch(`${API_BASE}/reports/weekly?${params.toString()}`);
    return res.json();
  },

  // Notifications
  getNotifications: async (): Promise<{ success: boolean; unread_count: number; data: NotificationItem[] }> => {
    const res = await fetch(`${API_BASE}/notifications`);
    return res.json();
  },

  markNotificationRead: async (id: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'POST' });
    return res.json();
  },

  clearAllNotifications: async (): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/notifications/clear`, { method: 'POST' });
    return res.json();
  },

  // Settings & Demo Mode
  getSettings: async (): Promise<{ success: boolean; data: SystemSettings }> => {
    const res = await fetch(`${API_BASE}/settings`);
    return res.json();
  },

  updateSettings: async (settings: Partial<SystemSettings>): Promise<{ success: boolean; data?: SystemSettings }> => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  },

  toggleDemoMode: async (): Promise<{ success: boolean; is_demo_mode: boolean; label: string }> => {
    const res = await fetch(`${API_BASE}/mode/toggle`, { method: 'POST' });
    return res.json();
  }
};
