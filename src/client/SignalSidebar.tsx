import React from "react";
import { RunSummary } from "../shared/types.js";
import { SIGNAL_CATALOG } from "./signalCatalog.js";
import { useWorkbenchStore } from "./stores/useWorkbenchStore.js";

export interface SignalSidebarProps {
  runs: RunSummary[];
  onStartLiveCapture: (durationSec: number) => Promise<void>;
  onRefreshRuns: () => Promise<void>;
}

export const SignalSidebar: React.FC<SignalSidebarProps> = ({
  runs,
  onStartLiveCapture,
  onRefreshRuns
}) => {
  const selectedRunId = useWorkbenchStore((s) => s.selectedRunId);
  const isBusy = useWorkbenchStore((s) => s.isBusy);
  const setSelectedRunId = useWorkbenchStore((s) => s.setSelectedRunId);
  const createNewLaneWithSignal = useWorkbenchStore(
    (s) => s.createNewLaneWithSignal
  );

  const categories = Array.from(
    new Set(SIGNAL_CATALOG.map((s) => s.category))
  );
  const selectedRunSummary = runs.find((r) => r.id === selectedRunId);

  return (
    <aside
      data-testid="signal-sidebar"
      style={{
        borderRight: "1px solid #1e293b",
        padding: 12,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "#090d16"
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#38bdf8",
            letterSpacing: 0.3
          }}
        >
          SIM TELEMETRY WORKBENCH
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          FH6 & ACC • 4-Ch WASAPI • Hot-Reload
        </div>
      </div>

      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: 10
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: "#94a3b8",
            marginBottom: 6
          }}
        >
          TELEMETRY RUN / REPLAY
        </label>
        <select
          data-testid="run-selector"
          value={selectedRunId}
          onChange={(e) => setSelectedRunId(e.target.value)}
          style={{
            width: "100%",
            background: "#1e293b",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 12
          }}
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.durationSec}s)
            </option>
          ))}
        </select>

        {selectedRunSummary && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#94a3b8",
              display: "flex",
              flexWrap: "wrap",
              gap: 6
            }}
          >
            <span>Car: {selectedRunSummary.carModel}</span>
            <span>•</span>
            <span>{selectedRunSummary.sampleCount} pts</span>
            {selectedRunSummary.hasAudioTap && (
              <span style={{ color: "#10b981", fontWeight: 600 }}>
                • 4-Ch WASAPI
              </span>
            )}
            {selectedRunSummary.screenshotCount > 0 && (
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                • {selectedRunSummary.screenshotCount} Frames
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            data-testid="record-15s-btn"
            type="button"
            disabled={isBusy}
            onClick={() => void onStartLiveCapture(15)}
            style={{
              flex: 1,
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
              fontWeight: 600,
              cursor: isBusy ? "wait" : "pointer"
            }}
          >
            ● Record 15s Run
          </button>
          <button
            data-testid="refresh-runs-btn"
            type="button"
            disabled={isBusy}
            onClick={() => void onRefreshRuns()}
            style={{
              background: "#1e293b",
              color: "#cbd5e1",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
              cursor: "pointer"
            }}
          >
            ↻
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#94a3b8" }}>
        Drag any signal onto a chart to overlay, or click <b>+</b> to add a new
        lane:
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#cbd5e1",
              marginBottom: 5,
              textTransform: "uppercase",
              letterSpacing: 0.4
            }}
          >
            {cat}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {SIGNAL_CATALOG.filter((s) => s.category === cat).map((sig) => (
              <div
                key={sig.key}
                data-testid={`signal-item-${sig.key}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/telemetry-signal", sig.key);
                }}
                title={sig.description}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "5px 8px",
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: "grab"
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: sig.color,
                      flexShrink: 0
                    }}
                  />
                  {sig.label}
                </span>
                <button
                  type="button"
                  onClick={() => createNewLaneWithSignal(sig.key)}
                  title="Create new chart lane with this signal"
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#94a3b8",
                    borderRadius: 4,
                    fontSize: 11,
                    padding: "0 5px",
                    cursor: "pointer"
                  }}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
};
