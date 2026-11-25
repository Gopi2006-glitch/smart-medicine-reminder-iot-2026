export type VitalLevel = 'NORMAL' | 'LOW' | 'HIGH' | 'INVALID';

export interface HealthReading {
  id?: number;
  device_id?: string;
  temperature: number;
  heart_rate: number;
  spo2: number;
  status: string;
  finger_detected: boolean | number;
  is_demo?: boolean | number;
  hr_level?: VitalLevel;
  spo2_level?: VitalLevel;
  temp_level?: VitalLevel;
  alert_direction?: 'LOW' | 'HIGH' | null;
  timestamp: string;
}

export interface HealthAlert {
  id: number;
  device_id: string;
  parameter: 'Heart Rate' | 'SpO2' | 'Temperature' | string;
  value: number;
  threshold: number;
  direction: 'LOW' | 'HIGH';
  message: string;
  is_demo: number | boolean;
  acknowledged: number | boolean;
  timestamp: string;
}

export interface DeviceStatus {
  id?: number;
  device_id: string;
  wifi_status: string;
  wifi_ssid: string;
  wifi_rssi: number;
  ip_address: string;
  tmp117_ok: number | boolean;
  max30102_ok: number | boolean;
  ds3231_ok: number | boolean;
  lcd_ok: number | boolean;
  ultrasonic_ok?: number | boolean;
  ultrasonic_distance: number;
  ultrasonic_status?: 'Object detected' | 'Object not detected' | 'SENSOR ERROR' | string;
  servo1_state: 'CLOSED' | 'OPEN' | 'MOVING' | 'ERROR' | string;
  servo2_state: 'CLOSED' | 'OPEN' | 'MOVING' | 'ERROR' | string;
  servo3_state: 'CLOSED' | 'OPEN' | 'MOVING' | 'ERROR' | string;
  servo1_gpio?: number;
  servo2_gpio?: number;
  servo3_gpio?: number;
  servo1_last_op?: string | null;
  servo2_last_op?: string | null;
  servo3_last_op?: string | null;
  buzzer_state: string;
  uptime_seconds: number;
  is_demo_mode: number | boolean;
  esp32_online?: boolean;
  emergency_stopped?: number | boolean;
  active_reminder_schedule_id?: number | null;
  active_reminder_chamber_id?: number | null;
  active_reminder_med_name?: string | null;
  active_reminder_attempt?: number;
  active_reminder_snooze_count?: number;
  active_reminder_started_at?: string | null;
  last_command?: string;
  last_command_id?: number;
  last_command_status?: string;
  last_seen: string;
}

export interface Medicine {
  id: number;
  name: string;
  dosage: string;
  instructions: string;
  frequency: string;
  compartment_id: 1 | 2 | 3;
  schedule_period: 'Morning' | 'Afternoon' | 'Night';
  scheduled_time: string; // HH:MM
  start_date: string;
  end_date?: string | null;
  is_active: number | boolean;
  created_at?: string;
}

export interface DispensingHistory {
  id: number;
  medicine_id?: number | null;
  medicine_name: string;
  compartment_id: number;
  scheduled_time: string;
  event_type: 'DISPENSED' | 'RETRIEVED' | 'ACKNOWLEDGED' | 'SNOOZED' | 'MISSED' | 'MANUAL_TEST' | string;
  method: string;
  notes?: string;
  attempt_number?: number;
  snooze_count?: number;
  acknowledged_at?: string | null;
  is_demo?: number | boolean;
  timestamp: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: 'REMINDER' | 'MISSED' | 'HEALTH_ALERT' | 'INVENTORY' | 'HARDWARE' | string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  is_read: number | boolean;
  timestamp: string;
}

export interface UltrasonicSnapshot {
  threshold_cm: number;
  measured_distance_cm: number;
  sensor_connected: boolean;
  status: 'Object detected' | 'Object not detected' | 'SENSOR ERROR' | string;
  object_detected: boolean;
  note?: string;
}

export interface InventoryItem {
  id: number;
  compartment_id: number;
  medicine_name: string;
  full_distance_cm: number;
  empty_distance_cm: number;
  low_stock_threshold_percent: number;
  current_distance_cm: number;
  estimated_stock_percent: number;
  stock_status: 'SUFFICIENT' | 'LOW' | 'EMPTY' | 'SENSOR ERROR' | string;
  last_checked: string;
}

