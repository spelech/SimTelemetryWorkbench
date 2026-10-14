import React, { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { ChartLaneConfig, getSignalDef } from "./signalCatalog.js";

const syncCursor = uPlot.sync("workbench-sync");

export interface TelemetryChartLaneProps {
  lane: ChartLaneConfig;
  times: number[];
  seriesMap: Record<string, number[]>;
  cursorTime: number;
  loopStartSec: number;
  loopEndSec: number;
  onSelectCursorTime: (t: number) => void;
  onSelectLoopRange: (startSec: number, endSec: number) => void;
  onDropSignal: (laneId: string, signalKey: string) => void;
  onRemoveSignal: (laneId: string, signalKey: string) => void;
  onRemoveLane: (laneId: string) => void;
}

export const TelemetryChartLane: React.FC<TelemetryChartLaneProps> = ({
  lane,
  times,
  seriesMap,
  cursorTime,
  loopStartSec,
  loopEndSec,
  onSelectCursorTime,
  onSelectLoopRange,
  onDropSignal,
  onRemoveSignal,
  onRemoveLane
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const cursorRef = useRef({ cursorTime, loopStartSec, loopEndSec });
  cursorRef.current = { cursorTime, loopStartSec, loopEndSec };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || times.length === 0) return;

    const data: uPlot.AlignedData = [
      times,
      ...lane.signals.map((sigKey) => seriesMap[sigKey] ?? times.map(() => 0))
    ];

    const usedScaleGroups = new Set<string>();
    const seriesConfigs: uPlot.Series[] = [
      {
        label: "Time (s)",
        value: (_u, v) => (v == null ? "--" : `${v.toFixed(2)}s`)
      }
    ];

    for (const sigKey of lane.signals) {
      const def = getSignalDef(sigKey);
      usedScaleGroups.add(def.scaleGroup);
      const isFormula = sigKey.startsWith("Formula.");
      const isReplayed = sigKey.startsWith("Shaker.Replayed");
      seriesConfigs.push({
        label: def.label,
        stroke: def.color,
        width: isFormula || isReplayed ? 2.2 : 1.6,
        dash: isFormula ? [6, 4] : isReplayed ? [3, 3] : undefined,
        fill: sigKey.startsWith("Shaker.Pedal")
          ? `${def.color}22`
          : undefined,
        scale: def.scaleGroup,
        value: (_u, v) => (v == null ? "--" : `${v.toFixed(3)} ${def.unit}`)
      });
    }

    const axesConfigs: uPlot.Axis[] = [
      {
        stroke: "#94a3b8",
        grid: { stroke: "#1e293b", width: 1 },
        ticks: { stroke: "#334155", width: 1 },
        font: "11px Inter, system-ui, sans-serif",
        values: (_u, splits) => splits.map((v) => `${v.toFixed(0)}s`)
      }
    ];

    const scaleGroupArray = Array.from(usedScaleGroups);
    scaleGroupArray.forEach((sg, idx) => {
      axesConfigs.push({
        scale: sg,
        side: idx === 0 ? 3 : 1,
        stroke: "#94a3b8",
        grid: idx === 0 ? { stroke: "#1e293b", width: 1 } : { show: false },
        ticks: { stroke: "#334155", width: 1 },
        font: "11px Inter, system-ui, sans-serif",
        size: 48
      });
    });

    const opts: uPlot.Options = {
      width: Math.max(320, el.clientWidth),
      height: 175,
      padding: [8, 12, 0, 4],
      cursor: {
        sync: {
          key: syncCursor.key,
          setSeries: true
        },
        drag: {
          x: true,
          y: false,
          setScale: false
        }
      },
      legend: {
        show: false
      },
      scales: {
        x: { time: false },
        percent: { range: [0, 105] },
        shaker: { range: [0, 1.0] }
      },
      series: seriesConfigs,
      axes: axesConfigs,
      hooks: {
        draw: [
          (u) => {
            const ctx = u.ctx;
            const {
              cursorTime: cTime,
              loopStartSec: lStart,
              loopEndSec: lEnd
            } = cursorRef.current;

            ctx.save();
            // Draw shaded loop slice [loopStartSec, loopEndSec]
            if (lEnd > lStart) {
              const x0 = u.valToPos(lStart, "x", true);
              const x1 = u.valToPos(lEnd, "x", true);
              const left = Math.max(u.bbox.left, Math.min(x0, x1));
              const right = Math.min(u.bbox.left + u.bbox.width, Math.max(x0, x1));
              if (right > left) {
                ctx.fillStyle = "rgba(56, 189, 248, 0.11)";
                ctx.fillRect(left, u.bbox.top, right - left, u.bbox.height);
                ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(left, u.bbox.top);
                ctx.lineTo(left, u.bbox.top + u.bbox.height);
                ctx.moveTo(right, u.bbox.top);
                ctx.lineTo(right, u.bbox.top + u.bbox.height);
                ctx.stroke();
              }
            }

            // Draw playhead line at cursorTime
            const cx = u.valToPos(cTime, "x", true);
            if (cx >= u.bbox.left && cx <= u.bbox.left + u.bbox.width) {
              ctx.strokeStyle = "#facc15";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(cx, u.bbox.top);
              ctx.lineTo(cx, u.bbox.top + u.bbox.height);
              ctx.stroke();
            }
            ctx.restore();
          }
        ],
        setSelect: [
          (u) => {
            if (u.select.width > 4) {
              const minT = u.posToVal(u.select.left, "x");
              const maxT = u.posToVal(u.select.left + u.select.width, "x");
              onSelectLoopRange(
                Number(Math.max(0, Math.min(minT, maxT)).toFixed(2)),
                Number(Math.max(minT, maxT).toFixed(2))
              );
              u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
            }
          }
        ]
      }
    };

    const u = new uPlot(opts, data, el);
    plotRef.current = u;

    const handleClick = (e: MouseEvent) => {
      if (!plotRef.current) return;
      const rect = el.querySelector(".u-over")?.getBoundingClientRect();
      if (!rect) return;
      const relX = e.clientX - rect.left;
      if (relX >= 0 && relX <= rect.width) {
        const val = plotRef.current.posToVal(relX, "x");
        if (Number.isFinite(val)) {
          onSelectCursorTime(Number(Math.max(0, val).toFixed(3)));
        }
      }
    };

    const overEl = el.querySelector(".u-over") as HTMLElement | null;
    overEl?.addEventListener("click", handleClick);

    const resizeObserver = new ResizeObserver(() => {
      if (plotRef.current && el) {
        plotRef.current.setSize({
          width: Math.max(320, el.clientWidth),
          height: 175
        });
      }
    });
    resizeObserver.observe(el);

    return () => {
      overEl?.removeEventListener("click", handleClick);
      resizeObserver.disconnect();
      u.destroy();
      plotRef.current = null;
    };
  }, [lane.signals, times, seriesMap, onSelectCursorTime, onSelectLoopRange]);

  useEffect(() => {
    if (plotRef.current) {
      plotRef.current.redraw();
    }
  }, [cursorTime, loopStartSec, loopEndSec]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const sigKey = e.dataTransfer.getData("text/telemetry-signal");
        if (sigKey) {
          onDropSignal(lane.id, sigKey);
        }
      }}
      style={{
        background: isDragOver ? "#1e293b" : "#0f172a",
        border: isDragOver ? "1px dashed #38bdf8" : "1px solid #1e293b",
        borderRadius: 8,
        padding: "8px 10px",
        marginBottom: 10,
        transition: "border-color 0.15s ease, background 0.15s ease"
      }}
    >
      {/* Lane Header & Overlaid Signal Pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 4
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>
            {lane.title}
          </span>
          {lane.signals.map((sigKey) => {
            const def = getSignalDef(sigKey);
            return (
              <span
                key={sigKey}
                title={def.description}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "#1e293b",
                  border: `1px solid ${def.color}66`,
                  color: "#f8fafc"
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: def.color,
                    display: "inline-block"
                  }}
                />
                {def.label}
                <button
                  type="button"
                  onClick={() => onRemoveSignal(lane.id, sigKey)}
                  title="Remove signal from lane"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 0,
                    marginLeft: 2,
                    fontSize: 11,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#64748b" }}>
            Drag signal here to overlay • Click to scrub • Drag chart to select loop
          </span>
          <button
            type="button"
            onClick={() => onRemoveLane(lane.id)}
            title="Remove chart lane"
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#94a3b8",
              borderRadius: 4,
              fontSize: 11,
              padding: "1px 6px",
              cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* uPlot Canvas Container */}
      <div ref={containerRef} style={{ width: "100%", minHeight: 175 }} />
    </div>
  );
};
