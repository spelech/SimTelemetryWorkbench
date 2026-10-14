import React from "react";
import { TelemetrySample } from "../shared/types.js";
import { THROTTLE_PRESETS, useWorkbenchStore } from "./stores/useWorkbenchStore.js";

export interface ScreenshotMeta {
  frameIndex: number;
  t: number;
}

export interface LiveTunerPanelProps {
  activeSample: TelemetrySample | undefined;
  activeScreenshot: ScreenshotMeta | null;
  onPushLiveToSimHub: () => Promise<void>;
  onReplayLoopThroughSimHub: () => Promise<void>;
}

export const LiveTunerPanel: React.FC<LiveTunerPanelProps> = ({
  activeSample,
  activeScreenshot,
  onPushLiveToSimHub,
  onReplayLoopThroughSimHub
}) => {
  const selectedRunId = useWorkbenchStore((s) => s.selectedRunId);
  const cursorTime = useWorkbenchStore((s) => s.cursorTime);
  const loopStartSec = useWorkbenchStore((s) => s.loopStartSec);
  const loopEndSec = useWorkbenchStore((s) => s.loopEndSec);
  const brakeFormula = useWorkbenchStore((s) => s.brakeFormula);
  const throttleFormula = useWorkbenchStore((s) => s.throttleFormula);
  const gain = useWorkbenchStore((s) => s.gain);
  const frequencyHz = useWorkbenchStore((s) => s.frequencyHz);
  const isBusy = useWorkbenchStore((s) => s.isBusy);
  const setBrakeFormula = useWorkbenchStore((s) => s.setBrakeFormula);
  const setThrottleFormula = useWorkbenchStore((s) => s.setThrottleFormula);
  const setGain = useWorkbenchStore((s) => s.setGain);
  const setFrequencyHz = useWorkbenchStore((s) => s.setFrequencyHz);

  return (
    <aside
      data-testid="live-tuner-panel"
      style={{
        borderLeft: "1px solid #1e293b",
        padding: 12,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "#090d16"
      }}
    >
      {/* Synced DXGI Screenshot / Video Frame & Instantaneous Cursor Readout */}
      <div
        data-testid="cursor-readout-card"
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: 10
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#e2e8f0",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <span>SYNCED GAMEPLAY & CURSOR STATE</span>
          <span style={{ color: "#facc15" }}>t = {cursorTime.toFixed(2)}s</span>
        </div>

        {activeScreenshot ? (
          <img
            src={`/api/runs/${encodeURIComponent(selectedRunId)}/screenshot/${activeScreenshot.frameIndex}`}
            alt={`Gameplay frame at ${activeScreenshot.t.toFixed(2)}s`}
            style={{
              width: "100%",
              borderRadius: 6,
              border: "1px solid #334155",
              marginBottom: 8
            }}
          />
        ) : (
          <div
            style={{
              background: "#020617",
              border: "1px solid #1e293b",
              borderRadius: 6,
              padding: "10px 8px",
              textAlign: "center",
              fontSize: 11,
              color: "#64748b",
              marginBottom: 8
            }}
          >
            No DXGI frames in this legacy run (click <b>● Record 15s Run</b> to
            capture 10 FPS DXGI video + 100 Hz WASAPI).
          </div>
        )}

        {activeSample && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              fontSize: 11
            }}
          >
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#94a3b8" }}>Speed / Gear:</span>{" "}
              <b>
                {activeSample.SpeedKmh.toFixed(0)} km/h (G{activeSample.Gear})
              </b>
            </div>
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#94a3b8" }}>RPM:</span>{" "}
              <b>
                {activeSample.Rpms.toFixed(0)} / {activeSample.MaxRpm.toFixed(0)}
              </b>
            </div>
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#22c55e" }}>Throttle:</span>{" "}
              <b>{activeSample.Throttle.toFixed(0)}%</b>
            </div>
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#ef4444" }}>Brake:</span>{" "}
              <b>{activeSample.Brake.toFixed(0)}%</b>
            </div>
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#fb923c" }}>Rear Slip L/R:</span>{" "}
              <b>
                {activeSample["GameRawData.TireSlipRatioRearLeft"].toFixed(2)} /{" "}
                {activeSample["GameRawData.TireSlipRatioRearRight"].toFixed(2)}
              </b>
            </div>
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#34d399" }}>Comb Slip RL/RR:</span>{" "}
              <b>
                {activeSample["GameRawData.TireCombinedSlipRearLeft"].toFixed(2)}{" "}
                /{" "}
                {activeSample["GameRawData.TireCombinedSlipRearRight"].toFixed(2)}
              </b>
            </div>
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#10b981" }}>Throttle Shaker:</span>{" "}
              <b>
                {Number(activeSample["Shaker.PedalThrottle_RMS"] ?? 0).toFixed(3)}{" "}
                RMS
              </b>
            </div>
            <div style={{ background: "#1e293b", padding: 6, borderRadius: 4 }}>
              <span style={{ color: "#f43f5e" }}>Brake Shaker:</span>{" "}
              <b>
                {Number(activeSample["Shaker.PedalBrake_RMS"] ?? 0).toFixed(3)}{" "}
                RMS
              </b>
            </div>
          </div>
        )}
      </div>

      {/* Live ShakeIt Formula Tuner & Replay Loop Controller */}
      <div
        data-testid="formula-tuner-card"
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>
            LIVE SHAKEIT FORMULA TUNER (NO RESTART)
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Edits preview immediately on charts (`Formula.*`) and hot-reload
            into SimHub in &lt;50ms via `.reload`.
          </div>
        </div>

        {/* Preset Selector for Throttle/TCR */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "#cbd5e1",
              marginBottom: 4
            }}
          >
            Scientific Throttle / TCR Formula Presets:
          </label>
          <select
            data-testid="throttle-preset-select"
            value={throttleFormula}
            onChange={(e) => setThrottleFormula(e.target.value)}
            style={{
              width: "100%",
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "5px 8px",
              fontSize: 11
            }}
          >
            {THROTTLE_PRESETS.map((p) => (
              <option key={p.name} value={p.formula}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Throttle Formula Textarea */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "#4ade80",
              marginBottom: 4
            }}
          >
            Throttle Wheelspin / TCR Formula (Nobsound Ch1 — RearLeft):
          </label>
          <textarea
            data-testid="throttle-formula-input"
            rows={4}
            value={throttleFormula}
            onChange={(e) => setThrottleFormula(e.target.value)}
            style={{
              width: "100%",
              background: "#020617",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: 6,
              fontSize: 11,
              fontFamily: "Consolas, monospace"
            }}
          />
        </div>

        {/* Brake ABS Formula Textarea */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "#fb7185",
              marginBottom: 4
            }}
          >
            Brake ABS Lockup Formula (Nobsound Ch0 — FrontLeft):
          </label>
          <textarea
            data-testid="brake-formula-input"
            rows={3}
            value={brakeFormula}
            onChange={(e) => setBrakeFormula(e.target.value)}
            style={{
              width: "100%",
              background: "#020617",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: 6,
              fontSize: 11,
              fontFamily: "Consolas, monospace"
            }}
          />
        </div>

        {/* Gain & Tone Frequency */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block" }}>
              Effect Gain (%):
            </label>
            <input
              data-testid="effect-gain-input"
              type="number"
              min={0}
              max={100}
              value={gain}
              onChange={(e) => setGain(Number(e.target.value))}
              style={{
                width: "100%",
                background: "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                borderRadius: 4,
                padding: "4px 6px",
                fontSize: 12
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#94a3b8", display: "block" }}>
              Carrier Tone (Hz):
            </label>
            <input
              data-testid="carrier-hz-input"
              type="number"
              min={20}
              max={120}
              value={frequencyHz}
              onChange={(e) => setFrequencyHz(Number(e.target.value))}
              style={{
                width: "100%",
                background: "#1e293b",
                color: "#fff",
                border: "1px solid #334155",
                borderRadius: 4,
                padding: "4px 6px",
                fontSize: 12
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <button
          data-testid="push-live-simhub-btn"
          type="button"
          disabled={isBusy}
          onClick={() => void onPushLiveToSimHub()}
          style={{
            background: "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: isBusy ? "wait" : "pointer"
          }}
        >
          ⚡ Push Live to SimHub (.reload — No Restart)
        </button>

        <button
          data-testid="replay-loop-simhub-btn"
          type="button"
          disabled={isBusy}
          onClick={() => void onReplayLoopThroughSimHub()}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: isBusy ? "wait" : "pointer"
          }}
        >
          🔁 Replay Loop [{loopStartSec.toFixed(1)}s–{loopEndSec.toFixed(1)}s]
          via SimHub UDP
        </button>
      </div>
    </aside>
  );
};
