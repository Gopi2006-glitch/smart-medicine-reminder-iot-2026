import React, { useState, useEffect } from 'react';
import {
  User,
  Wifi,
  Save,
  CheckCircle2,
  Sliders,
  Cpu
} from 'lucide-react';
import { SystemSettings } from '../types';

interface SettingsPageProps {
  settings: SystemSettings | null;
  onSaveSettings: (updated: Partial<SystemSettings>) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSaveSettings }) => {
  const [patientName, setPatientName] = useState(settings?.patient_name || 'Robert Davis');
  const [patientAge, setPatientAge] = useState(settings?.patient_age || 68);
  const [doctorName, setDoctorName] = useState(settings?.doctor_name || 'Dr. Sarah Wilson, MD');
  const [emergencyContact, setEmergencyContact] = useState(settings?.emergency_contact || '+1 (555) 234-5678');

  // Clinical health thresholds
  const [lowTemp, setLowTemp] = useState(settings?.low_temp_threshold_c ?? 36.1);
  const [highTemp, setHighTemp] = useState(settings?.high_temp_threshold_c ?? settings?.fever_threshold_c ?? 37.2);
  const [lowSpo2, setLowSpo2] = useState(settings?.low_spo2_threshold ?? 90);
  const [lowHr, setLowHr] = useState(settings?.low_hr_threshold ?? 60);
  const [highHr, setHighHr] = useState(settings?.high_hr_threshold ?? 100);

  // Dispenser & Hardware parameters
  const [reminderTimeout, setReminderTimeout] = useState(settings?.reminder_timeout_sec ?? 300);
  const [ultrasonicThreshold, setUltrasonicThreshold] = useState(settings?.ultrasonic_threshold_cm ?? 5.0);
  const [servoOpenAngle, setServoOpenAngle] = useState(settings?.servo_open_angle ?? 90);
  const [servoCloseAngle, setServoCloseAngle] = useState(settings?.servo_close_angle ?? 0);
  const [buzzerPin, setBuzzerPin] = useState(settings?.buzzer_pin ?? 4);
  const [trigPin, setTrigPin] = useState(settings?.ultrasonic_trig_pin ?? 5);
  const [echoPin, setEchoPin] = useState(settings?.ultrasonic_echo_pin ?? 17);

  const [soundAlerts, setSoundAlerts] = useState(settings ? !!settings.sound_alerts_enabled : true);
  const [webPush, setWebPush] = useState(settings ? !!settings.web_push_enabled : true);
  const [espEndpoint, setEspEndpoint] = useState(settings?.esp32_endpoint || 'http://192.168.1.120');

  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setPatientName(settings.patient_name);
    setPatientAge(settings.patient_age);
    setDoctorName(settings.doctor_name);
    setEmergencyContact(settings.emergency_contact);
    setLowTemp(settings.low_temp_threshold_c ?? 36.1);
    setHighTemp(settings.high_temp_threshold_c ?? settings.fever_threshold_c ?? 37.2);
    setLowSpo2(settings.low_spo2_threshold ?? 90);
    setLowHr(settings.low_hr_threshold ?? 60);
    setHighHr(settings.high_hr_threshold ?? 100);
    setReminderTimeout(settings.reminder_timeout_sec ?? 300);
    setUltrasonicThreshold(settings.ultrasonic_threshold_cm ?? 5.0);
    setServoOpenAngle(settings.servo_open_angle ?? 90);
    setServoCloseAngle(settings.servo_close_angle ?? 0);
    setBuzzerPin(settings.buzzer_pin ?? 4);
    setTrigPin(settings.ultrasonic_trig_pin ?? 5);
    setEchoPin(settings.ultrasonic_echo_pin ?? 17);
    setSoundAlerts(!!settings.sound_alerts_enabled);
    setWebPush(!!settings.web_push_enabled);
    setEspEndpoint(settings.esp32_endpoint || 'http://192.168.1.120');
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await onSaveSettings({
      patient_name: patientName,
      patient_age: patientAge,
      doctor_name: doctorName,
      emergency_contact: emergencyContact,
      low_temp_threshold_c: lowTemp,
      high_temp_threshold_c: highTemp,
      fever_threshold_c: highTemp,
      low_spo2_threshold: lowSpo2,
      low_hr_threshold: lowHr,
      high_hr_threshold: highHr,
      reminder_timeout_sec: reminderTimeout,
      ultrasonic_threshold_cm: ultrasonicThreshold,
      servo_open_angle: servoOpenAngle,
      servo_close_angle: servoCloseAngle,
      buzzer_pin: buzzerPin,
      ultrasonic_trig_pin: trigPin,
      ultrasonic_echo_pin: echoPin,
      sound_alerts_enabled: soundAlerts ? 1 : 0,
      web_push_enabled: webPush ? 1 : 0,
      esp32_endpoint: espEndpoint
    });

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
            System, Clinical &amp; Hardware Preferences
          </h1>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Configure clinical alert thresholds, 3-chamber servo angles, ultrasonic detection rules, and ESP32 sync parameters.
          </p>
        </div>

        {savedFeedback && (
          <div className="flex items-center gap-1.5 bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30 px-3 py-1.5 rounded-xl text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Preferences Saved &amp; Synced</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: User & Patient Profile */}
        <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1E293B]">
            <User className="w-5 h-5 text-[#38BDF8]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">Patient &amp; Medical Profile</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Patient Full Name</label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Patient Age</label>
              <input
                type="number"
                required
                value={patientAge}
                onChange={(e) => setPatientAge(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Attending Physician</label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Emergency Contact Number</label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Configurable Health Warning Thresholds */}
        <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1E293B]">
            <Sliders className="w-5 h-5 text-[#38BDF8]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">Biometric Normal Ranges (Alert Outside Range)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Low Heart Rate Warning (BPM)</label>
              <input
                type="number"
                min="30"
                max="80"
                required
                value={lowHr}
                onChange={(e) => setLowHr(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">LOW alert below 60 BPM</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">High Heart Rate Warning (BPM)</label>
              <input
                type="number"
                min="80"
                max="180"
                required
                value={highHr}
                onChange={(e) => setHighHr(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">HIGH alert above 100 BPM</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Low SpO₂ Warning (%)</label>
              <input
                type="number"
                min="70"
                max="98"
                required
                value={lowSpo2}
                onChange={(e) => setLowSpo2(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">LOW alert below 90%</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Low Temperature Warning (°C)</label>
              <input
                type="number"
                step="0.1"
                required
                value={lowTemp}
                onChange={(e) => setLowTemp(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">LOW alert below 36.1°C</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">High Temperature Warning (°C)</label>
              <input
                type="number"
                step="0.1"
                required
                value={highTemp}
                onChange={(e) => setHighTemp(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">HIGH alert above 37.2°C</span>
            </div>
          </div>
        </div>

        {/* Section 3: Actuators, Ultrasonic & Pin Configuration */}
        <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1E293B]">
            <Cpu className="w-5 h-5 text-[#38BDF8]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">Chambers, Ultrasonic &amp; Pin Calibration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Servo Open Angle (deg)</label>
              <input
                type="number"
                min="20"
                max="180"
                value={servoOpenAngle}
                onChange={(e) => setServoOpenAngle(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono text-[#F8FAFC] focus:outline-none focus:border-[#00D6A0]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">Default: 90°</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Servo Close Angle (deg)</label>
              <input
                type="number"
                min="0"
                max="90"
                value={servoCloseAngle}
                onChange={(e) => setServoCloseAngle(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono text-[#F8FAFC] focus:outline-none focus:border-[#00D6A0]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">Default: 0°</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Ultrasonic Detection Threshold (cm)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="50"
                value={ultrasonicThreshold}
                onChange={(e) => setUltrasonicThreshold(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono text-[#F8FAFC] focus:outline-none focus:border-[#00D6A0]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">&le; Threshold triggers "Object detected" (Default: 5.0 cm)</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Buzzer GPIO (Configurable `#ifndef`)</label>
              <input
                type="number"
                value={buzzerPin}
                onChange={(e) => setBuzzerPin(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono text-[#F8FAFC] focus:outline-none focus:border-[#00D6A0]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">Firmware default: GPIO 4 (`PIN_BUZZER`)</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Ultrasonic TRIG GPIO</label>
              <input
                type="number"
                value={trigPin}
                onChange={(e) => setTrigPin(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono text-[#F8FAFC] focus:outline-none focus:border-[#00D6A0]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">Firmware default: GPIO 5 (`PIN_TRIG`)</span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Ultrasonic ECHO GPIO</label>
              <input
                type="number"
                value={echoPin}
                onChange={(e) => setEchoPin(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono text-[#F8FAFC] focus:outline-none focus:border-[#00D6A0]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">Firmware default: GPIO 17 (`PIN_ECHO`)</span>
            </div>
          </div>

          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 text-[11px] text-[#94A3B8]">
            <strong className="text-[#F8FAFC]">Fixed Hardware Pin Map:</strong> Chambers 1&ndash;3 SG90 Servos = <strong className="text-[#00D6A0]">GPIO 32, 26, 27</strong> &bull; I2C Bus (TMP117, MAX30102, DS3231, LCD) = <strong className="text-[#38BDF8]">SDA GPIO 21 / SCL GPIO 22</strong>.
          </div>
        </div>

        {/* Section 4: Reminder Preferences & Device Networking */}
        <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#1E293B]">
            <Wifi className="w-5 h-5 text-[#38BDF8]" />
            <h2 className="text-base font-bold text-[#F8FAFC]">Snooze Timer &amp; Network Parameters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">Snooze Attempt Interval (Seconds)</label>
              <input
                type="number"
                min="30"
                max="900"
                required
                value={reminderTimeout}
                onChange={(e) => setReminderTimeout(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">
                Interval between the 3 automatic snooze attempts before marking MISSED (Default: 300s = 5 min).
              </span>
            </div>

            <div>
              <label className="block font-bold text-[#F8FAFC] mb-1">ESP32 REST Gateway Endpoint</label>
              <input
                type="text"
                required
                value={espEndpoint}
                onChange={(e) => setEspEndpoint(e.target.value)}
                className="w-full px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl font-mono focus:outline-none focus:border-[#00D6A0] text-[#F8FAFC]"
              />
              <span className="text-[11px] text-[#94A3B8] mt-1 block">
                Local IP of the ESP32 (e.g. http://192.168.1.120).
              </span>
            </div>
          </div>

          <div className="pt-2 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="buzzerToggle"
                checked={soundAlerts}
                onChange={(e) => setSoundAlerts(e.target.checked)}
                className="w-4 h-4 accent-[#00D6A0] rounded"
              />
              <label htmlFor="buzzerToggle" className="font-semibold text-[#F8FAFC]">
                Enable physical ESP32 piezo buzzer acoustic patterns (two-beep health warnings &amp; reminder tones)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="webPushToggle"
                checked={webPush}
                onChange={(e) => setWebPush(e.target.checked)}
                className="w-4 h-4 accent-[#00D6A0] rounded"
              />
              <label htmlFor="webPushToggle" className="font-semibold text-[#F8FAFC]">
                Enable browser alert banners and active reminder notifications
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 bg-[#00D6A0] hover:bg-[#00b887] text-[#0B1220] font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save All Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