export interface ChamberItem {
  chamber_id: 1 | 2 | 3;
  gpio_pin: number;
  medicine_name: string;
  scheduled_time: string | null;
  schedule_period: 'Morning' | 'Afternoon' | 'Night' | string;
  status: 'OPEN' | 'CLOSED' | 'MOVING' | 'ERROR' | string;
  last_operation_at: string | null;
}

export interface ChamberOperation {
  id: number;
  chamber_id: number;
  gpio_pin: number | null;
  medicine_name: string | null;
  action: string;
  mode: 'MANUAL' | 'AUTOMATIC' | 'EMERGENCY_STOP' | string;
  status: 'CONFIRMED' | 'QUEUED' | 'EXECUTING' | 'REJECTED' | 'DEMO_SIMULATED' | string;
  notes: string | null;
  is_demo: number | boolean;
  timestamp: string;
}

export interface ChambersData {
  chambers: ChamberItem[];
  operations: ChamberOperation[];
  emergency_stopped: boolean;
  esp32_online: boolean;
  is_demo_mode: boolean;
  servo_open_angle: number;
  servo_close_angle: number;
}

export interface WeeklyHealthSlice {
  reading_count: number;
  has_sufficient_data: boolean;
  avg_hr: number | null;
  min_hr: number | null;
  max_hr: number | null;
  avg_spo2: number | null;
  min_spo2: number | null;
  avg_temp: number | null;
  min_temp: number | null;
  max_temp: number | null;
  temp_variation: number | null;
  abnormal_reading_count: number;
  low_alert_count: number;
  high_alert_count: number;
  daily_series: Array<{
    day: string;
    avg_hr: number | null;
    avg_spo2: number | null;
    avg_temp: number | null;
    samples: number;
  }>;
}

export interface WeeklyMedicineSlice {
  has_sufficient_data: boolean;
  scheduled_doses_triggered: number;
  acknowledged_count: number;
  missed_count: number;
  snooze_attempts_total: number;
  adherence_percent: number | null;
  per_medicine: Array<{
    medicine_name: string;
    compartment_id: number;
    taken: number;
    missed: number;
    snoozes: number;
    adherence_percent: number | null;
  }>;
  daily_series: Array<{
    day: string;
    taken: number;
    missed: number;
  }>;
}

export interface WeeklyReportResponse {
  success: boolean;
  period: {
    start_date: string;
    end_date: string;
    prev_start_date: string;
    prev_end_date: string;
    span_days: number;
  };
  include_demo: boolean;
  provenance: {
    real_health_count: number;
    demo_health_count: number;
    real_disp_count: number;
    demo_disp_count: number;
  };
  health_report: WeeklyHealthSlice & {
    prev_period: WeeklyHealthSlice;
    recent_alerts: HealthAlert[];
  };
  medicine_report: WeeklyMedicineSlice & {
    prev_period: WeeklyMedicineSlice;
  };
  device_report: {
    connectivity_history: Array<{
      id: number;
      event_type: string;
      details: string;
      is_demo: number | boolean;
      timestamp: string;
    }>;
    sensor_errors: Array<{
      id: number;
      event_type: string;
      details: string;
      timestamp: string;
    }>;
    servo_operations: ChamberOperation[];
    servo_operation_count: number;
    ultrasonic_current: UltrasonicSnapshot;
    esp32_online: boolean;
  };
}

export interface SystemSettings {
  id?: number;
  patient_name: string;
  patient_age: number;
  doctor_name: string;
  emergency_contact: string;
  fever_threshold_c: number;
  high_fever_threshold_c: number;
  low_temp_threshold_c?: number;
  high_temp_threshold_c?: number;
  low_spo2_threshold: number;
  low_hr_threshold: number;
  high_hr_threshold: number;
  reminder_timeout_sec: number;
  ultrasonic_threshold_cm?: number;
  servo_open_angle?: number;
  servo_close_angle?: number;
  buzzer_pin?: number;
  ultrasonic_trig_pin?: number;
  ultrasonic_echo_pin?: number;
  buzzer_volume: string;
  sound_alerts_enabled: number | boolean;
  web_push_enabled: number | boolean;
  theme: string;
  timezone: string;
  esp32_endpoint: string;
}
