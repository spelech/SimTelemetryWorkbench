import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AudioTapSample,
  RunSummary,
  ShakeItCustomFormulaRule,
  TelemetrySample
} from "../shared/types.js";
import { evaluateFormulaSeries } from "../shared/formulaEvaluator.js";
import { DEFAULT_CHART_LANES, SIGNAL_CATALOG } from "./signalCatalog.js";
import { TelemetryChartLane } from "./TelemetryChartLane.js";
import { LiveTunerPanel, ScreenshotMeta } from "./LiveTunerPanel.js";
import { SignalSidebar } from "./SignalSidebar.js";
import { useWorkbenchStore } from "./stores/useWorkbenchStore.js";

export const App: React.FC = () => {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotMeta[]>([]);
  const [replayedAudio, setReplayedAudio] = useState<AudioTapSample[]>([]);
  const [isNewLaneDropOver, setIsNewLaneDropOver] = useState<boolean>(false);

  const selectedRunId = useWorkbenchStore((s) => s.selectedRunId);
  const lanes = useWorkbenchStore((s) => s.lanes);
  const cursorTime = useWorkbenchStore((s) => s.cursorTime);
  const isPlaying = useWorkbenchStore((s) => s.isPlaying);
  const loopStartSec = useWorkbenchStore((s) => s.loopStartSec);
  const loopEndSec = useWorkbenchStore((s) => s.loopEndSec);
  const containerId = useWorkbenchStore((s) => s.containerId);
  const brakeFormula = useWorkbenchStore((s) => s.brakeFormula);
  const throttleFormula = useWorkbenchStore((s) => s.throttleFormula);
  const gain = useWorkbenchStore((s) => s.gain);
  const frequencyHz = useWorkbenchStore((s) => s.frequencyHz);
  const statusBanner = useWorkbenchStore((s) => s.statusBanner);

  const setSelectedRunId = useWorkbenchStore((s) => s.setSelectedRunId);
  const setLanes = useWorkbenchStore((s) => s.setLanes);
  const addSignalToLane = useWorkbenchStore((s) => s.addSignalToLane);
  const removeSignalFromLane = useWorkbenchStore((s) => s.removeSignalFromLane);
  const removeLane = useWorkbenchStore((s) => s.removeLane);
  const createNewLaneWithSignal = useWorkbenchStore(
    (s) => s.createNewLaneWithSignal
  );
  const setCursorTime = useWorkbenchStore((s) => s.setCursorTime);
  const setIsPlaying = useWorkbenchStore((s) => s.setIsPlaying);
  const setLoopRange = useWorkbenchStore((s) => s.setLoopRange);
  const setContainerId = useWorkbenchStore((s) => s.setContainerId);
  const setBrakeFormula = useWorkbenchStore((s) => s.setBrakeFormula);
  const setThrottleFormula = useWorkbenchStore((s) => s.setThrottleFormula);
  const setGain = useWorkbenchStore((s) => s.setGain);
  const setFrequencyHz = useWorkbenchStore((s) => s.setFrequencyHz);
  const setStatusBanner = useWorkbenchStore((s) => s.setStatusBanner);
  const setIsBusy = useWorkbenchStore((s) => s.setIsBusy);

  const fetchRunsList = useCallback(
    async (selectId?: string) => {
      try {
        const res = await fetch("/api/runs");
        const data = (await res.json()) as { runs: RunSummary[] };
        setRuns(data.runs ?? []);
        if (selectId) {
          setSelectedRunId(selectId);
        } else if (data.runs && data.runs.length > 0) {
          const preferred =
            data.runs.find((r) => r.id === "scratch_run3_latest") ??
            data.runs[0];
          setSelectedRunId(preferred.id);
        }
      } catch (err) {
        setStatusBanner(`Failed loading runs: ${String(err)}`);
      }
    },
    [setSelectedRunId, setStatusBanner]
  );

  useEffect(() => {
    void fetchRunsList();
    fetch("/api/shakeit/config")
      .then((r) => r.json())
      .then((data: { rules?: ShakeItCustomFormulaRule[] }) => {
        const first = data.rules?.[0];
        if (first) {
          setContainerId(first.containerId);
          if (first.frontLeftFormula) setBrakeFormula(first.frontLeftFormula);
          if (first.rearLeftFormula) setThrottleFormula(first.rearLeftFormula);
          setGain(first.gain);
          setFrequencyHz(first.frequencyHz);
        }
      })
      .catch(() => {
        // Ignore if SimHub config isn't found
      });
  }, [
    fetchRunsList,
    setContainerId,
    setBrakeFormula,
    setThrottleFormula,
    setGain,
    setFrequencyHz
  ]);

  useEffect(() => {
    if (!selectedRunId) return;
    setIsBusy(true);
    fetch(`/api/runs/${encodeURIComponent(selectedRunId)}`)
      .then((r) => r.json())
      .then(
        (data: {
          summary: RunSummary;
          samples: TelemetrySample[];
          screenshots: ScreenshotMeta[];
        }) => {
          const loaded = data.samples ?? [];
          setSamples(loaded);
          setScreenshots(data.screenshots ?? []);
          setReplayedAudio([]);
          if (loaded.length > 0) {
            const minT = loaded[0].t;
            const maxT = loaded[loaded.length - 1].t;
            setLoopRange(
              Number(Math.min(maxT, minT + 2).toFixed(1)),
              Number(Math.min(maxT, minT + 14).toFixed(1))
            );
            setCursorTime(minT);
          }
        }
      )
      .catch((err) => setStatusBanner(`Error loading run: ${String(err)}`))
      .finally(() => setIsBusy(false));
  }, [selectedRunId, setIsBusy, setLoopRange, setCursorTime, setStatusBanner]);

  useEffect(() => {
    if (!isPlaying || samples.length === 0) return;
    const id = window.setInterval(() => {
      const next = cursorTime + 0.05;
      if (next > loopEndSec) {
        setCursorTime(loopStartSec);
      } else {
        setCursorTime(Number(next.toFixed(3)));
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [
    isPlaying,
    samples.length,
    cursorTime,
    loopStartSec,
    loopEndSec,
    setCursorTime
  ]);

  const { times, seriesMap } = useMemo(() => {
    const tArr = samples.map((s) => s.t);
    const map: Record<string, number[]> = {};

    for (const sig of SIGNAL_CATALOG) {
      if (sig.key.startsWith("Formula.") || sig.key.startsWith("Shaker.Replayed")) {
        continue;
      }
      if (sig.key === "GearNum") {
        map[sig.key] = samples.map((s) => {
          const g = String(s.Gear ?? "0").toUpperCase();
          if (g === "R") return -1;
          if (g === "N") return 0;
          return parseInt(g, 10) || 0;
        });
      } else {
        map[sig.key] = samples.map((s) => Number(s[sig.key] ?? 0));
      }
    }

    map["Formula.BrakePreview"] = evaluateFormulaSeries(samples, brakeFormula);
    map["Formula.ThrottlePreview"] = evaluateFormulaSeries(
      samples,
      throttleFormula
    );

    const replayBrake = new Array<number>(samples.length).fill(0);
    const replayThrottle = new Array<number>(samples.length).fill(0);
    if (replayedAudio.length > 0) {
      for (let i = 0; i < samples.length; i++) {
        const st = samples[i].t;
        if (
          st < replayedAudio[0].t - 0.1 ||
          st > replayedAudio[replayedAudio.length - 1].t + 0.1
        ) {
          continue;
        }
        let best = replayedAudio[0];
        let bestDiff = Math.abs(best.t - st);
        for (let j = 1; j < replayedAudio.length; j++) {
          const d = Math.abs(replayedAudio[j].t - st);
          if (d < bestDiff) {
            bestDiff = d;
            best = replayedAudio[j];
          }
        }
        if (bestDiff <= 0.15) {
          replayBrake[i] = best.pedalBrakeRms;
          replayThrottle[i] = best.pedalThrottleRms;
        }
      }
    }
    map["Shaker.ReplayedBrake_RMS"] = replayBrake;
    map["Shaker.ReplayedThrottle_RMS"] = replayThrottle;

    return { times: tArr, seriesMap: map };
  }, [samples, brakeFormula, throttleFormula, replayedAudio]);

  const activeSampleIndex = useMemo(() => {
    if (samples.length === 0) return 0;
    let lo = 0;
    let hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].t < cursorTime) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }, [samples, cursorTime]);

  const activeSample = samples[activeSampleIndex];

  const activeScreenshot = useMemo(() => {
    if (screenshots.length === 0) return null;
    let best = screenshots[0];
    let bestDiff = Math.abs(best.t - cursorTime);
    for (const s of screenshots) {
      const d = Math.abs(s.t - cursorTime);
      if (d < bestDiff) {
        bestDiff = d;
        best = s;
      }
    }
    return best;
  }, [screenshots, cursorTime]);

  const findPeakSlipWindow = useCallback(() => {
    if (samples.length === 0) return;
    let maxSlip = -Infinity;
    let bestT = samples[0].t;
    for (const s of samples) {
      const slip = Math.max(
        s["GameRawData.TireSlipRatioRearLeft"],
        s["GameRawData.TireSlipRatioRearRight"]
      );
      if (slip > maxSlip && s.Throttle > 25) {
        maxSlip = slip;
        bestT = s.t;
      }
    }
    const start = Math.max(0, Number((bestT - 3).toFixed(1)));
    const end = Math.min(
      samples[samples.length - 1].t,
      Number((bestT + 5).toFixed(1))
    );
    setLoopRange(start, end);
    setCursorTime(Number(bestT.toFixed(2)));
    setStatusBanner(
      `Focused on Peak Throttle Wheelspin at t=${bestT.toFixed(2)}s (Rear Slip Ratio = ${maxSlip.toFixed(2)})`
    );
  }, [samples, setLoopRange, setCursorTime, setStatusBanner]);

  const findHardBrakingWindow = useCallback(() => {
    if (samples.length === 0) return;
    let minSlip = Infinity;
    let bestT = samples[0].t;
    for (const s of samples) {
      const slip = Math.min(
        s["GameRawData.TireSlipRatioFrontLeft"],
        s["GameRawData.TireSlipRatioFrontRight"]
      );
      if (slip < minSlip && s.Brake > 25) {
        minSlip = slip;
        bestT = s.t;
      }
    }
    const start = Math.max(0, Number((bestT - 3).toFixed(1)));
    const end = Math.min(
      samples[samples.length - 1].t,
      Number((bestT + 5).toFixed(1))
    );
    setLoopRange(start, end);
    setCursorTime(Number(bestT.toFixed(2)));
    setStatusBanner(
      `Focused on Peak Hard Braking Lockup at t=${bestT.toFixed(2)}s (Front Slip Ratio = ${minSlip.toFixed(2)})`
    );
  }, [samples, setLoopRange, setCursorTime, setStatusBanner]);

  const handlePushLiveToSimHub = async () => {
    setIsBusy(true);
    setStatusBanner("Pushing updated formulas to SimHub (.reload)...");
    try {
      const res = await fetch("/api/shakeit/reload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerId,
          frontLeftFormula: brakeFormula,
          rearLeftFormula: throttleFormula,
          gain,
          frequencyHz
        })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        consumedBySimHub?: boolean;
        elapsedMs?: number;
        error?: string;
      };
      if (data.ok) {
        setStatusBanner(
          data.consumedBySimHub
            ? `✓ Hot-reloaded in SimHub in ${data.elapsedMs}ms (Zero restart — FMOD output re-allocated!)`
            : "✓ Saved ShakeITBassShakersSettingsV2.json and wrote .reload marker (SimHub will consume on next tick)."
        );
      } else {
        setStatusBanner(`Reload failed: ${data.error ?? "Unknown error"}`);
      }
    } catch (err) {
      setStatusBanner(`Reload error: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReplayLoopThroughSimHub = async () => {
    if (!selectedRunId) return;
    setIsBusy(true);
    setStatusBanner(
      `Streaming [${loopStartSec.toFixed(1)}s – ${loopEndSec.toFixed(1)}s] as 324-byte FH6 UDP packets to SimHub :8000 & recording 100Hz WASAPI...`
    );
    try {
      const res = await fetch("/api/replay/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: selectedRunId,
          startSec: loopStartSec,
          endSec: loopEndSec,
          udpPort: 8000
        })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        packetsSent?: number;
        replayedAudio?: AudioTapSample[];
        error?: string;
      };
      if (data.ok) {
        setReplayedAudio(data.replayedAudio ?? []);
        setStatusBanner(
          `✓ Replayed ${data.packetsSent} FH6 UDP packets through SimHub & captured ${data.replayedAudio?.length ?? 0} 100Hz shaker samples!`
        );
      } else {
        setStatusBanner(`Replay error: ${data.error ?? "Failed"}`);
      }
    } catch (err) {
      setStatusBanner(`Replay error: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartLiveCapture = async (durationSec: number) => {
    setIsBusy(true);
    setStatusBanner(
      `Recording ${durationSec}s live capture (SimHub telemetry + 100Hz 4-ch WASAPI + SimHub DXGI frames)... Drive now!`
    );
    try {
      const res = await fetch("/api/capture/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        runId?: string;
        sampleCount?: number;
      };
      if (data.ok && data.runId) {
        setStatusBanner(
          `✓ Recorded ${data.sampleCount} samples in ${data.runId}! Loading run...`
        );
        await fetchRunsList(data.runId);
      }
    } catch (err) {
      setStatusBanner(`Live capture failed: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      data-testid="workbench-root"
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 370px",
        height: "100vh",
        overflow: "hidden",
        background: "#020617",
        color: "#f8fafc"
      }}
    >
      <SignalSidebar
        runs={runs}
        onStartLiveCapture={handleStartLiveCapture}
        onRefreshRuns={() => fetchRunsList(selectedRunId)}
      />

      <main
        data-testid="chart-stack-main"
        style={{
          padding: 12,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              data-testid="play-pause-btn"
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? "#f59e0b" : "#0284c7",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {isPlaying ? "⏸ Pause Loop" : "▶ Play Loop"}
            </button>
            <span style={{ fontSize: 12, color: "#facc15", fontWeight: 600 }}>
              Cursor: {cursorTime.toFixed(2)}s
            </span>
            <span style={{ fontSize: 12, color: "#38bdf8" }}>
              Loop: [{loopStartSec.toFixed(1)}s – {loopEndSec.toFixed(1)}s]
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              data-testid="jump-peak-wheelspin-btn"
              type="button"
              onClick={findPeakSlipWindow}
              style={{
                background: "#1e293b",
                color: "#fb923c",
                border: "1px solid #fb923c55",
                borderRadius: 6,
                padding: "4px 9px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              ⚡ Jump to Peak Wheelspin
            </button>
            <button
              data-testid="jump-peak-braking-btn"
              type="button"
              onClick={findHardBrakingWindow}
              style={{
                background: "#1e293b",
                color: "#f43f5e",
                border: "1px solid #f43f5e55",
                borderRadius: 6,
                padding: "4px 9px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              🛑 Jump to Peak Braking Lockup
            </button>
            <button
              data-testid="reset-lanes-btn"
              type="button"
              onClick={() => setLanes(DEFAULT_CHART_LANES)}
              style={{
                background: "#1e293b",
                color: "#94a3b8",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: "4px 9px",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              Reset Lanes
            </button>
          </div>
        </div>

        {statusBanner && (
          <div
            data-testid="status-banner"
            style={{
              background: "#0c4a6e",
              border: "1px solid #0284c7",
              color: "#e0f2fe",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              marginBottom: 10
            }}
          >
            {statusBanner}
          </div>
        )}

        {lanes.map((lane) => (
          <TelemetryChartLane
            key={lane.id}
            lane={lane}
            times={times}
            seriesMap={seriesMap}
            cursorTime={cursorTime}
            loopStartSec={loopStartSec}
            loopEndSec={loopEndSec}
            onSelectCursorTime={setCursorTime}
            onSelectLoopRange={setLoopRange}
            onDropSignal={addSignalToLane}
            onRemoveSignal={removeSignalFromLane}
            onRemoveLane={removeLane}
          />
        ))}

        <div
          data-testid="new-lane-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsNewLaneDropOver(true);
          }}
          onDragLeave={() => setIsNewLaneDropOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsNewLaneDropOver(false);
            const sigKey = e.dataTransfer.getData("text/telemetry-signal");
            if (sigKey) {
              createNewLaneWithSignal(sigKey);
            }
          }}
          style={{
            border: isNewLaneDropOver
              ? "2px dashed #38bdf8"
              : "1px dashed #334155",
            borderRadius: 8,
            padding: 14,
            textAlign: "center",
            color: isNewLaneDropOver ? "#38bdf8" : "#64748b",
            fontSize: 12,
            background: isNewLaneDropOver ? "#0f172a" : "transparent"
          }}
        >
          + Drag & Drop Any Telemetry Signal Here to Create a New Chart Lane
        </div>
      </main>

      <LiveTunerPanel
        activeSample={activeSample}
        activeScreenshot={activeScreenshot}
        onPushLiveToSimHub={handlePushLiveToSimHub}
        onReplayLoopThroughSimHub={handleReplayLoopThroughSimHub}
      />
    </div>
  );
};
