import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NotificationDrawer } from './components/NotificationDrawer';
import { AlertBanner } from './components/AlertBanner';

import { DashboardPage } from './pages/DashboardPage';
import { HealthMonitoringPage } from './pages/HealthMonitoringPage';
import { MedicineManagementPage } from './pages/MedicineManagementPage';
import { MedicineInventoryPage } from './pages/MedicineInventoryPage';
import { ReminderHistoryPage } from './pages/ReminderHistoryPage';
import { DeviceControlPage } from './pages/DeviceControlPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutProjectPage } from './pages/AboutProjectPage';
import { ChambersPage } from './pages/ChambersPage';
import { WeeklyReportPage } from './pages/WeeklyReportPage';

import { api } from './services/api';
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
  SystemSettings
} from './types';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);

  // Core Data States
  const [latestHealth, setLatestHealth] = useState<HealthReading | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthReading[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [dispensingHistory, setDispensingHistory] = useState<DispensingHistory[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [remindersOverview, setRemindersOverview] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [chambersData, setChambersData] = useState<ChambersData | null>(null);
  const [healthAlerts, setHealthAlerts] = useState<HealthAlert[]>([]);
  const [ultrasonicStatus, setUltrasonicStatus] = useState<UltrasonicSnapshot | null>(null);

  // Active Reminder State (for banner)
  const [activeReminder, setActiveReminder] = useState<{
    active: boolean;
    medicineName: string;
    compartmentId: number;
    time: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Initial Data Load
  const fetchAllData = async () => {
    try {
      const [
        healthRes,
        historyRes,
        medsRes,
        remindersRes,
        devRes,
        invRes,
        dispRes,
        notifRes,
        setRes
      ] = await Promise.all([
        api.getLatestHealth(),
        api.getHealthHistory(30),
        api.getMedicines(),
        api.getRemindersOverview(),
        api.getDeviceStatus(),
        api.getInventory(),
        api.getDispensingHistory(),
        api.getNotifications(),
        api.getSettings()
      ]);

      if (healthRes.success) setLatestHealth(healthRes.data);
      if (historyRes.success) setHealthHistory(historyRes.data);
      if (medsRes.success) setMedicines(medsRes.data);
      if (remindersRes.success) setRemindersOverview(remindersRes.data);
      if (devRes.success) {
        setDeviceStatus(devRes.data);
        setIsDemoMode(!!devRes.data.is_demo_mode);
      }
      if (invRes.success) {
        setInventory(invRes.data);
        if (invRes.ultrasonic) setUltrasonicStatus(invRes.ultrasonic);
      }
      if (dispRes.success) setDispensingHistory(dispRes.data);
      if (notifRes.success) setNotifications(notifRes.data);
      if (setRes.success) setSettings(setRes.data);

      const [chambersRes, alertsRes] = await Promise.all([
        api.getChambers(),
        api.getHealthAlerts(30, !!devRes?.data?.is_demo_mode)
      ]);
      if (chambersRes.success) setChambersData(chambersRes.data);
      if (alertsRes.success) setHealthAlerts(alertsRes.data);
    } catch (err) {
      console.warn('[SmartMed App] Backend currently offline or loading. Operating in graceful state.');
    }
  };

  useEffect(() => {
    fetchAllData();

    // Setup WebSocket for real-time telemetry streaming
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WebSocket] Telemetry pipeline connected.');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'LIVE_TELEMETRY' && msg.data) {
              setLatestHealth(msg.data);
              setHealthHistory((prev) => {
                const next = [...prev, msg.data];
                return next.slice(-40); // keep recent 40 points
              });
            } else if (msg.type === 'INITIAL_SNAPSHOT') {
              if (msg.health) setLatestHealth(msg.health);
              if (msg.device) {
                setDeviceStatus(msg.device);
                setIsDemoMode(!!msg.device.is_demo_mode);
              }
            } else if (msg.type === 'MODE_CHANGED') {
              setIsDemoMode(!!msg.is_demo_mode);
              fetchAllData();
            } else if (msg.type === 'ALARM_ACKNOWLEDGED') {
              setActiveReminder(null);
              fetchAllData();
            } else if (
              msg.type === 'HEALTH_ALERT' ||
              msg.type === 'CHAMBER_STATUS' ||
              msg.type === 'EMERGENCY_STOP' ||
              msg.type === 'EMERGENCY_STOP_CLEARED' ||
              msg.type === 'REMINDER_EVENT'
            ) {
              fetchAllData();
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          // Reconnect after 3s
          setTimeout(connectWs, 3000);
        };
      } catch (e) {
        console.warn('WebSocket connection deferred.');
      }
    };

    connectWs();

    // Periodic poll fallback every 5s
    const pollInterval = setInterval(() => {
      fetchAllData();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Handlers
  const handleAddMedicine = async (med: Partial<Medicine>) => {
    await api.createMedicine(med);
    await fetchAllData();
  };

  const handleUpdateMedicine = async (id: number, med: Partial<Medicine>) => {
    await api.updateMedicine(id, med);
    await fetchAllData();
  };

  const handleDeleteMedicine = async (id: number) => {
    await api.deleteMedicine(id);
    await fetchAllData();
  };

  const handleAcknowledgeReminder = async (compartmentId: number) => {
    await api.acknowledgeReminder(compartmentId, 'ACKNOWLEDGED');
    setActiveReminder(null);
    await fetchAllData();
  };

  const handleOpenChamber = async (chamberId: number) => {
    const res = await api.openChamber(chamberId);
    await fetchAllData();
    return res;
  };

  const handleCloseChamber = async (chamberId: number) => {
    const res = await api.closeChamber(chamberId);
    await fetchAllData();
    return res;
  };

  const handleEmergencyStop = async () => {
    await api.emergencyStop();
    await fetchAllData();
  };

  const handleClearEmergencyStop = async () => {
    await api.clearEmergencyStop();
    await fetchAllData();
  };

  const handleSendCommand = async (command: string, compartment?: number, duration?: number) => {
    await api.sendDeviceCommand(command, compartment, duration);
    await fetchAllData();
  };

  const handleUpdateInventoryConfig = async (config: Partial<InventoryItem>) => {
    await api.updateInventoryConfig(config);
    await fetchAllData();
  };

  const handleSaveSettings = async (updated: Partial<SystemSettings>) => {
    await api.updateSettings(updated);
    await fetchAllData();
  };

  const handleToggleDemoMode = async () => {
    const res = await api.toggleDemoMode();
    if (res.success) {
      setIsDemoMode(res.is_demo_mode);
      await fetchAllData();
    }
  };

  const handleMarkNotificationRead = async (id: number) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  };

  const handleClearAllNotifications = async () => {
    await api.clearAllNotifications();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex min-h-screen bg-[#0B1220] text-[#F8FAFC] font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isDemoMode={isDemoMode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          deviceStatus={deviceStatus}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          unreadCount={unreadNotifCount}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          patientName={settings?.patient_name || 'Robert Davis'}
        />

        {/* Emergency / Medication Alert Slide-Down Banner */}
        <AlertBanner
          activeReminder={
            activeReminder ||
            (remindersOverview?.active_reminder
              ? {
                  active: true,
                  medicineName: remindersOverview.active_reminder.medicine_name,
                  compartmentId: remindersOverview.active_reminder.chamber_id,
                  time: remindersOverview.active_reminder.started_at || '--:--',
                  attemptNumber: remindersOverview.active_reminder.attempt_number,
                  maxAttempts: remindersOverview.active_reminder.max_attempts,
                  snoozeCount: remindersOverview.active_reminder.snooze_count
                }
              : null)
          }
          onAcknowledge={handleAcknowledgeReminder}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'dashboard' && (
            <DashboardPage
              latestHealth={latestHealth}
              healthHistory={healthHistory}
              deviceStatus={deviceStatus}
              remindersOverview={remindersOverview}
              onNavigate={setCurrentPage}
              isDemoMode={isDemoMode}
            />
          )}

          {currentPage === 'health' && (
            <HealthMonitoringPage
              latestHealth={latestHealth}
              healthHistory={healthHistory}
              healthAlerts={healthAlerts}
              onRefresh={fetchAllData}
            />
          )}

          {currentPage === 'medicines' && (
            <MedicineManagementPage
              medicines={medicines}
              onAddMedicine={handleAddMedicine}
              onUpdateMedicine={handleUpdateMedicine}
              onDeleteMedicine={handleDeleteMedicine}
            />
          )}

          {currentPage === 'chambers' && (
            <ChambersPage
              chambersData={chambersData}
              onOpenChamber={handleOpenChamber}
              onCloseChamber={handleCloseChamber}
              onEmergencyStop={handleEmergencyStop}
              onClearEmergencyStop={handleClearEmergencyStop}
              onRefresh={fetchAllData}
            />
          )}

          {currentPage === 'inventory' && (
            <MedicineInventoryPage
              inventory={inventory}
              dispensingHistory={dispensingHistory}
              ultrasonic={ultrasonicStatus}
              onUpdateConfig={handleUpdateInventoryConfig}
              onRefresh={fetchAllData}
            />
          )}

          {currentPage === 'history' && (
            <ReminderHistoryPage history={dispensingHistory} />
          )}

          {currentPage === 'reports' && (
            <WeeklyReportPage isDemoMode={isDemoMode} />
          )}

          {currentPage === 'device' && (
            <DeviceControlPage
              deviceStatus={deviceStatus}
              onSendCommand={handleSendCommand}
              isDemoMode={isDemoMode}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {currentPage === 'about' && <AboutProjectPage />}
        </main>
      </div>

      {/* Slide-out Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
        onClearAll={handleClearAllNotifications}
      />
    </div>
  );
};

export default App;
