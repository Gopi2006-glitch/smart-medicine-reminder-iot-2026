const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.SMARTMED_DB_PATH || path.join(__dirname, 'smartmed.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function hasColumn(tableName, colName) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some(c => c.name === colName);
}

function addColumnIfMissing(tableName, colName, definitionSql) {
  if (!hasColumn(tableName, colName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${definitionSql};`);
  }
}

function initDatabase() {
  console.log('[DB] Initializing SmartMed SQLite tables at:', dbPath);

  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT DEFAULT 'Patient',
      emergency_contact TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Medicines table
  db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      instructions TEXT,
      frequency TEXT DEFAULT 'Daily',
      compartment_id INTEGER NOT NULL CHECK (compartment_id IN (1, 2, 3)),
      schedule_period TEXT DEFAULT 'Morning',
      scheduled_time TEXT NOT NULL, -- Format: 'HH:MM'
      start_date DATE NOT NULL,
      end_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Health Readings table (TMP117 & MAX30102 Telemetry)
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      temperature REAL NOT NULL,
      heart_rate INTEGER NOT NULL,
      spo2 INTEGER NOT NULL,
      status TEXT DEFAULT 'NORMAL',
      finger_detected INTEGER DEFAULT 1,
      is_demo INTEGER DEFAULT 0,
      hr_level TEXT DEFAULT 'NORMAL',
      spo2_level TEXT DEFAULT 'NORMAL',
      temp_level TEXT DEFAULT 'NORMAL',
      alert_direction TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Device Status table (Telemetry & Diagnostic snapshot)
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_id TEXT NOT NULL,
      wifi_status TEXT DEFAULT 'Offline',
      wifi_ssid TEXT DEFAULT 'Home_WiFi',
      wifi_rssi INTEGER DEFAULT -60,
      ip_address TEXT DEFAULT '192.168.1.120',
      tmp117_ok INTEGER DEFAULT 0,
      max30102_ok INTEGER DEFAULT 0,
      ds3231_ok INTEGER DEFAULT 0,
      lcd_ok INTEGER DEFAULT 0,
      ultrasonic_ok INTEGER DEFAULT 0,
      ultrasonic_distance REAL DEFAULT -1,
      ultrasonic_status TEXT DEFAULT 'SENSOR ERROR',
      servo1_state TEXT DEFAULT 'CLOSED',
      servo2_state TEXT DEFAULT 'CLOSED',
      servo3_state TEXT DEFAULT 'CLOSED',
      servo1_gpio INTEGER DEFAULT 32,
      servo2_gpio INTEGER DEFAULT 26,
      servo3_gpio INTEGER DEFAULT 27,
      servo1_last_op DATETIME,
      servo2_last_op DATETIME,
      servo3_last_op DATETIME,
      buzzer_state TEXT DEFAULT 'IDLE',
      uptime_seconds INTEGER DEFAULT 0,
      is_demo_mode INTEGER DEFAULT 0,
      emergency_stopped INTEGER DEFAULT 0,
      active_reminder_schedule_id INTEGER,
      active_reminder_chamber_id INTEGER,
      active_reminder_med_name TEXT,
      active_reminder_attempt INTEGER DEFAULT 0,
      active_reminder_snooze_count INTEGER DEFAULT 0,
      active_reminder_started_at DATETIME,
      last_command TEXT,
      last_command_id INTEGER DEFAULT 0,
      last_command_status TEXT,
      last_seen DATETIME
    );
  `);

  // 5. Dispensing & Reminder History table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dispensing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER,
      medicine_name TEXT NOT NULL,
      compartment_id INTEGER NOT NULL,
      scheduled_time TEXT NOT NULL,
      event_type TEXT NOT NULL, -- 'DISPENSED', 'RETRIEVED', 'ACKNOWLEDGED', 'SNOOZED', 'MISSED', 'MANUAL_TEST'
      method TEXT DEFAULT 'ESP32 RTC Schedule',
      notes TEXT,
      attempt_number INTEGER DEFAULT 1,
      snooze_count INTEGER DEFAULT 0,
      acknowledged_at DATETIME,
      is_demo INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      priority TEXT DEFAULT 'NORMAL',
      is_read INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Inventory Settings & Ultrasonic Proximity Calibration
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compartment_id INTEGER UNIQUE NOT NULL,
      medicine_name TEXT NOT NULL,
      full_distance_cm REAL DEFAULT 3.0,
      empty_distance_cm REAL DEFAULT 15.0,
      low_stock_threshold_percent INTEGER DEFAULT 25,
      current_distance_cm REAL DEFAULT -1.0,
      estimated_stock_percent INTEGER DEFAULT 0,
      stock_status TEXT DEFAULT 'SENSOR ERROR',
      last_checked DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. System Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      patient_name TEXT DEFAULT 'Robert Davis',
      patient_age INTEGER DEFAULT 68,
      doctor_name TEXT DEFAULT 'Dr. Sarah Wilson, MD',
      emergency_contact TEXT DEFAULT '+1 (555) 234-5678',
      fever_threshold_c REAL DEFAULT 37.2,
      high_fever_threshold_c REAL DEFAULT 38.5,
      low_temp_threshold_c REAL DEFAULT 36.1,
      high_temp_threshold_c REAL DEFAULT 37.2,
      low_spo2_threshold INTEGER DEFAULT 90,
      low_hr_threshold INTEGER DEFAULT 60,
      high_hr_threshold INTEGER DEFAULT 100,
      reminder_timeout_sec INTEGER DEFAULT 300,
      ultrasonic_threshold_cm REAL DEFAULT 5.0,
      servo_open_angle INTEGER DEFAULT 90,
      servo_close_angle INTEGER DEFAULT 0,
      buzzer_pin INTEGER DEFAULT 4,
      ultrasonic_trig_pin INTEGER DEFAULT 5,
      ultrasonic_echo_pin INTEGER DEFAULT 17,
      buzzer_volume TEXT DEFAULT 'HIGH',
      sound_alerts_enabled INTEGER DEFAULT 1,
      web_push_enabled INTEGER DEFAULT 1,
      theme TEXT DEFAULT 'light',
      timezone TEXT DEFAULT 'UTC',
      esp32_endpoint TEXT DEFAULT 'http://192.168.1.120'
    );
  `);

  // 9. Health Alerts table (LOW / HIGH parameter violations with timestamps)
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      parameter TEXT NOT NULL,     -- 'Heart Rate', 'SpO2', 'Temperature'
      value REAL NOT NULL,
      threshold REAL NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('LOW', 'HIGH')),
      message TEXT NOT NULL,
      is_demo INTEGER DEFAULT 0,
      acknowledged INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. Chamber Operations Log table (Manual OPEN/CLOSE, Automatic Dispense, Emergency Stop)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chamber_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chamber_id INTEGER NOT NULL CHECK (chamber_id IN (0, 1, 2, 3)),
      gpio_pin INTEGER,
      medicine_name TEXT,
      action TEXT NOT NULL,        -- 'OPEN', 'CLOSE', 'AUTO_DISPENSE', 'EMERGENCY_STOP', 'CLEAR_STOP'
      mode TEXT NOT NULL CHECK (mode IN ('MANUAL', 'AUTOMATIC', 'EMERGENCY_STOP')),
      status TEXT NOT NULL,        -- 'CONFIRMED', 'QUEUED', 'REJECTED', 'DEMO_SIMULATED'
      notes TEXT,
      is_demo INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Command Queue table (Hardware confirmation tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      chamber_id INTEGER DEFAULT 0,
      status TEXT NOT NULL,        -- 'QUEUED', 'EXECUTING', 'CONFIRMED', 'REJECTED', 'DEMO_SIMULATED'
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME
    );
  `);

  // 12. Connectivity History & Error Log table (For Weekly Device Report)
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_connectivity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,    -- 'ONLINE', 'OFFLINE', 'SENSOR_ERROR', 'DEMO_ENABLED', 'DEMO_DISABLED'
      details TEXT,
      is_demo INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Schema migrations for existing SQLite files created before this update
  addColumnIfMissing('health_readings', 'hr_level', "TEXT DEFAULT 'NORMAL'");
  addColumnIfMissing('health_readings', 'spo2_level', "TEXT DEFAULT 'NORMAL'");
  addColumnIfMissing('health_readings', 'temp_level', "TEXT DEFAULT 'NORMAL'");
  addColumnIfMissing('health_readings', 'alert_direction', 'TEXT');

  addColumnIfMissing('device_status', 'ultrasonic_ok', 'INTEGER DEFAULT 0');
  addColumnIfMissing('device_status', 'ultrasonic_status', "TEXT DEFAULT 'SENSOR ERROR'");
  addColumnIfMissing('device_status', 'servo1_gpio', 'INTEGER DEFAULT 32');
  addColumnIfMissing('device_status', 'servo2_gpio', 'INTEGER DEFAULT 26');
  addColumnIfMissing('device_status', 'servo3_gpio', 'INTEGER DEFAULT 27');
  addColumnIfMissing('device_status', 'servo1_last_op', 'DATETIME');
  addColumnIfMissing('device_status', 'servo2_last_op', 'DATETIME');
  addColumnIfMissing('device_status', 'servo3_last_op', 'DATETIME');
  addColumnIfMissing('device_status', 'emergency_stopped', 'INTEGER DEFAULT 0');
  addColumnIfMissing('device_status', 'active_reminder_schedule_id', 'INTEGER');
  addColumnIfMissing('device_status', 'active_reminder_chamber_id', 'INTEGER');
  addColumnIfMissing('device_status', 'active_reminder_med_name', 'TEXT');
  addColumnIfMissing('device_status', 'active_reminder_attempt', 'INTEGER DEFAULT 0');
  addColumnIfMissing('device_status', 'active_reminder_snooze_count', 'INTEGER DEFAULT 0');
  addColumnIfMissing('device_status', 'active_reminder_started_at', 'DATETIME');
  addColumnIfMissing('device_status', 'last_command_id', 'INTEGER DEFAULT 0');

  addColumnIfMissing('dispensing_history', 'attempt_number', 'INTEGER DEFAULT 1');
  addColumnIfMissing('dispensing_history', 'snooze_count', 'INTEGER DEFAULT 0');
  addColumnIfMissing('dispensing_history', 'acknowledged_at', 'DATETIME');
  addColumnIfMissing('dispensing_history', 'is_demo', 'INTEGER DEFAULT 0');

  addColumnIfMissing('system_settings', 'low_temp_threshold_c', 'REAL DEFAULT 36.1');
  addColumnIfMissing('system_settings', 'high_temp_threshold_c', 'REAL DEFAULT 37.2');
  addColumnIfMissing('system_settings', 'ultrasonic_threshold_cm', 'REAL DEFAULT 5.0');
  addColumnIfMissing('system_settings', 'servo_open_angle', 'INTEGER DEFAULT 90');
  addColumnIfMissing('system_settings', 'servo_close_angle', 'INTEGER DEFAULT 0');
  addColumnIfMissing('system_settings', 'buzzer_pin', 'INTEGER DEFAULT 4');
  addColumnIfMissing('system_settings', 'ultrasonic_trig_pin', 'INTEGER DEFAULT 5');
  addColumnIfMissing('system_settings', 'ultrasonic_echo_pin', 'INTEGER DEFAULT 17');
  addColumnIfMissing('system_settings', 'schema_version', 'INTEGER DEFAULT 1');

  // Ensure GPIO pin fields reflect updated wiring (32, 26, 27)
  db.prepare(`
    UPDATE device_status SET servo1_gpio = 32, servo2_gpio = 26, servo3_gpio = 27
    WHERE id = 1
  `).run();

  // Seed default device status if empty (honestly starts offline until real ESP32 heartbeats)
  const devRow = db.prepare('SELECT id FROM device_status WHERE id = 1').get();
  if (!devRow) {
    db.prepare(`
      INSERT INTO device_status (
        id, device_id, wifi_status, wifi_ssid, wifi_rssi, ip_address,
        tmp117_ok, max30102_ok, ds3231_ok, lcd_ok, ultrasonic_ok,
        ultrasonic_distance, ultrasonic_status,
        servo1_state, servo2_state, servo3_state,
        servo1_gpio, servo2_gpio, servo3_gpio,
        buzzer_state, uptime_seconds, is_demo_mode, emergency_stopped,
        last_command, last_command_status, last_seen
      ) VALUES (
        1, 'SMARTMED_ESP32_01', 'Offline', 'Home_WiFi', 0, '192.168.1.120',
        0, 0, 0, 0, 0, -1, 'SENSOR ERROR',
        'CLOSED', 'CLOSED', 'CLOSED',
        32, 26, 27,
        'IDLE', 0, 0, 0,
        NULL, NULL, NULL
      );
    `).run();
  }

  // Seed default settings if empty
  const setRow = db.prepare('SELECT * FROM system_settings WHERE id = 1').get();
  if (!setRow) {
    db.prepare('INSERT INTO system_settings (id, schema_version) VALUES (1, 2)').run();
  } else if ((setRow.schema_version || 1) < 2) {
    // Non-destructively upgrade untouched v1 factory defaults to exact v2 clinical specs
    if (
      setRow.fever_threshold_c === 37.8 &&
      setRow.low_spo2_threshold === 92 &&
      setRow.low_hr_threshold === 50 &&
      setRow.high_hr_threshold === 115
    ) {
      db.prepare(`
        UPDATE system_settings SET
          fever_threshold_c = 37.2,
          low_temp_threshold_c = 36.1,
          high_temp_threshold_c = 37.2,
          low_spo2_threshold = 90,
          low_hr_threshold = 60,
          high_hr_threshold = 100,
          ultrasonic_threshold_cm = 5.0
        WHERE id = 1
      `).run();
    }

    // Upgrade untouched v1 seed schedule times (08:00/13:00/20:00) to requested defaults (09:00/12:30/21:00)
    db.prepare("UPDATE medicines SET scheduled_time = '09:00' WHERE id = 1 AND name = 'Metformin HCl' AND scheduled_time = '08:00'").run();
    db.prepare("UPDATE medicines SET scheduled_time = '12:30' WHERE id = 2 AND name = 'Lisinopril' AND scheduled_time = '13:00'").run();
    db.prepare("UPDATE medicines SET scheduled_time = '21:00' WHERE id = 3 AND name = 'Atorvastatin' AND scheduled_time = '20:00'").run();

    // Separate pre-seeded v1 sample readings as demo records so Real ESP32 Reports never mix fake data
    db.prepare("UPDATE health_readings SET is_demo = 1 WHERE device_id = 'SMARTMED_ESP32_01' AND id <= 9").run();
    db.prepare("UPDATE dispensing_history SET is_demo = 1 WHERE id <= 3").run();

    db.prepare('UPDATE system_settings SET schema_version = 2 WHERE id = 1').run();
  }

  // Seed default medicines if empty (Morning 09:00 AM, Afternoon 12:30 PM, Night 09:00 PM)
  const medCount = db.prepare('SELECT COUNT(*) as count FROM medicines').get();
  if (medCount.count === 0) {
    console.log('[DB] Seeding default medication schedules (09:00 AM, 12:30 PM, 09:00 PM)...');
    const insertMed = db.prepare(`
      INSERT INTO medicines (name, dosage, instructions, frequency, compartment_id, schedule_period, scheduled_time, start_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), 1)
    `);

    insertMed.run('Morning Medication', '1 tablet', 'Take after breakfast with water', 'Daily', 1, 'Morning', '09:00');
    insertMed.run('Afternoon Medication', '1 tablet', 'Take after lunch with water', 'Daily', 2, 'Afternoon', '12:30');
    insertMed.run('Night Medication', '1 tablet', 'Take before sleep with water', 'Daily', 3, 'Night', '21:00');
  }

  // Seed default ultrasonic calibration rows if empty
  const invCount = db.prepare('SELECT COUNT(*) as count FROM inventory_settings').get();
  if (invCount.count === 0) {
    const insertInv = db.prepare(`
      INSERT INTO inventory_settings (compartment_id, medicine_name, full_distance_cm, empty_distance_cm, low_stock_threshold_percent, current_distance_cm, estimated_stock_percent, stock_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertInv.run(1, 'Morning Medication', 2.0, 15.0, 25, -1.0, 0, 'SENSOR ERROR');
    insertInv.run(2, 'Afternoon Medication', 2.0, 15.0, 25, -1.0, 0, 'SENSOR ERROR');
    insertInv.run(3, 'Night Medication', 2.0, 15.0, 25, -1.0, 0, 'SENSOR ERROR');
  }

  console.log('[DB] Database tables, migrations, and defaults ready.');
}

module.exports = {
  db,
  initDatabase
};
