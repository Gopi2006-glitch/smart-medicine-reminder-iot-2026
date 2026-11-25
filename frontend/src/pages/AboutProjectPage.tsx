import React from 'react';
import {
  Cpu,
  ShieldCheck,
  BookOpen,
  Code
} from 'lucide-react';

export const AboutProjectPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
          About SmartMed IoT Platform
        </h1>
        <p className="text-xs md:text-sm text-[#94A3B8]">
          Academic Engineering Design, System Architecture &amp; Biomedical Implementation Standards.
        </p>
      </div>

      {/* Project Vision & Motivation */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-[#38BDF8]">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-base font-bold text-[#F8FAFC]">Problem Statement &amp; Clinical Motivation</h2>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          Medication non-adherence is recognized by the World Health Organization (WHO) as a major preventable cause of clinical relapse and emergency re-admissions in elderly patients managing multi-drug chronic conditions (e.g. hypertension, type-2 diabetes, cardiovascular diseases). Conventional alarms do not verify physical access, while standard pill boxes lack integration with the patient's acute physiological response.
        </p>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          <strong className="text-[#F8FAFC]">SmartMed</strong> bridges this gap by coupling a physical, multi-compartment electromechanical dispenser with non-invasive biometric telemetry (optical photoplethysmography and precision thermometry), ensuring closed-loop verification and caregiver transparency.
        </p>
      </div>

      {/* Hardware Architecture Breakdown */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-[#38BDF8]">
          <Cpu className="w-5 h-5" />
          <h2 className="text-base font-bold text-[#F8FAFC]">Embedded Hardware Specifications</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-1.5">
            <h3 className="font-bold text-[#F8FAFC] text-sm">ESP32-WROOM-32 Microcontroller</h3>
            <p className="text-[#94A3B8]">
              Dual-core 32-bit Xtensa LX6 CPU @ 240 MHz, 520 KB SRAM, integrated 2.4 GHz 802.11 b/g/n Wi-Fi transceiver. Operates non-blocking time-sliced sampling tasks using FreeRTOS/Arduino C++.
            </p>
          </div>

          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-1.5">
            <h3 className="font-bold text-[#F8FAFC] text-sm">Texas Instruments TMP117 Digital Temp</h3>
            <p className="text-[#94A3B8]">
              Ultra-high-precision clinical digital temperature sensor communicating via I2C at address <code className="font-mono bg-[#0B1220] text-[#38BDF8] px-1 py-0.5 rounded border border-[#334155]">0x48</code>. Features &plusmn;0.1&deg;C accuracy across the core physiological range (35&deg;C &ndash; 42&deg;C).
            </p>
          </div>

          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-1.5">
            <h3 className="font-bold text-[#F8FAFC] text-sm">Maxim MAX30102 Optical PPG Oximeter</h3>
            <p className="text-[#94A3B8]">
              Low-power dual-wavelength reflectance photoplethysmograph with integrated Red (660nm) and Infrared (880nm) LEDs on I2C address <code className="font-mono bg-[#0B1220] text-[#38BDF8] px-1 py-0.5 rounded border border-[#334155]">0x57</code>. Computes optical blood volume changes and estimated SpO2.
            </p>
          </div>

          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-1.5">
            <h3 className="font-bold text-[#F8FAFC] text-sm">Maxim DS3231 Precision Real-Time Clock</h3>
            <p className="text-[#94A3B8]">
              Temperature-compensated crystal oscillator (TCXO) with coin cell battery backup on I2C <code className="font-mono bg-[#0B1220] text-[#38BDF8] px-1 py-0.5 rounded border border-[#334155]">0x68</code>. Maintains medication schedule accuracy through power failures.
            </p>
          </div>

          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-1.5">
            <h3 className="font-bold text-[#F8FAFC] text-sm">3x SG90 Micro Servos (Chambers 1, 2, 3)</h3>
            <p className="text-[#94A3B8]">
              Assigned to GPIO 32, 26, and 27. Actuates independent mechanical flaps using 50 Hz PWM with software idle detachment, duplicate/conflict locking, and configurable open/close angles.
            </p>
          </div>

          <div className="p-4 border border-[#334155] rounded-xl bg-[#1E293B] space-y-1.5">
            <h3 className="font-bold text-[#F8FAFC] text-sm">HC-SR04 Ultrasonic &amp; 3-Attempt Snooze</h3>
            <p className="text-[#94A3B8]">
              Transmits 40 kHz ultrasound pulses to detect obstacle presence (&le; 5.0 cm configurable threshold &rarr; Object detected) with ECHO 5V&rarr;3.3V divider protection, alongside a 3-attempt 5-minute reminder snooze state machine.
            </p>
          </div>
        </div>
      </div>

      {/* Ethical & Biomedical Engineering Declarations */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-[#00D6A0]">
          <ShieldCheck className="w-5 h-5" />
          <h2 className="text-base font-bold text-[#F8FAFC]">Biomedical Engineering &amp; Ethical Declarations</h2>
        </div>

        <div className="space-y-2 text-xs text-[#F8FAFC] leading-relaxed">
          <div className="p-3 bg-[#1E293B] border border-[#334155] rounded-xl">
            <strong className="text-[#00D6A0] font-bold block mb-1">1. Interaction vs. Ingestion Verification:</strong>
            <span className="text-[#94A3B8]">
              Ultrasonic detection confirms that a user reached into the motorized compartment. In strict compliance with biomedical academic standards, this system explicitly does <em>not</em> claim to confirm that the medication was ingested or swallowed.
            </span>
          </div>

          <div className="p-3 bg-[#1E293B] border border-[#334155] rounded-xl">
            <strong className="text-[#38BDF8] font-bold block mb-1">2. Non-Diagnostic Physiological Estimations:</strong>
            <span className="text-[#94A3B8]">
              Reflectance optical sensors are sensitive to motion artifacts, ambient lighting, and peripheral perfusion. Sensor readings are intended for trend observation and informational monitoring only, not for clinical diagnosis.
            </span>
          </div>
        </div>
      </div>

      {/* Technology Stack Credits */}
      <div className="bg-[#151F32] rounded-2xl border border-[#1E293B] p-6 shadow-xs space-y-3 text-xs text-[#94A3B8]">
        <h3 className="font-bold text-[#F8FAFC] text-sm flex items-center gap-2">
          <Code className="w-4 h-4 text-[#38BDF8]" />
          <span>Full-Stack Web Technology Stack</span>
        </h3>
        <p>
          Built with React 19, TypeScript, Tailwind CSS, Recharts, Lucide Icons, and an asynchronous Node.js backend utilizing the high-performance native <code className="font-mono bg-[#0B1220] text-[#00D6A0] px-1 py-0.5 rounded border border-[#334155]">node:sqlite</code> engine with WebSockets for real-time ESP32 telemetry streaming.
        </p>
      </div>
    </div>
  );
};
