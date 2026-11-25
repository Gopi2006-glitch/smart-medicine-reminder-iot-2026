const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { db, initDatabase } = require('./db');

const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/telemetry' });

const PORT = process.env.PORT || 5000;
const HEARTBEAT_TIMEOUT_SEC = 20;
const HEALTH_ALERT_COOLDOWN_MS = 30000;

// Initialize database & non-destructive v2 migrations
initDatabase();

app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, '..', 'frontend', 'dist');
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(publicPath));
}

app.get('/', (req, res) => {
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

// -----------------------------------------------------------------------------
// INTERNAL STATE: ALERT COOLDOWN, CONNECTIVITY WATCHDOG & DEMO SNOOZE TIMER
// -----------------------------------------------------------------------------
const alertCooldownMap = {
  HR: { active: false, direction: null, lastLoggedAt: 0 },
  SpO2: { active: false, direction: null, lastLoggedAt: 0 },
  Temp: { active: false, direction: null, lastLoggedAt: 0 }
};

let lastUltrasonicErrorLogged = false;
let demoSnoozeTimerHandle = null;

function broadcastTelemetry(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

function getSettings() {
  return db.prepare('SELECT * FROM system_settings WHERE id = 1').get() || {
    low_hr_threshold: 60,
    high_hr_threshold: 100,
    low_spo2_threshold: 90,
    low_temp_threshold_c: 36.1,
    high_temp_threshold_c: 37.2,
    fever_threshold_c: 37.2,
    ultrasonic_threshold_cm: 5.0,
    reminder_timeout_sec: 300,
    servo_open_angle: 90,
    servo_close_angle: 0,
    buzzer_pin: 4,
    ultrasonic_trig_pin: 5,
    ultrasonic_echo_pin: 17
  };
}

function computeHeartbeatAgeSec(lastSeenStr) {
  if (!lastSeenStr) return null;
  // SQLite CURRENT_TIMESTAMP returns 'YYYY-MM-DD HH:MM:SS' in UTC
  const normalized = lastSeenStr.includes('T') ? lastSeenStr : lastSeenStr.replace(' ', 'T') + 'Z';
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

function enrichDeviceStatus(deviceRow) {
  if (!deviceRow) return null;
  const ageSec = computeHeartbeatAgeSec(deviceRow.last_seen);
  const esp32Online = !deviceRow.is_demo_mode && ageSec !== null && ageSec <= HEARTBEAT_TIMEOUT_SEC && deviceRow.wifi_status === 'Connected';
  return {
    ...deviceRow,
    heartbeat_age_sec: ageSec,
    esp32_online: esp32Online,
    connection_label: deviceRow.is_demo_mode
      ? 'DEMO MODE (Simulated)'
      : (esp32Online ? 'ONLINE (ESP32 Live)' : 'OFFLINE (No ESP32 Heartbeat)')
  };
}

function evaluateHealthParameters({ temperature, heart_rate, spo2, finger_detected = 1 }, settings) {
  const hrLow = Number(settings.low_hr_threshold ?? 60);
  const hrHigh = Number(settings.high_hr_threshold ?? 100);
  const spo2Low = Number(settings.low_spo2_threshold ?? 90);
  const tempLow = Number(settings.low_temp_threshold_c ?? 36.1);
  const tempHigh = Number(settings.high_temp_threshold_c ?? settings.fever_threshold_c ?? 37.2);

  let hrLevel = 'INVALID';
  let spo2Level = 'INVALID';
  let tempLevel = 'INVALID';
  const alerts = [];

  if (finger_detected && typeof heart_rate === 'number' && heart_rate > 0) {
    if (heart_rate < hrLow) {
      hrLevel = 'LOW';
      alerts.push({ parameter: 'Heart Rate', value: heart_rate, threshold: hrLow, direction: 'LOW', unit: 'BPM' });
    } else if (heart_rate > hrHigh) {
      hrLevel = 'HIGH';
      alerts.push({ parameter: 'Heart Rate', value: heart_rate, threshold: hrHigh, direction: 'HIGH', unit: 'BPM' });
    } else {
      hrLevel = 'NORMAL';
    }
  }

  if (finger_detected && typeof spo2 === 'number' && spo2 > 0) {
    if (spo2 < spo2Low) {
      spo2Level = 'LOW';
      alerts.push({ parameter: 'SpO2', value: spo2, threshold: spo2Low, direction: 'LOW', unit: '%' });
    } else {
      spo2Level = 'NORMAL';
    }
  }

  if (typeof temperature === 'number' && temperature > 5.0 && temperature <= 45.0) {
    if (temperature > tempHigh) {
      tempLevel = 'HIGH';
      alerts.push({ parameter: 'Temperature', value: temperature, threshold: tempHigh, direction: 'HIGH', unit: '°C' });
    } else if (temperature < tempLow && (finger_detected || temperature >= 32.0)) {
      tempLevel = 'LOW';
      alerts.push({ parameter: 'Temperature', value: temperature, threshold: tempLow, direction: 'LOW', unit: '°C' });
    } else if (temperature >= tempLow) {
      tempLevel = 'NORMAL';
    }
  }

  let overallStatus = 'NORMAL';
  let alertDirection = null;
  if (alerts.length > 0) {
    const primary = alerts[0];
    overallStatus = `${primary.direction}_${primary.parameter.toUpperCase().replace(/\s+/g, '_')}`;
    alertDirection = primary.direction;
  }

  return { hrLevel, spo2Level, tempLevel, overallStatus, alertDirection, alerts };
}

function recordHealthAlertsWithCooldown(deviceId, evaluation, isDemo) {
  const now = Date.now();
  const keyMap = { 'Heart Rate': 'HR', SpO2: 'SpO2', Temperature: 'Temp' };
  const activeKeys = new Set();
  const recorded = [];

  for (const alert of evaluation.alerts) {
    const key = keyMap[alert.parameter];
    activeKeys.add(key);
    const state = alertCooldownMap[key];
    const shouldRecord = !state.active || state.direction !== alert.direction || (now - state.lastLoggedAt >= HEALTH_ALERT_COOLDOWN_MS);

    if (shouldRecord) {
      state.active = true;
      state.direction = alert.direction;
      state.lastLoggedAt = now;

      const msg = `${alert.parameter} ${alert.direction}: measured ${alert.value}${alert.unit} (threshold ${alert.direction === 'LOW' ? '<' : '>'}${alert.threshold}${alert.unit}).`;

      db.prepare(`
        INSERT INTO health_alerts (device_id, parameter, value, threshold, direction, message, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(deviceId, alert.parameter, alert.value, alert.threshold, alert.direction, msg, isDemo ? 1 : 0);

      db.prepare(`
        INSERT INTO notifications (title, message, type, priority)
        VALUES (?, ?, 'HEALTH_ALERT', 'HIGH')
      `).run(`${alert.direction} ${alert.parameter} Alert`, msg);

      recorded.push({ ...alert, message: msg, timestamp: new Date().toISOString() });
    }
  }

  for (const key of Object.keys(alertCooldownMap)) {
    if (!activeKeys.has(key)) {
      alertCooldownMap[key].active = false;
      alertCooldownMap[key].direction = null;
    }
  }

  if (recorded.length > 0) {
    broadcastTelemetry({ type: 'HEALTH_ALERT', is_demo: !!isDemo, alerts: recorded });
  }
  return recorded;
}

function evaluateUltrasonicStatus(distanceCm, ultrasonicOk, settings) {
  const threshold = Number(settings.ultrasonic_threshold_cm ?? 5.0);
  if (!ultrasonicOk || typeof distanceCm !== 'number' || Number.isNaN(distanceCm) || distanceCm < 0) {
    return { ok: false, distance: -1, objectDetected: false, status: 'SENSOR ERROR', threshold };
  }
  const detected = distanceCm <= threshold;
  return {
    ok: true,
    distance: parseFloat(distanceCm.toFixed(1)),
    objectDetected: detected,
    status: detected ? 'Object detected' : 'Object not detected',
    threshold
  };
}

// -----------------------------------------------------------------------------
// 1. HEALTH TELEMETRY ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/health/latest', (req, res) => {
  try {
    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const settings = getSettings();

    // Never show demo data as real ESP32 readings
    const reading = dev?.is_demo_mode
      ? db.prepare('SELECT * FROM health_readings WHERE is_demo = 1 ORDER BY id DESC LIMIT 1').get()
      : db.prepare('SELECT * FROM health_readings WHERE is_demo = 0 ORDER BY id DESC LIMIT 1').get();

    const alerts = db.prepare(`
      SELECT * FROM health_alerts
      WHERE is_demo = ?
      ORDER BY id DESC LIMIT 10
    `).all(dev?.is_demo_mode ? 1 : 0);

    res.json({
      success: true,
      has_data: !!reading,
      data: reading || null,
      alerts,
      thresholds: {
        low_hr: settings.low_hr_threshold,
        high_hr: settings.high_hr_threshold,
        low_spo2: settings.low_spo2_threshold,
        low_temp: settings.low_temp_threshold_c,
        high_temp: settings.high_temp_threshold_c
      },
      device: dev
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 40;
    const date = req.query.date;
    const dev = db.prepare('SELECT is_demo_mode FROM device_status WHERE id = 1').get();
    const includeDemo = req.query.include_demo !== undefined
      ? (req.query.include_demo === '1' || req.query.include_demo === 'true')
      : !!dev?.is_demo_mode;

    let query = 'SELECT * FROM health_readings WHERE 1=1';
    const params = [];

    if (!includeDemo) {
      query += ' AND is_demo = 0';
    }
    if (date) {
      query += ' AND date(timestamp) = date(?)';
      params.push(date);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, count: rows.length, include_demo: includeDemo, data: rows.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health/alerts', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const includeDemo = req.query.include_demo === '1' || req.query.include_demo === 'true';
    const sql = includeDemo
      ? 'SELECT * FROM health_alerts ORDER BY id DESC LIMIT ?'
      : 'SELECT * FROM health_alerts WHERE is_demo = 0 ORDER BY id DESC LIMIT ?';
    const rows = db.prepare(sql).all(limit);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 2. MEDICINE REMINDER & AUTOMATIC SNOOZE MANAGEMENT ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/medicines', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM medicines ORDER BY compartment_id ASC, id ASC').all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/medicines', (req, res) => {
  try {
    const {
      name, dosage = '1 dose', instructions = '', frequency = 'Daily',
      compartment_id, schedule_period = 'Morning', scheduled_time,
      start_date = new Date().toISOString().split('T')[0], end_date = null,
      is_active = 1
    } = req.body;

    if (!name || !compartment_id || !scheduled_time) {
      return res.status(400).json({ success: false, error: 'Missing required medicine fields (name, chamber, scheduled_time).' });
    }

    const chamberNum = parseInt(compartment_id, 10);
    if (![1, 2, 3].includes(chamberNum)) {
      return res.status(400).json({ success: false, error: 'Assigned chamber must be 1, 2, or 3.' });
    }

    const result = db.prepare(`
      INSERT INTO medicines (name, dosage, instructions, frequency, compartment_id, schedule_period, scheduled_time, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, dosage, instructions, frequency, chamberNum, schedule_period, scheduled_time, start_date, end_date, is_active ? 1 : 0);

    db.prepare('UPDATE inventory_settings SET medicine_name = ? WHERE compartment_id = ?').run(name, chamberNum);

    db.prepare(`
      INSERT INTO notifications (title, message, type, priority)
      VALUES (?, ?, 'REMINDER', 'NORMAL')
    `).run('Schedule Added', `${name} (${dosage}) assigned to Chamber ${chamberNum} at ${scheduled_time}.`);

    broadcastTelemetry({ type: 'SCHEDULES_UPDATED' });
    res.json({ success: true, id: Number(result.lastInsertRowid), message: 'Medicine schedule created.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/medicines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, dosage, instructions, frequency,
      compartment_id, schedule_period, scheduled_time,
      start_date, end_date, is_active
    } = req.body;

    db.prepare(`
      UPDATE medicines SET
        name = COALESCE(?, name),
        dosage = COALESCE(?, dosage),
        instructions = COALESCE(?, instructions),
        frequency = COALESCE(?, frequency),
        compartment_id = COALESCE(?, compartment_id),
        schedule_period = COALESCE(?, schedule_period),
        scheduled_time = COALESCE(?, scheduled_time),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name ?? null,
      dosage ?? null,
      instructions ?? null,
      frequency ?? null,
      compartment_id ?? null,
      schedule_period ?? null,
      scheduled_time ?? null,
      start_date ?? null,
      end_date ?? null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    if (name && compartment_id) {
      db.prepare('UPDATE inventory_settings SET medicine_name = ? WHERE compartment_id = ?').run(name, compartment_id);
    }

    broadcastTelemetry({ type: 'SCHEDULES_UPDATED' });
    res.json({ success: true, message: 'Medicine schedule updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/medicines/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
    broadcastTelemetry({ type: 'SCHEDULES_UPDATED' });
    res.json({ success: true, message: 'Medicine deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/reminders', (req, res) => {
  try {
    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const medicines = db.prepare('SELECT * FROM medicines WHERE is_active = 1 ORDER BY scheduled_time ASC').all();
    const isDemo = !!dev?.is_demo_mode;

    const history = db.prepare(`
      SELECT * FROM dispensing_history
      WHERE date(timestamp) = date('now') AND is_demo = ?
      ORDER BY id DESC
    `).all(isDemo ? 1 : 0);

    const now = new Date();
    const currentHhMm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const completedMedIds = new Set(
      history.filter(h => h.event_type === 'RETRIEVED' || h.event_type === 'ACKNOWLEDGED').map(h => h.medicine_id)
    );
    const missedMedIds = new Set(
      history.filter(h => h.event_type === 'MISSED').map(h => h.medicine_id)
    );

    let nextMed = medicines.find(m => m.scheduled_time > currentHhMm && !completedMedIds.has(m.id))
      || medicines.find(m => !completedMedIds.has(m.id))
      || medicines[0]
      || null;

    const completed = history.filter(h => h.event_type === 'RETRIEVED' || h.event_type === 'ACKNOWLEDGED').length;
    const missed = history.filter(h => h.event_type === 'MISSED').length;
    const pending = Math.max(0, medicines.length - (completed + missed));

    res.json({
      success: true,
      data: {
        next_medicine: nextMed,
        active_reminder: dev?.active_reminder_attempt > 0 ? {
          schedule_id: dev.active_reminder_schedule_id,
          chamber_id: dev.active_reminder_chamber_id,
          medicine_name: dev.active_reminder_med_name,
          attempt_number: dev.active_reminder_attempt,
          snooze_count: dev.active_reminder_snooze_count,
          max_attempts: 3,
          started_at: dev.active_reminder_started_at
        } : null,
        summary: {
          total: medicines.length,
          completed,
          pending,
          missed
        },
        medicines,
        today_history: history
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unified reminder lifecycle event endpoint (used by ESP32 RTC/Snooze FSM & Demo Snooze Runner)
function applyReminderEvent({
  event_type, schedule_id = null, chamber_id = 1, attempt_number = 1, snooze_count = 0,
  medicine_name = null, device_timestamp = null, is_demo = 0
}) {
  const med = schedule_id
    ? db.prepare('SELECT * FROM medicines WHERE id = ?').get(schedule_id)
    : db.prepare('SELECT * FROM medicines WHERE compartment_id = ? LIMIT 1').get(chamber_id);
  const resolvedName = medicine_name || med?.name || `Chamber ${chamber_id}`;
  const resolvedSchedTime = med?.scheduled_time || '--:--';
  const servoField = `servo${chamber_id}_state`;

  if (event_type === 'REMINDER_STARTED') {
    db.prepare(`
      UPDATE device_status SET
        buzzer_state = 'REMINDER_ALARM',
        ${[1, 2, 3].includes(Number(chamber_id)) ? `${servoField} = 'OPEN',` : ''}
        active_reminder_schedule_id = ?,
        active_reminder_chamber_id = ?,
        active_reminder_med_name = ?,
        active_reminder_attempt = 1,
        active_reminder_snooze_count = 0,
        active_reminder_started_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(med?.id || schedule_id, chamber_id, resolvedName);

    db.prepare(`
      INSERT INTO dispensing_history (medicine_id, medicine_name, compartment_id, scheduled_time, event_type, method, notes, attempt_number, snooze_count, is_demo)
      VALUES (?, ?, ?, ?, 'DISPENSED', ?, ?, 1, 0, ?)
    `).run(med?.id || null, resolvedName, chamber_id, resolvedSchedTime,
      is_demo ? 'Demo Schedule Trigger' : 'ESP32 RTC Automatic Dispense',
      `Attempt 1/3 started (${device_timestamp || 'live'})`, is_demo ? 1 : 0);

    db.prepare(`
      INSERT INTO chamber_operations (chamber_id, medicine_name, action, mode, status, notes, is_demo)
      VALUES (?, ?, 'AUTO_DISPENSE', 'AUTOMATIC', ?, ?, ?)
    `).run(chamber_id, resolvedName, is_demo ? 'DEMO_SIMULATED' : 'CONFIRMED', 'Scheduled reminder opened chamber ONCE', is_demo ? 1 : 0);

    db.prepare(`
      INSERT INTO notifications (title, message, type, priority)
      VALUES (?, ?, 'REMINDER', 'HIGH')
    `).run(`Medicine Time: ${resolvedName}`, `Chamber ${chamber_id} opened (Attempt 1/3). 5-minute acknowledgement timer active.`);
  } else if (event_type === 'REMINDER_SNOOZE') {
    // Notice: chamber is NOT opened again during snooze!
    db.prepare(`
      UPDATE device_status SET
        buzzer_state = 'REMINDER_ALARM',
        active_reminder_attempt = ?,
        active_reminder_snooze_count = ?
      WHERE id = 1
    `).run(attempt_number, snooze_count);

    db.prepare(`
      INSERT INTO dispensing_history (medicine_id, medicine_name, compartment_id, scheduled_time, event_type, method, notes, attempt_number, snooze_count, is_demo)
      VALUES (?, ?, ?, ?, 'SNOOZED', ?, ?, ?, ?, ?)
    `).run(med?.id || null, resolvedName, chamber_id, resolvedSchedTime,
      is_demo ? 'Demo Snooze Timer' : 'ESP32 5-Min Snooze Timer',
      `Snooze repeat ${attempt_number}/3 (chamber not reopened)`, attempt_number, snooze_count, is_demo ? 1 : 0);

    db.prepare(`
      INSERT INTO notifications (title, message, type, priority)
      VALUES (?, ?, 'REMINDER', 'HIGH')
    `).run(`Snooze Alert (${attempt_number}/3): ${resolvedName}`, `Unacknowledged dose repeated after 5 minutes. Snooze count: ${snooze_count}.`);
  } else if (event_type === 'REMINDER_MISSED') {
    db.prepare(`
      UPDATE device_status SET
        buzzer_state = 'IDLE',
        ${[1, 2, 3].includes(Number(chamber_id)) ? `${servoField} = 'CLOSED',` : ''}
        active_reminder_schedule_id = NULL,
        active_reminder_chamber_id = NULL,
        active_reminder_med_name = NULL,
        active_reminder_attempt = 0,
        active_reminder_snooze_count = 0,
        active_reminder_started_at = NULL
      WHERE id = 1
    `).run();

    db.prepare(`
      INSERT INTO dispensing_history (medicine_id, medicine_name, compartment_id, scheduled_time, event_type, method, notes, attempt_number, snooze_count, is_demo)
      VALUES (?, ?, ?, ?, 'MISSED', ?, ?, ?, ?, ?)
    `).run(med?.id || null, resolvedName, chamber_id, resolvedSchedTime,
      is_demo ? 'Demo Snooze Exhausted' : 'ESP32 3-Attempt Timeout',
      'Missed after 3 unanswered reminder attempts; buzzer stopped & chamber closed.', attempt_number || 3, snooze_count || 2, is_demo ? 1 : 0);

    db.prepare(`
      INSERT INTO notifications (title, message, type, priority)
      VALUES (?, ?, 'MISSED', 'CRITICAL')
    `).run(`MEDICINE MISSED: ${resolvedName}`, `Chamber ${chamber_id} dose marked MISSED after 3 unanswered reminders.`);
  } else if (event_type === 'REMINDER_ACKNOWLEDGED' || event_type === 'RETRIEVED') {
    db.prepare(`
      UPDATE device_status SET
        buzzer_state = 'IDLE',
        ${[1, 2, 3].includes(Number(chamber_id)) ? `${servoField} = 'CLOSED',` : ''}
        active_reminder_schedule_id = NULL,
        active_reminder_chamber_id = NULL,
        active_reminder_med_name = NULL,
        active_reminder_attempt = 0,
        active_reminder_snooze_count = 0,
        active_reminder_started_at = NULL
      WHERE id = 1
    `).run();

    const storedEventType = event_type === 'REMINDER_ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'RETRIEVED';
    db.prepare(`
      INSERT INTO dispensing_history (medicine_id, medicine_name, compartment_id, scheduled_time, event_type, method, notes, attempt_number, snooze_count, acknowledged_at, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).run(med?.id || null, resolvedName, chamber_id, resolvedSchedTime, storedEventType,
      is_demo ? 'Demo Acknowledge' : 'User Acknowledged',
      `Confirmed taken on attempt ${attempt_number || 1}/3.`, attempt_number || 1, snooze_count || 0, is_demo ? 1 : 0);
  }

  broadcastTelemetry({
    type: 'REMINDER_EVENT',
    event_type,
    schedule_id: med?.id || schedule_id,
    chamber_id,
    medicine_name: resolvedName,
    attempt_number,
    snooze_count,
    is_demo: !!is_demo,
    timestamp: new Date().toISOString()
  });
}

app.post('/api/reminders/event', (req, res) => {
  try {
    const {
      event_type,
      schedule_id = null,
      chamber_id = 1,
      attempt_number = 1,
      snooze_count = 0,
      medicine_name = null,
      device_timestamp = null
    } = req.body;

    if (!event_type) {
      return res.status(400).json({ success: false, error: 'event_type is required.' });
    }
    applyReminderEvent({
      event_type,
      schedule_id,
      chamber_id,
      attempt_number,
      snooze_count,
      medicine_name,
      device_timestamp,
      is_demo: 0
    });
    res.json({ success: true, message: `Reminder event '${event_type}' recorded.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/reminders/acknowledge', (req, res) => {
  try {
    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const {
      compartment_id = dev?.active_reminder_chamber_id || 1,
      event_type = 'RETRIEVED',
      notes = 'Confirmed via Web Dashboard'
    } = req.body || {};

    if (demoSnoozeTimerHandle) {
      clearTimeout(demoSnoozeTimerHandle);
      demoSnoozeTimerHandle = null;
    }

    const attempt = dev?.active_reminder_attempt || 1;
    const snoozes = dev?.active_reminder_snooze_count || 0;
    const normalizedType = event_type === 'MISSED' ? 'REMINDER_MISSED' : 'REMINDER_ACKNOWLEDGED';

    // Queue ACK_REMINDER command to ESP32 if not in demo mode
    if (!dev?.is_demo_mode) {
      const cmdStatus = dev?.esp32_online ? 'EXECUTING' : 'QUEUED';
      const cmdRes = db.prepare(`
        INSERT INTO device_commands (command, chamber_id, status, message)
        VALUES ('ACK_REMINDER', ?, ?, ?)
      `).run(compartment_id, cmdStatus, notes);
      db.prepare('UPDATE device_status SET last_command = ?, last_command_id = ?, last_command_status = ? WHERE id = 1')
        .run('ACK_REMINDER', Number(cmdRes.lastInsertRowid), cmdStatus);
    }

    applyReminderEvent({
      event_type: normalizedType,
      schedule_id: dev?.active_reminder_schedule_id || null,
      chamber_id: compartment_id,
      attempt_number: attempt,
      snooze_count: snoozes,
      medicine_name: dev?.active_reminder_med_name || null,
      is_demo: dev?.is_demo_mode ? 1 : 0
    });

    broadcastTelemetry({ type: 'ALARM_ACKNOWLEDGED', compartment_id, event_type });
    res.json({
      success: true,
      confirmed: !!dev?.is_demo_mode || !!dev?.esp32_online,
      mode: dev?.is_demo_mode ? 'DEMO' : (dev?.esp32_online ? 'ESP32' : 'QUEUED_OFFLINE'),
      message: 'Reminder acknowledged. Further snoozes cancelled & buzzer stopped.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger 3-attempt automatic snooze workflow in Demo Mode (allows fast testing via interval_sec override)
app.post('/api/reminders/trigger-demo', (req, res) => {
  try {
    const dev = db.prepare('SELECT is_demo_mode FROM device_status WHERE id = 1').get();
    if (!dev?.is_demo_mode) {
      return res.status(400).json({
        success: false,
        error: 'Enable Demo Mode to simulate reminder triggers cleanly without mixing real hardware logs.'
      });
    }

    const { medicine_id = 1, interval_sec } = req.body || {};
    const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicine_id)
      || db.prepare('SELECT * FROM medicines WHERE is_active = 1 LIMIT 1').get();

    if (!med) {
      return res.status(404).json({ success: false, error: 'No active medicine schedule found.' });
    }

    if (demoSnoozeTimerHandle) {
      clearTimeout(demoSnoozeTimerHandle);
      demoSnoozeTimerHandle = null;
    }

    const settings = getSettings();
    const waitMs = Math.max(1000, Number(interval_sec || settings.reminder_timeout_sec || 300) * 1000);

    applyReminderEvent({
      event_type: 'REMINDER_STARTED',
      schedule_id: med.id,
      chamber_id: med.compartment_id,
      attempt_number: 1,
      snooze_count: 0,
      medicine_name: med.name,
      is_demo: 1
    });

    const scheduleNext = (currentAttempt) => {
      demoSnoozeTimerHandle = setTimeout(() => {
        try {
          const cur = db.prepare('SELECT active_reminder_attempt, is_demo_mode FROM device_status WHERE id = 1').get();
          if (!cur || !cur.is_demo_mode || cur.active_reminder_attempt === 0) {
            return; // Already acknowledged or stopped
          }

          if (currentAttempt < 3) {
            const nextAttempt = currentAttempt + 1;
            applyReminderEvent({
              event_type: 'REMINDER_SNOOZE',
              schedule_id: med.id,
              chamber_id: med.compartment_id,
              attempt_number: nextAttempt,
              snooze_count: nextAttempt - 1,
              medicine_name: med.name,
              is_demo: 1
            });
            scheduleNext(nextAttempt);
          } else {
            applyReminderEvent({
              event_type: 'REMINDER_MISSED',
              schedule_id: med.id,
              chamber_id: med.compartment_id,
              attempt_number: 3,
              snooze_count: 2,
              medicine_name: med.name,
              is_demo: 1
            });
          }
        } catch (e) {
          console.error('[DEMO SNOOZE ERROR]', e.message);
        }
      }, waitMs);
    };

    scheduleNext(1);
    res.json({
      success: true,
      is_demo: true,
      medicine: med,
      attempt_number: 1,
      max_attempts: 3,
      interval_sec: Math.round(waitMs / 1000),
      message: `Demo reminder started for ${med.name} (Chamber ${med.compartment_id}). Attempt 1/3.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 3. THREE-CHAMBER CONTROL & DEVICE MONITORING ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/chambers', (req, res) => {
  try {
    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const settings = getSettings();
    const medicines = db.prepare('SELECT * FROM medicines ORDER BY is_active DESC, id ASC').all();
    const operations = db.prepare('SELECT * FROM chamber_operations ORDER BY id DESC LIMIT 30').all();

    const gpios = { 1: 32, 2: 26, 3: 27 };
    const chambers = [1, 2, 3].map(cid => {
      const med = medicines.find(m => m.compartment_id === cid && m.is_active) || medicines.find(m => m.compartment_id === cid);
      return {
        chamber_id: cid,
        gpio_pin: gpios[cid],
        medicine_name: med ? med.name : `Unassigned Chamber ${cid}`,
        scheduled_time: med ? med.scheduled_time : null,
        schedule_period: med ? med.schedule_period : (cid === 1 ? 'Morning' : cid === 2 ? 'Afternoon' : 'Night'),
        status: dev[`servo${cid}_state`] || 'CLOSED',
        last_operation_at: dev[`servo${cid}_last_op`] || null
      };
    });

    res.json({
      success: true,
      data: {
        chambers,
        operations,
        emergency_stopped: !!dev?.emergency_stopped,
        esp32_online: !!dev?.esp32_online,
        is_demo_mode: !!dev?.is_demo_mode,
        servo_open_angle: settings.servo_open_angle ?? 90,
        servo_close_angle: settings.servo_close_angle ?? 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function handleChamberCommand(req, res, targetAction) {
  try {
    const cid = parseInt(req.params.id, 10);
    if (![1, 2, 3].includes(cid)) {
      return res.status(400).json({ success: false, error: 'Invalid chamber ID. Must be 1, 2, or 3.' });
    }

    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const stateCol = `servo${cid}_state`;
    const opCol = `servo${cid}_last_op`;
    const currentStatus = dev[stateCol] || 'CLOSED';
    const gpios = { 1: 32, 2: 26, 3: 27 };
    const med = db.prepare('SELECT name FROM medicines WHERE compartment_id = ? AND is_active = 1 LIMIT 1').get(cid)
      || db.prepare('SELECT name FROM medicines WHERE compartment_id = ? LIMIT 1').get(cid);
    const medName = med?.name || `Chamber ${cid}`;

    if (dev.emergency_stopped && targetAction === 'OPEN') {
      return res.status(409).json({
        success: false,
        error: 'Emergency Stop is active. Close chambers or clear Emergency Stop before opening.'
      });
    }

    if (currentStatus === 'MOVING') {
      return res.status(409).json({
        success: false,
        error: `Chamber ${cid} is currently MOVING. Wait for completion before sending another command.`
      });
    }

    if (targetAction === 'OPEN' && currentStatus === 'OPEN') {
      return res.status(409).json({
        success: false,
        error: `Chamber ${cid} is already OPEN.`
      });
    }

    if (targetAction === 'CLOSE' && currentStatus === 'CLOSED') {
      return res.status(409).json({
        success: false,
        error: `Chamber ${cid} is already CLOSED.`
      });
    }

    const commandName = `${targetAction}_CHAMBER_${cid}`;

    // Explicit Demo Mode Simulation
    if (dev.is_demo_mode) {
      db.prepare(`
        UPDATE device_status SET
          ${stateCol} = 'MOVING',
          last_command = ?,
          last_command_status = 'DEMO_SIMULATED'
        WHERE id = 1
      `).run(commandName);

      broadcastTelemetry({ type: 'CHAMBER_STATUS', chamber_id: cid, status: 'MOVING', is_demo: true });

      setTimeout(() => {
        try {
          db.prepare(`
            UPDATE device_status SET
              ${stateCol} = ?,
              ${opCol} = CURRENT_TIMESTAMP,
              ${targetAction === 'CLOSE' ? 'emergency_stopped = 0,' : ''}
              last_command_status = 'DEMO_SIMULATED'
            WHERE id = 1
          `).run(targetAction === 'OPEN' ? 'OPEN' : 'CLOSED');

          db.prepare(`
            INSERT INTO chamber_operations (chamber_id, gpio_pin, medicine_name, action, mode, status, notes, is_demo)
            VALUES (?, ?, ?, ?, 'MANUAL', 'DEMO_SIMULATED', ?, 1)
          `).run(cid, gpios[cid], medName, targetAction, `Demo simulated manual ${targetAction} on GPIO ${gpios[cid]}`);

          broadcastTelemetry({
            type: 'CHAMBER_STATUS',
            chamber_id: cid,
            status: targetAction === 'OPEN' ? 'OPEN' : 'CLOSED',
            is_demo: true
          });
        } catch (_) {}
      }, 450);

      return res.json({
        success: true,
        confirmed: true,
        status: 'DEMO_SIMULATED',
        execution_mode: 'DEMO',
        chamber_id: cid,
        gpio_pin: gpios[cid],
        message: `Demo Mode: Chamber ${cid} (GPIO ${gpios[cid]}) simulated ${targetAction}.`
      });
    }

    // Real Hardware Mode: differentiate ESP32 Online vs Offline honestly!
    const cmdStatus = dev.esp32_online ? 'EXECUTING' : 'QUEUED';
    const cmdRes = db.prepare(`
      INSERT INTO device_commands (command, chamber_id, status, message)
      VALUES (?, ?, ?, ?)
    `).run(commandName, cid, cmdStatus, dev.esp32_online ? 'Dispatched to ESP32' : 'ESP32 offline — queued awaiting connection');
    const cmdId = Number(cmdRes.lastInsertRowid);

    if (dev.esp32_online) {
      db.prepare(`
        UPDATE device_status SET
          ${stateCol} = 'MOVING',
          last_command = ?,
          last_command_id = ?,
          last_command_status = 'EXECUTING'
        WHERE id = 1
      `).run(commandName, cmdId);

      db.prepare(`
        INSERT INTO chamber_operations (chamber_id, gpio_pin, medicine_name, action, mode, status, notes, is_demo)
        VALUES (?, ?, ?, ?, 'MANUAL', 'EXECUTING', 'Sent to live ESP32, awaiting confirmation', 0)
      `).run(cid, gpios[cid], medName, targetAction);

      broadcastTelemetry({ type: 'CHAMBER_STATUS', chamber_id: cid, status: 'MOVING', command_id: cmdId });
      return res.json({
        success: true,
        confirmed: false,
        status: 'EXECUTING',
        execution_mode: 'ESP32_AWAITING_ACK',
        command_id: cmdId,
        chamber_id: cid,
        gpio_pin: gpios[cid],
        message: `Command ${commandName} dispatched to ESP32. Awaiting hardware confirmation.`
      });
    } else {
      db.prepare(`
        UPDATE device_status SET
          last_command = ?,
          last_command_id = ?,
          last_command_status = 'QUEUED'
        WHERE id = 1
      `).run(commandName, cmdId);

      db.prepare(`
        INSERT INTO chamber_operations (chamber_id, gpio_pin, medicine_name, action, mode, status, notes, is_demo)
        VALUES (?, ?, ?, ?, 'MANUAL', 'QUEUED', 'ESP32 offline — command queued (unconfirmed)', 0)
      `).run(cid, gpios[cid], medName, targetAction);

      return res.status(202).json({
        success: true,
        confirmed: false,
        status: 'QUEUED',
        execution_mode: 'OFFLINE_QUEUED',
        command_id: cmdId,
        chamber_id: cid,
        gpio_pin: gpios[cid],
        message: `ESP32 is OFFLINE. Command queued but NOT executed by physical hardware.`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post('/api/chambers/:id/open', (req, res) => handleChamberCommand(req, res, 'OPEN'));
app.post('/api/chambers/:id/close', (req, res) => handleChamberCommand(req, res, 'CLOSE'));

function executeEmergencyStop(req, res) {
  try {
    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());

    if (demoSnoozeTimerHandle) {
      clearTimeout(demoSnoozeTimerHandle);
      demoSnoozeTimerHandle = null;
    }

    const cmdStatus = dev.is_demo_mode ? 'DEMO_SIMULATED' : (dev.esp32_online ? 'EXECUTING' : 'QUEUED');
    const cmdRes = db.prepare(`
      INSERT INTO device_commands (command, chamber_id, status, message)
      VALUES ('EMERGENCY_STOP', 0, ?, 'Emergency stop initiated from dashboard')
    `).run(cmdStatus);

    db.prepare(`
      UPDATE device_status SET
        emergency_stopped = 1,
        buzzer_state = 'IDLE',
        active_reminder_schedule_id = NULL,
        active_reminder_chamber_id = NULL,
        active_reminder_med_name = NULL,
        active_reminder_attempt = 0,
        active_reminder_snooze_count = 0,
        active_reminder_started_at = NULL,
        last_command = 'EMERGENCY_STOP',
        last_command_id = ?,
        last_command_status = ?
      WHERE id = 1
    `).run(Number(cmdRes.lastInsertRowid), cmdStatus);

    db.prepare(`
      INSERT INTO chamber_operations (chamber_id, gpio_pin, medicine_name, action, mode, status, notes, is_demo)
      VALUES (0, NULL, 'ALL CHAMBERS', 'EMERGENCY_STOP', 'EMERGENCY_STOP', ?, 'Halted all servo outputs & alarms', ?)
    `).run(cmdStatus, dev.is_demo_mode ? 1 : 0);

    db.prepare(`
      INSERT INTO notifications (title, message, type, priority)
      VALUES ('EMERGENCY STOP TRIGGERED', 'All servo outputs and active buzzer alerts halted safely.', 'HARDWARE', 'CRITICAL')
    `).run();

    broadcastTelemetry({ type: 'EMERGENCY_STOP', emergency_stopped: true, is_demo: !!dev.is_demo_mode });
    res.json({
      success: true,
      emergency_stopped: true,
      status: cmdStatus,
      message: dev.esp32_online
        ? 'Emergency Stop sent to ESP32!'
        : (dev.is_demo_mode ? 'Emergency Stop activated (Demo Mode).' : 'Emergency Stop latched & queued for ESP32.')
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post('/api/device/emergency-stop', executeEmergencyStop);

app.post('/api/device/emergency-stop/clear', (req, res) => {
  try {
    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const cmdStatus = dev.is_demo_mode ? 'DEMO_SIMULATED' : (dev.esp32_online ? 'EXECUTING' : 'QUEUED');

    const cmdRes = db.prepare(`
      INSERT INTO device_commands (command, chamber_id, status, message)
      VALUES ('CLEAR_EMERGENCY_STOP', 0, ?, 'Operator cleared emergency stop latch')
    `).run(cmdStatus);

    db.prepare(`
      UPDATE device_status SET
        emergency_stopped = 0,
        servo1_state = CASE WHEN servo1_state = 'ERROR' THEN 'CLOSED' ELSE servo1_state END,
        servo2_state = CASE WHEN servo2_state = 'ERROR' THEN 'CLOSED' ELSE servo2_state END,
        servo3_state = CASE WHEN servo3_state = 'ERROR' THEN 'CLOSED' ELSE servo3_state END,
        last_command = 'CLEAR_EMERGENCY_STOP',
        last_command_id = ?,
        last_command_status = ?
      WHERE id = 1
    `).run(Number(cmdRes.lastInsertRowid), cmdStatus);

    db.prepare(`
      INSERT INTO chamber_operations (chamber_id, gpio_pin, medicine_name, action, mode, status, notes, is_demo)
      VALUES (0, NULL, 'ALL CHAMBERS', 'CLEAR_STOP', 'MANUAL', ?, 'Emergency stop latch cleared by operator', ?)
    `).run(cmdStatus, dev.is_demo_mode ? 1 : 0);

    broadcastTelemetry({ type: 'EMERGENCY_STOP', emergency_stopped: false });
    res.json({ success: true, emergency_stopped: false, status: cmdStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/device/status', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM device_status WHERE id = 1').get();
    const enriched = enrichDeviceStatus(row);
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bidirectional config/schedule/command sync consumed every 2s by ESP32
app.get('/api/device/sync', (req, res) => {
  try {
    const settings = getSettings();
    const schedules = db.prepare('SELECT * FROM medicines ORDER BY compartment_id ASC, id ASC LIMIT 3').all();
    const pendingCommand = db.prepare(`
      SELECT * FROM device_commands
      WHERE status IN ('QUEUED', 'EXECUTING')
      ORDER BY id DESC LIMIT 1
    `).get();

    res.json({
      success: true,
      settings,
      schedules,
      pending_command: pendingCommand || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/device/command/ack', (req, res) => {
  try {
    const { command_id, command, status = 'CONFIRMED', message = '', chambers = [] } = req.body;
    const finalStatus = status === 'REJECTED' ? 'REJECTED' : 'CONFIRMED';

    if (command_id) {
      db.prepare(`
        UPDATE device_commands SET status = ?, message = ?, confirmed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(finalStatus, message, command_id);
    }

    if (Array.isArray(chambers)) {
      for (const ch of chambers) {
        if ([1, 2, 3].includes(Number(ch.chamber_id)) && ch.status) {
          db.prepare(`
            UPDATE device_status SET
              servo${ch.chamber_id}_state = ?,
              servo${ch.chamber_id}_last_op = CURRENT_TIMESTAMP
            WHERE id = 1
          `).run(ch.status);
        }
      }
    }

    if (command && (command.startsWith('OPEN_CHAMBER_') || command.startsWith('CLOSE_CHAMBER_'))) {
      const cid = parseInt(command.slice(-1), 10);
      const action = command.startsWith('OPEN') ? 'OPEN' : 'CLOSE';
      db.prepare(`
        INSERT INTO chamber_operations (chamber_id, gpio_pin, medicine_name, action, mode, status, notes, is_demo)
        VALUES (?, ?, NULL, ?, 'MANUAL', ?, ?, 0)
      `).run(cid, cid === 1 ? 32 : cid === 2 ? 26 : 27, action, finalStatus, message || 'Confirmed by ESP32');
    }

    db.prepare(`
      UPDATE device_status SET
        last_command_status = ?,
        last_seen = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(finalStatus);

    broadcastTelemetry({ type: 'COMMAND_COMPLETED', command_id, command, status: finalStatus, message, chambers });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Legacy & device testing commands (honest handling: no fake execution when ESP32 offline!)
app.post('/api/device/command', (req, res) => {
  try {
    const { command, compartment = 1, duration = 3000 } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, error: 'Command missing.' });
    }

    if (command === 'EMERGENCY_STOP') {
      return executeEmergencyStop(req, res);
    }

    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const servoField = `servo${compartment}_state`;
    const dbCmd = command === 'TEST_SERVO' ? `TEST_SERVO_${compartment}` : command;

    if (dev.is_demo_mode) {
      const updates = command === 'TEST_SERVO'
        ? `${servoField} = 'MOVING', buzzer_state = 'BEEP'`
        : (command === 'TEST_BUZZER' ? `buzzer_state = 'ALERT_TEST'` : `ds3231_ok = 1`);

      db.prepare(`
        UPDATE device_status SET
          ${updates},
          last_command = ?,
          last_command_status = 'DEMO_SIMULATED'
        WHERE id = 1
      `).run(dbCmd);

      if (command === 'TEST_SERVO') {
        const med = db.prepare('SELECT name FROM medicines WHERE compartment_id = ? LIMIT 1').get(compartment);
        db.prepare(`
          INSERT INTO chamber_operations (chamber_id, gpio_pin, medicine_name, action, mode, status, notes, is_demo)
          VALUES (?, ?, ?, 'TEST_DISPENSE', 'MANUAL', 'DEMO_SIMULATED', 'Demo Mode test dispense', 1)
        `).run(compartment, compartment === 1 ? 32 : compartment === 2 ? 26 : 27, med?.name || `Chamber ${compartment}`);

        setTimeout(() => {
          try {
            db.prepare(`UPDATE device_status SET ${servoField} = 'CLOSED', buzzer_state = 'IDLE' WHERE id = 1`).run();
            broadcastTelemetry({ type: 'COMMAND_COMPLETED', command: dbCmd, is_demo: true });
          } catch (_) {}
        }, duration);
      } else if (command === 'TEST_BUZZER') {
        setTimeout(() => {
          try {
            db.prepare("UPDATE device_status SET buzzer_state = 'IDLE' WHERE id = 1").run();
            broadcastTelemetry({ type: 'COMMAND_COMPLETED', command: dbCmd, is_demo: true });
          } catch (_) {}
        }, 1200);
      }

      broadcastTelemetry({ type: 'DEVICE_COMMAND', command: dbCmd, compartment, is_demo: true });
      return res.json({ success: true, status: 'DEMO_SIMULATED', message: `Demo Mode: simulated '${dbCmd}'.` });
    }

    // Real Hardware Mode
    const cmdStatus = dev.esp32_online ? 'EXECUTING' : 'QUEUED';
    const cmdRes = db.prepare(`
      INSERT INTO device_commands (command, chamber_id, status, message)
      VALUES (?, ?, ?, ?)
    `).run(dbCmd, compartment, cmdStatus, dev.esp32_online ? 'Dispatched to ESP32' : 'ESP32 offline — queued');

    db.prepare(`
      UPDATE device_status SET
        last_command = ?,
        last_command_id = ?,
        last_command_status = ?
      WHERE id = 1
    `).run(dbCmd, Number(cmdRes.lastInsertRowid), cmdStatus);

    broadcastTelemetry({ type: 'DEVICE_COMMAND', command: dbCmd, compartment, status: cmdStatus });
    return res.status(dev.esp32_online ? 200 : 202).json({
      success: true,
      confirmed: false,
      status: cmdStatus,
      message: dev.esp32_online
        ? `Command '${dbCmd}' sent to ESP32; awaiting hardware confirmation.`
        : `ESP32 offline: '${dbCmd}' queued (not executed on physical hardware).`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Primary telemetry ingest endpoint for ESP32
app.post('/api/device/telemetry', (req, res) => {
  try {
    const {
      device_id = 'SMARTMED_ESP32_01',
      temperature = null,
      heart_rate = null,
      spo2 = null,
      finger_detected = 0,
      ultrasonic_distance = -1,
      ultrasonic_ok = 1,
      wifi_rssi = -60,
      uptime = 0,
      tmp117_ok = 1,
      max30102_ok = 1,
      ds3231_ok = 1,
      lcd_ok = 1,
      chambers = null,
      emergency_stopped = 0
    } = req.body;

    const settings = getSettings();
    const prevDev = db.prepare('SELECT wifi_status, ultrasonic_ok FROM device_status WHERE id = 1').get();
    if (prevDev && prevDev.wifi_status !== 'Connected') {
      db.prepare(`
        INSERT INTO device_connectivity_logs (event_type, details, is_demo)
        VALUES ('ONLINE', ?, 0)
      `).run(`ESP32 '${device_id}' came online (RSSI ${wifi_rssi} dBm)`);
    }

    const evaluation = evaluateHealthParameters(
      { temperature, heart_rate, spo2, finger_detected },
      settings
    );
    const usEval = evaluateUltrasonicStatus(ultrasonic_distance, ultrasonic_ok, settings);

    if (!usEval.ok && !lastUltrasonicErrorLogged) {
      lastUltrasonicErrorLogged = true;
      db.prepare(`
        INSERT INTO device_connectivity_logs (event_type, details, is_demo)
        VALUES ('SENSOR_ERROR', 'Ultrasonic HC-SR04 returned invalid/timeout reading (SENSOR ERROR)', 0)
      `).run();
    } else if (usEval.ok) {
      lastUltrasonicErrorLogged = false;
    }

    // Store real reading ONLY when real physical measurements exist (no fabricated 0 values)
    const hasTemp = typeof temperature === 'number' && temperature > 5.0;
    const hasPpg = finger_detected && typeof heart_rate === 'number' && heart_rate > 0;
    if (hasTemp || hasPpg) {
      db.prepare(`
        INSERT INTO health_readings (device_id, temperature, heart_rate, spo2, status, finger_detected, is_demo, hr_level, spo2_level, temp_level, alert_direction)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      `).run(
        device_id,
        hasTemp ? temperature : 0,
        hasPpg ? heart_rate : 0,
        hasPpg && typeof spo2 === 'number' ? spo2 : 0,
        evaluation.overallStatus,
        finger_detected ? 1 : 0,
        evaluation.hrLevel,
        evaluation.spo2Level,
        evaluation.tempLevel,
        evaluation.alertDirection
      );
    }

    // Save any newly crossed threshold alerts with cooldown
    recordHealthAlertsWithCooldown(device_id, evaluation, false);

    // Build chamber column updates if ESP32 reported actual states
    let servoSql = '';
    const servoParams = [];
    if (Array.isArray(chambers)) {
      for (const ch of chambers) {
        if ([1, 2, 3].includes(Number(ch.chamber_id)) && ch.status) {
          servoSql += `, servo${ch.chamber_id}_state = ?`;
          servoParams.push(ch.status);
        }
      }
    }

    db.prepare(`
      UPDATE device_status SET
        device_id = ?,
        wifi_status = 'Connected',
        wifi_rssi = ?,
        tmp117_ok = ?,
        max30102_ok = ?,
        ds3231_ok = ?,
        lcd_ok = ?,
        ultrasonic_ok = ?,
        ultrasonic_distance = ?,
        ultrasonic_status = ?,
        emergency_stopped = ?,
        uptime_seconds = ?,
        is_demo_mode = 0,
        last_seen = CURRENT_TIMESTAMP
        ${servoSql}
      WHERE id = 1
    `).run(
      device_id,
      wifi_rssi,
      tmp117_ok ? 1 : 0,
      max30102_ok ? 1 : 0,
      ds3231_ok ? 1 : 0,
      lcd_ok ? 1 : 0,
      usEval.ok ? 1 : 0,
      usEval.distance,
      usEval.status,
      emergency_stopped ? 1 : 0,
      uptime,
      ...servoParams
    );

    // Sync ultrasonic snapshot to inventory rows without claiming fake tablet counts
    db.prepare(`
      UPDATE inventory_settings SET
        current_distance_cm = ?,
        stock_status = ?,
        last_checked = CURRENT_TIMESTAMP
    `).run(usEval.distance, usEval.status);

    broadcastTelemetry({
      type: 'LIVE_TELEMETRY',
      is_demo: false,
      data: {
        temperature,
        heart_rate,
        spo2,
        status: evaluation.overallStatus,
        hr_level: evaluation.hrLevel,
        spo2_level: evaluation.spo2Level,
        temp_level: evaluation.tempLevel,
        finger_detected: !!finger_detected,
        ultrasonic_ok: usEval.ok,
        ultrasonic_distance: usEval.distance,
        ultrasonic_status: usEval.status,
        ultrasonic_threshold_cm: usEval.threshold,
        object_detected: usEval.objectDetected,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      evaluation,
      ultrasonic: usEval,
      message: 'Telemetry recorded and broadcast successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 4. ULTRASONIC OBJECT DETECTION & INVENTORY ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/inventory', (req, res) => {
  try {
    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const settings = getSettings();
    const rows = db.prepare('SELECT * FROM inventory_settings ORDER BY compartment_id ASC').all();
    const usEval = evaluateUltrasonicStatus(dev?.ultrasonic_distance ?? -1, !!dev?.ultrasonic_ok, settings);

    res.json({
      success: true,
      ultrasonic: {
        threshold_cm: usEval.threshold,
        measured_distance_cm: usEval.distance,
        sensor_connected: usEval.ok,
        status: usEval.status,
        object_detected: usEval.objectDetected,
        note: 'HC-SR04 measures obstacle distance only; threshold <= ' + usEval.threshold + ' cm indicates Object detected.'
      },
      data: rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/inventory/config', (req, res) => {
  try {
    const {
      compartment_id, full_distance_cm, empty_distance_cm, low_stock_threshold_percent, ultrasonic_threshold_cm
    } = req.body;

    if (ultrasonic_threshold_cm !== undefined) {
      db.prepare('UPDATE system_settings SET ultrasonic_threshold_cm = ? WHERE id = 1').run(Number(ultrasonic_threshold_cm));
    }

    if (compartment_id) {
      db.prepare(`
        UPDATE inventory_settings SET
          full_distance_cm = COALESCE(?, full_distance_cm),
          empty_distance_cm = COALESCE(?, empty_distance_cm),
          low_stock_threshold_percent = COALESCE(?, low_stock_threshold_percent),
          last_checked = CURRENT_TIMESTAMP
        WHERE compartment_id = ?
      `).run(
        full_distance_cm ?? null,
        empty_distance_cm ?? null,
        low_stock_threshold_percent ?? null,
        compartment_id
      );
    }

    res.json({ success: true, message: 'Ultrasonic detection calibration saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 5. NOTIFICATIONS ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/notifications', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 60').all();
    const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get().count;
    res.json({ success: true, unread_count: unreadCount, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/clear', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1').run();
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 6. SYSTEM SETTINGS, DEMO MODE & DISPENSING HISTORY
// -----------------------------------------------------------------------------

app.get('/api/settings', (req, res) => {
  try {
    res.json({ success: true, data: getSettings() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const b = req.body || {};
    const effectiveFever = b.high_temp_threshold_c ?? b.fever_threshold_c ?? null;

    db.prepare(`
      UPDATE system_settings SET
        patient_name = COALESCE(?, patient_name),
        patient_age = COALESCE(?, patient_age),
        doctor_name = COALESCE(?, doctor_name),
        emergency_contact = COALESCE(?, emergency_contact),
        fever_threshold_c = COALESCE(?, fever_threshold_c),
        high_fever_threshold_c = COALESCE(?, high_fever_threshold_c),
        low_temp_threshold_c = COALESCE(?, low_temp_threshold_c),
        high_temp_threshold_c = COALESCE(?, high_temp_threshold_c),
        low_spo2_threshold = COALESCE(?, low_spo2_threshold),
        low_hr_threshold = COALESCE(?, low_hr_threshold),
        high_hr_threshold = COALESCE(?, high_hr_threshold),
        reminder_timeout_sec = COALESCE(?, reminder_timeout_sec),
        ultrasonic_threshold_cm = COALESCE(?, ultrasonic_threshold_cm),
        servo_open_angle = COALESCE(?, servo_open_angle),
        servo_close_angle = COALESCE(?, servo_close_angle),
        buzzer_pin = COALESCE(?, buzzer_pin),
        ultrasonic_trig_pin = COALESCE(?, ultrasonic_trig_pin),
        ultrasonic_echo_pin = COALESCE(?, ultrasonic_echo_pin),
        sound_alerts_enabled = COALESCE(?, sound_alerts_enabled),
        web_push_enabled = COALESCE(?, web_push_enabled),
        timezone = COALESCE(?, timezone),
        esp32_endpoint = COALESCE(?, esp32_endpoint)
      WHERE id = 1
    `).run(
      b.patient_name ?? null,
      b.patient_age ?? null,
      b.doctor_name ?? null,
      b.emergency_contact ?? null,
      effectiveFever,
      b.high_fever_threshold_c ?? null,
      b.low_temp_threshold_c ?? null,
      effectiveFever,
      b.low_spo2_threshold ?? null,
      b.low_hr_threshold ?? null,
      b.high_hr_threshold ?? null,
      b.reminder_timeout_sec ?? null,
      b.ultrasonic_threshold_cm ?? null,
      b.servo_open_angle ?? null,
      b.servo_close_angle ?? null,
      b.buzzer_pin ?? null,
      b.ultrasonic_trig_pin ?? null,
      b.ultrasonic_echo_pin ?? null,
      b.sound_alerts_enabled !== undefined ? (b.sound_alerts_enabled ? 1 : 0) : null,
      b.web_push_enabled !== undefined ? (b.web_push_enabled ? 1 : 0) : null,
      b.timezone ?? null,
      b.esp32_endpoint ?? null
    );

    broadcastTelemetry({ type: 'SETTINGS_UPDATED', settings: getSettings() });
    res.json({ success: true, data: getSettings(), message: 'Settings saved and queued for ESP32 sync.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/mode/toggle', (req, res) => {
  try {
    const cur = db.prepare('SELECT is_demo_mode FROM device_status WHERE id = 1').get();
    const newMode = cur.is_demo_mode ? 0 : 1;

    db.prepare('UPDATE device_status SET is_demo_mode = ? WHERE id = 1').run(newMode);
    db.prepare(`
      INSERT INTO device_connectivity_logs (event_type, details, is_demo)
      VALUES (?, ?, ?)
    `).run(newMode ? 'DEMO_ENABLED' : 'DEMO_DISABLED', newMode ? 'Switched to explicitly labelled Demo Simulation Mode' : 'Switched to Real ESP32 Hardware Mode', newMode);

    if (!newMode && demoSnoozeTimerHandle) {
      clearTimeout(demoSnoozeTimerHandle);
      demoSnoozeTimerHandle = null;
    }

    broadcastTelemetry({
      type: 'MODE_CHANGED',
      is_demo_mode: !!newMode
    });

    res.json({
      success: true,
      is_demo_mode: !!newMode,
      label: newMode ? 'DEMO SIMULATION MODE' : 'LIVE HARDWARE MODE'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dispensing/history', (req, res) => {
  try {
    const includeDemo = req.query.include_demo;
    let query = 'SELECT * FROM dispensing_history';
    if (includeDemo === '0') {
      query += ' WHERE is_demo = 0';
    } else if (includeDemo === '1') {
      query += ' WHERE is_demo = 1';
    }
    query += ' ORDER BY id DESC LIMIT 100';
    const rows = db.prepare(query).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 7. WEEKLY ANALYTICS REPORT ENDPOINT (Calculated Strictly From DB Records)
// -----------------------------------------------------------------------------

function formatDateIso(dateObj) {
  return dateObj.toISOString().split('T')[0];
}

function queryWeeklySlice(startDate, endDate, includeDemo) {
  const demoFilter = includeDemo ? '' : 'AND is_demo = 0';

  const hrAgg = db.prepare(`
    SELECT
      COUNT(*) as total_count,
      COUNT(CASE WHEN heart_rate > 0 THEN 1 END) as hr_count,
      AVG(CASE WHEN heart_rate > 0 THEN heart_rate END) as avg_hr,
      MIN(CASE WHEN heart_rate > 0 THEN heart_rate END) as min_hr,
      MAX(CASE WHEN heart_rate > 0 THEN heart_rate END) as max_hr,
      COUNT(CASE WHEN spo2 > 0 THEN 1 END) as spo2_count,
      AVG(CASE WHEN spo2 > 0 THEN spo2 END) as avg_spo2,
      MIN(CASE WHEN spo2 > 0 THEN spo2 END) as min_spo2,
      COUNT(CASE WHEN temperature > 5 THEN 1 END) as temp_count,
      AVG(CASE WHEN temperature > 5 THEN temperature END) as avg_temp,
      MIN(CASE WHEN temperature > 5 THEN temperature END) as min_temp,
      MAX(CASE WHEN temperature > 5 THEN temperature END) as max_temp
    FROM health_readings
    WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
  `).get(startDate, endDate);

  const alertsAgg = db.prepare(`
    SELECT
      COUNT(*) as total_alerts,
      COUNT(CASE WHEN direction = 'LOW' THEN 1 END) as low_alerts,
      COUNT(CASE WHEN direction = 'HIGH' THEN 1 END) as high_alerts
    FROM health_alerts
    WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
  `).get(startDate, endDate);

  const healthDaily = db.prepare(`
    SELECT
      date(timestamp) as day,
      ROUND(AVG(CASE WHEN heart_rate > 0 THEN heart_rate END), 1) as avg_hr,
      ROUND(AVG(CASE WHEN spo2 > 0 THEN spo2 END), 1) as avg_spo2,
      ROUND(AVG(CASE WHEN temperature > 5 THEN temperature END), 2) as avg_temp,
      COUNT(*) as samples
    FROM health_readings
    WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
    GROUP BY date(timestamp)
    ORDER BY day ASC
  `).all(startDate, endDate);

  const medAgg = db.prepare(`
    SELECT
      COUNT(CASE WHEN event_type IN ('RETRIEVED', 'ACKNOWLEDGED') THEN 1 END) as acknowledged_count,
      COUNT(CASE WHEN event_type = 'MISSED' THEN 1 END) as missed_count,
      COUNT(CASE WHEN event_type = 'SNOOZED' THEN 1 END) as snooze_events,
      COUNT(CASE WHEN event_type = 'DISPENSED' THEN 1 END) as scheduled_triggered
    FROM dispensing_history
    WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
  `).get(startDate, endDate);

  const perMedicine = db.prepare(`
    SELECT
      medicine_name,
      compartment_id,
      COUNT(CASE WHEN event_type IN ('RETRIEVED', 'ACKNOWLEDGED') THEN 1 END) as taken,
      COUNT(CASE WHEN event_type = 'MISSED' THEN 1 END) as missed,
      COUNT(CASE WHEN event_type = 'SNOOZED' THEN 1 END) as snoozes
    FROM dispensing_history
    WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
      AND event_type IN ('RETRIEVED', 'ACKNOWLEDGED', 'MISSED', 'SNOOZED')
    GROUP BY medicine_name, compartment_id
    ORDER BY compartment_id ASC
  `).all(startDate, endDate).map(row => {
    const resolved = row.taken + row.missed;
    return {
      ...row,
      adherence_percent: resolved > 0 ? Math.round((row.taken / resolved) * 100) : null
    };
  });

  const medDaily = db.prepare(`
    SELECT
      date(timestamp) as day,
      COUNT(CASE WHEN event_type IN ('RETRIEVED', 'ACKNOWLEDGED') THEN 1 END) as taken,
      COUNT(CASE WHEN event_type = 'MISSED' THEN 1 END) as missed
    FROM dispensing_history
    WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
      AND event_type IN ('RETRIEVED', 'ACKNOWLEDGED', 'MISSED')
    GROUP BY date(timestamp)
    ORDER BY day ASC
  `).all(startDate, endDate);

  const resolvedDoses = (medAgg.acknowledged_count || 0) + (medAgg.missed_count || 0);
  const adherencePercent = resolvedDoses > 0
    ? Math.round(((medAgg.acknowledged_count || 0) / resolvedDoses) * 100)
    : null;

  return {
    health: {
      reading_count: hrAgg.total_count || 0,
      has_sufficient_data: (hrAgg.total_count || 0) > 0,
      avg_hr: hrAgg.avg_hr != null ? Number(hrAgg.avg_hr.toFixed(1)) : null,
      min_hr: hrAgg.min_hr ?? null,
      max_hr: hrAgg.max_hr ?? null,
      avg_spo2: hrAgg.avg_spo2 != null ? Number(hrAgg.avg_spo2.toFixed(1)) : null,
      min_spo2: hrAgg.min_spo2 ?? null,
      avg_temp: hrAgg.avg_temp != null ? Number(hrAgg.avg_temp.toFixed(2)) : null,
      min_temp: hrAgg.min_temp != null ? Number(hrAgg.min_temp.toFixed(2)) : null,
      max_temp: hrAgg.max_temp != null ? Number(hrAgg.max_temp.toFixed(2)) : null,
      temp_variation: (hrAgg.min_temp != null && hrAgg.max_temp != null)
        ? Number((hrAgg.max_temp - hrAgg.min_temp).toFixed(2))
        : null,
      abnormal_reading_count: alertsAgg.total_alerts || 0,
      low_alert_count: alertsAgg.low_alerts || 0,
      high_alert_count: alertsAgg.high_alerts || 0,
      daily_series: healthDaily
    },
    medicine: {
      has_sufficient_data: resolvedDoses > 0 || (medAgg.scheduled_triggered || 0) > 0,
      scheduled_doses_triggered: medAgg.scheduled_triggered || 0,
      acknowledged_count: medAgg.acknowledged_count || 0,
      missed_count: medAgg.missed_count || 0,
      snooze_attempts_total: medAgg.snooze_events || 0,
      adherence_percent: adherencePercent,
      per_medicine: perMedicine,
      daily_series: medDaily
    }
  };
}

app.get('/api/reports/weekly', (req, res) => {
  try {
    const today = new Date();
    const endDate = req.query.end_date || formatDateIso(today);
    const defaultStart = new Date(endDate + 'T00:00:00Z');
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
    const startDate = req.query.start_date || formatDateIso(defaultStart);

    // Compute exact previous comparison window of same duration
    const startMs = Date.parse(startDate + 'T00:00:00Z');
    const endMs = Date.parse(endDate + 'T00:00:00Z');
    const spanDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
    const prevEndObj = new Date(startMs - 86400000);
    const prevStartObj = new Date(prevEndObj.getTime() - (spanDays - 1) * 86400000);
    const prevStartDate = formatDateIso(prevStartObj);
    const prevEndDate = formatDateIso(prevEndObj);

    const includeDemo = req.query.include_demo === '1' || req.query.include_demo === 'true';

    const currentSlice = queryWeeklySlice(startDate, endDate, includeDemo);
    const prevSlice = queryWeeklySlice(prevStartDate, prevEndDate, includeDemo);

    // Count separate Real vs Demo rows in period for data provenance transparency
    const provenance = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM health_readings WHERE date(timestamp) BETWEEN date(?) AND date(?) AND is_demo = 0) as real_health_count,
        (SELECT COUNT(*) FROM health_readings WHERE date(timestamp) BETWEEN date(?) AND date(?) AND is_demo = 1) as demo_health_count,
        (SELECT COUNT(*) FROM dispensing_history WHERE date(timestamp) BETWEEN date(?) AND date(?) AND is_demo = 0) as real_disp_count,
        (SELECT COUNT(*) FROM dispensing_history WHERE date(timestamp) BETWEEN date(?) AND date(?) AND is_demo = 1) as demo_disp_count
    `).get(startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate);

    // Device report (connectivity, sensor errors, servo ops, ultrasonic)
    const demoFilter = includeDemo ? '' : 'AND is_demo = 0';
    const connectivityHistory = db.prepare(`
      SELECT * FROM device_connectivity_logs
      WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
      ORDER BY id DESC LIMIT 30
    `).all(startDate, endDate);

    const servoOperations = db.prepare(`
      SELECT * FROM chamber_operations
      WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
      ORDER BY id DESC LIMIT 40
    `).all(startDate, endDate);

    const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
    const settings = getSettings();
    const ultrasonicCurrent = evaluateUltrasonicStatus(dev?.ultrasonic_distance ?? -1, !!dev?.ultrasonic_ok, settings);

    const recentAlerts = db.prepare(`
      SELECT * FROM health_alerts
      WHERE date(timestamp) BETWEEN date(?) AND date(?) ${demoFilter}
      ORDER BY id DESC LIMIT 25
    `).all(startDate, endDate);

    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate, prev_start_date: prevStartDate, prev_end_date: prevEndDate, span_days: spanDays },
      include_demo: includeDemo,
      provenance,
      health_report: {
        ...currentSlice.health,
        prev_period: prevSlice.health,
        recent_alerts: recentAlerts
      },
      medicine_report: {
        ...currentSlice.medicine,
        prev_period: prevSlice.medicine
      },
      device_report: {
        connectivity_history: connectivityHistory,
        sensor_errors: connectivityHistory.filter(c => c.event_type === 'SENSOR_ERROR'),
        servo_operations: servoOperations,
        servo_operation_count: servoOperations.length,
        ultrasonic_current: ultrasonicCurrent,
        esp32_online: !!dev?.esp32_online
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 8. WEBSOCKET ENGINE, HEARTBEAT WATCHDOG & EXPLICIT DEMO SIMULATOR
// -----------------------------------------------------------------------------

wss.on('connection', (ws) => {
  console.log('[WS] Client connected to live telemetry stream.');
  const dev = enrichDeviceStatus(db.prepare('SELECT * FROM device_status WHERE id = 1').get());
  const latestHealth = dev?.is_demo_mode
    ? db.prepare('SELECT * FROM health_readings WHERE is_demo = 1 ORDER BY id DESC LIMIT 1').get()
    : db.prepare('SELECT * FROM health_readings WHERE is_demo = 0 ORDER BY id DESC LIMIT 1').get();

  ws.send(JSON.stringify({
    type: 'INITIAL_SNAPSHOT',
    health: latestHealth || null,
    device: dev
  }));
});

// Watchdog every 5s: marks ESP32 OFFLINE honestly if real heartbeat stops > 20s
setInterval(() => {
  try {
    const dev = db.prepare('SELECT * FROM device_status WHERE id = 1').get();
    if (!dev || dev.is_demo_mode) return;

    const ageSec = computeHeartbeatAgeSec(dev.last_seen);
    if (dev.wifi_status === 'Connected' && (ageSec === null || ageSec > HEARTBEAT_TIMEOUT_SEC)) {
      db.prepare("UPDATE device_status SET wifi_status = 'Offline', tmp117_ok = 0, max30102_ok = 0, ultrasonic_ok = 0, ultrasonic_status = 'SENSOR ERROR' WHERE id = 1").run();
      db.prepare(`
        INSERT INTO device_connectivity_logs (event_type, details, is_demo)
        VALUES ('OFFLINE', ?, 0)
      `).run(`No telemetry heartbeat received for >${HEARTBEAT_TIMEOUT_SEC}s`);
      db.prepare(`
        INSERT INTO notifications (title, message, type, priority)
        VALUES ('DEVICE OFFLINE', 'ESP32 hardware stopped sending telemetry heartbeats. Check connection.', 'HARDWARE', 'HIGH')
      `).run();
      broadcastTelemetry({ type: 'DEVICE_OFFLINE', timestamp: new Date().toISOString() });
    }
  } catch (_) {}
}, 5000);

// Explicit Demo Mode Simulator (every 3s ONLY when user enables Demo Mode)
setInterval(() => {
  try {
    const dev = db.prepare('SELECT is_demo_mode FROM device_status WHERE id = 1').get();
    if (!dev || !dev.is_demo_mode) return;

    const settings = getSettings();
    const baseTemp = parseFloat((36.7 + (Math.sin(Date.now() / 20000) * 0.2) + (Math.random() * 0.08)).toFixed(2));
    const baseHr = Math.round(72 + (Math.sin(Date.now() / 15000) * 5) + (Math.random() * 3));
    const baseSpo2 = Math.min(100, Math.max(96, Math.round(98 + (Math.sin(Date.now() / 30000) * 1.5))));
    const dist = parseFloat((4.8 + (Math.sin(Date.now() / 25000) * 1.6)).toFixed(1));

    const evaluation = evaluateHealthParameters(
      { temperature: baseTemp, heart_rate: baseHr, spo2: baseSpo2, finger_detected: 1 },
      settings
    );
    const usEval = evaluateUltrasonicStatus(dist, true, settings);

    db.prepare(`
      INSERT INTO health_readings (device_id, temperature, heart_rate, spo2, status, finger_detected, is_demo, hr_level, spo2_level, temp_level, alert_direction)
      VALUES ('SMARTMED_DEMO', ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
    `).run(baseTemp, baseHr, baseSpo2, evaluation.overallStatus, evaluation.hrLevel, evaluation.spo2Level, evaluation.tempLevel, evaluation.alertDirection);

    db.prepare(`
      UPDATE device_status SET
        ultrasonic_ok = 1,
        ultrasonic_distance = ?,
        ultrasonic_status = ?,
        tmp117_ok = 1,
        max30102_ok = 1,
        ds3231_ok = 1,
        lcd_ok = 1,
        uptime_seconds = uptime_seconds + 3
      WHERE id = 1
    `).run(usEval.distance, usEval.status);

    broadcastTelemetry({
      type: 'LIVE_TELEMETRY',
      is_demo: true,
      data: {
        temperature: baseTemp,
        heart_rate: baseHr,
        spo2: baseSpo2,
        status: evaluation.overallStatus,
        hr_level: evaluation.hrLevel,
        spo2_level: evaluation.spo2Level,
        temp_level: evaluation.tempLevel,
        finger_detected: true,
        ultrasonic_ok: true,
        ultrasonic_distance: usEval.distance,
        ultrasonic_status: usEval.status,
        ultrasonic_threshold_cm: usEval.threshold,
        object_detected: usEval.objectDetected,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[SIMULATOR ERROR]', err.message);
  }
}, 3000);

const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`========================================================`);
  console.log(`  SmartMed IoT Health Platform - Backend API Server`);
  console.log(`  HTTP REST Server : http://localhost:${PORT}`);
  console.log(`  WebSocket Server : ws://localhost:${PORT}/ws/telemetry`);
  console.log(`========================================================`);
});
