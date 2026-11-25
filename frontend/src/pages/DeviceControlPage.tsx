import React, { useState } from 'react';
import {
  Cpu,
  Sliders,
  Play,
  Volume2,
  Clock,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { DeviceStatus } from '../types';

interface DeviceControlPageProps {
  deviceStatus: DeviceStatus | null;
  onSendCommand: (command: string, compartment?: number, duration?: number) => Promise<void>;
  isDemoMode: boolean;
}

export const DeviceControlPage: React.FC<DeviceControlPageProps> = ({
  deviceStatus,
  onSendCommand,
  isDemoMode
}) => {
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    compartmentId: number;
    title: string;
    description: string;
  }>({
    isOpen: false,
    compartmentId: 1,
    title: '',
    description: ''
  });

  const [executingCommand, setExecutingCommand] = useState<string | null>(null);

  const requestServoTest = (compartmentId: number) => {
    setConfirmModal({
      isOpen: true,
      compartmentId,
      title: `Confirm Manual Flap Test (Chamber ${compartmentId})`,
      description: `This command will energize Servo ${compartmentId} (GPIO ${compartmentId === 1 ? '32' : compartmentId === 2 ? '26' : '27'}) to test dispensing motion cleanly.${!isDemoMode && !deviceStatus?.esp32_online ? ' Note: ESP32 is currently OFFLINE, so this command will queue without moving physical hardware yet.' : ''}`
    });
  };

  const handleConfirmAction = async () => {
    const comp = confirmModal.compartmentId;
    setConfirmModal({ ...confirmModal, isOpen: false });
    setExecutingCommand(`TEST_SERVO_${comp}`);

    await onSendCommand('TEST_SERVO', comp, 3000);

    setTimeout(() => {
      setExecutingCommand(null);
    }, 3200);
  };

  const handleBuzzerTest = async () => {
    setExecutingCommand('TEST_BUZZER');
    await onSendCommand('TEST_BUZZER');
    setTimeout(() => setExecutingCommand(null), 1600);
  };

  const handleSyncRtc = async () => {
    setExecutingCommand('SYNC_RTC');
    await onSendCommand('SYNC_RTC');
    setTimeout(() => setExecutingCommand(null), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            Hardware Diagnostics &amp; Actuator Control
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Real-time peripheral state monitoring, acoustic testing, and independent servo calibration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncRtc}
            className="flex items-center gap-1.5 bg-[#151F32] hover:bg-[#1E293B] text-[#F8FAFC] font-bold text-xs px-3.5 py-2 rounded-xl border border-[#1E293B] shadow-xs cursor-pointer transition-colors"
          >
            <Clock className="w-4 h-4 text-[#38BDF8]" />
            <span>Sync DS3231 RTC</span>
          </button>
          <button
            onClick={handleBuzzerTest}
            className="flex items-center gap-1.5 bg-[#151F32] hover:bg-[#1E293B] text-[#F8FAFC] font-bold text-xs px-3.5 py-2 rounded-xl border border-[#1E293B] shadow-xs cursor-pointer transition-colors"
          >
            <Volume2 className="w-4 h-4 text-[#00D6A0]" />
            <span>Test Alert Buzzer</span>
          </button>
        </div>
      </div>

      {/* Last Command Status Banner */}
      <div className="bg-[#151F32] text-[#F8FAFC] rounded-2xl p-4 shadow-xl flex items-center justify-between border border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1E293B] text-[#00D6A0] flex items-center justify-center border border-[#334155]">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block">
              Last Transmitted Command
            </span>
            <span className="font-mono font-bold text-sm text-[#00D6A0]">
              {deviceStatus?.last_command || 'IDLE / LISTENING'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-[#94A3B8]">Execution: </span>
            <span className="font-bold text-[#F8FAFC]">
              {deviceStatus?.last_command_status || 'READY'}
            </span>
          </div>
          <div className="hidden sm:block">
            <span className="text-[#94A3B8]">Last Seen: </span>
            <span className="text-[#38BDF8]">{deviceStatus?.last_seen || 'Active'}</span>
          </div>
        </div>
      </div>

      {/* Independent 3-Compartment Servo Testing Section */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#F8FAFC]">Independent Servo Flap Actuation</h2>
          <p className="text-xs text-[#94A3B8]">
            Administrators can manually trigger a 3-second diagnostic flap sweep. A confirmation modal prevents accidental triggering.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((compNum) => {
            const stateField = `servo${compNum}_state` as keyof DeviceStatus;
            const currentState = (deviceStatus?.[stateField] as string) || 'CLOSED';
            const isMoving = currentState.includes('OPEN') || currentState === 'MOVING' || executingCommand === `TEST_SERVO_${compNum}`;
            const pinName = compNum === 1 ? 'GPIO 32' : compNum === 2 ? 'GPIO 26' : 'GPIO 27';

            return (
              <div
                key={compNum}
                className="rounded-2xl border border-[#334155] p-5 flex flex-col justify-between space-y-4 bg-[#1E293B]"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-7 h-7 rounded-lg bg-[#0B1220] text-[#00D6A0] font-bold text-xs flex items-center justify-center border border-[#334155]">
                      C{compNum}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#38BDF8] bg-[#0B1220] px-2 py-0.5 rounded border border-[#334155]">
                      {pinName}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-[#F8FAFC] text-sm">
                    {compNum === 1 ? 'Morning Compartment' : compNum === 2 ? 'Afternoon Compartment' : 'Night Compartment'}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1">SG90 Micro Servo 50Hz PWM Actuator</p>

                  <div className="mt-4 p-3 bg-[#151F32] border border-[#1E293B] rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Current Position:</span>
                      <span className={`font-mono font-bold ${isMoving ? 'text-[#F87171] animate-pulse' : 'text-[#F8FAFC]'}`}>
                        {isMoving ? 'OPEN (90°)' : 'CLOSED (0°)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">Hold Duration:</span>
                      <span className="font-mono text-[#F8FAFC]">3000 ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">PWM Auto-Detach:</span>
                      <span className="font-bold text-[#00D6A0]">ENABLED</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => requestServoTest(compNum)}
                  disabled={isMoving}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                    isMoving
                      ? 'bg-[#F87171] text-white animate-pulse cursor-not-allowed'
                      : 'bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220]'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isMoving ? 'Actuating Flap...' : 'Test Dispense Flap'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Hardware Component Diagnostics Matrix */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#F8FAFC]">Peripherals &amp; Subsystem Health Matrix</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* I2C Subsystem */}
          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-2">
            <h3 className="font-bold text-[#F8FAFC] text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#38BDF8]" />
              <span>Shared Hardware I2C Bus (SDA: 21, SCL: 22)</span>
            </h3>
            <div className="space-y-1 text-[#94A3B8]">
              <div className="flex justify-between py-1 border-b border-[#334155]">
                <span>TI TMP117 Digital Temperature (0x48)</span>
                <span className={`font-bold ${deviceStatus?.tmp117_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
                  {deviceStatus?.tmp117_ok ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#334155]">
                <span>Maxim MAX30102 Optical PPG (0x57)</span>
                <span className={`font-bold ${deviceStatus?.max30102_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
                  {deviceStatus?.max30102_ok ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#334155]">
                <span>Maxim DS3231 Real-Time Clock (0x68)</span>
                <span className={`font-bold ${deviceStatus?.ds3231_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
                  {deviceStatus?.ds3231_ok ? 'SYNCED' : 'UNSYNC'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>PCF8574 LCD Backpack Display (0x27)</span>
                <span className={`font-bold ${deviceStatus?.lcd_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
                  {deviceStatus?.lcd_ok ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>

          {/* GPIO & PWM Subsystem */}
          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-2">
            <h3 className="font-bold text-[#F8FAFC] text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#38BDF8]" />
              <span>Dedicated GPIO, PWM &amp; Ultrasonic</span>
            </h3>
            <div className="space-y-1 text-[#94A3B8]">
              <div className="flex justify-between py-1 border-b border-[#334155]">
                <span>HC-SR04 Ultrasonic (TRIG: 5, ECHO: 17)</span>
                <span className={`font-bold font-mono ${deviceStatus?.ultrasonic_ok ? 'text-[#00D6A0]' : 'text-[#F87171]'}`}>
                  {deviceStatus?.ultrasonic_ok && deviceStatus.ultrasonic_distance > 0
                    ? `${deviceStatus.ultrasonic_distance.toFixed(1)} cm (${deviceStatus.ultrasonic_status || ''})`
                    : 'SENSOR ERROR'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#334155]">
                <span>Piezo Buzzer Alert Transducer (GPIO 4)</span>
                <span className="font-bold text-[#F8FAFC] font-mono">{deviceStatus?.buzzer_state || 'IDLE'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#334155]">
                <span>Manual Push-Button Override (GPIO 16)</span>
                <span className="font-bold text-[#00D6A0]">PULLUP ACTIVE</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Wi-Fi RSSI Signal Strength</span>
                <span className="font-bold text-[#F8FAFC] font-mono">
                  {deviceStatus?.esp32_online || isDemoMode ? `${deviceStatus?.wifi_rssi ?? -60} dBm` : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1220]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#151F32] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1E293B] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#F87171] mb-3">
              <ShieldAlert className="w-7 h-7 shrink-0" />
              <h3 className="font-extrabold text-[#F8FAFC] text-base">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed mb-4">
              {confirmModal.description}
            </p>

            <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 mb-4 text-xs text-[#F8FAFC]">
              Ensure that your fingers and any cables are clear of the motorized flap mechanism before proceeding.
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="px-4 py-2 border border-[#334155] rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-5 py-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Authorize &amp; Open Flap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
