import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import dgram from "node:dgram";
import { spawn } from "node:child_process";
import {
  AudioTapSample,
  ShakeItCustomFormulaRule
} from "../shared/types.js";
import { encodeForzaHorizonPacket } from "../shared/forzaParser.js";
import { extractReplayScreenshotFromFile } from "../shared/simhubReplayParser.js";
import {
  AUDIO_TAP_EXE,
  discoverRuns,
  mergeAudioIntoSamples,
  parseAudioTapCsv,
  SHAKEIT_RELOAD_MARKER,
  SHAKEIT_SETTINGS_PATH,
  WORKBENCH_DATA_DIR
} from "./runRepository.js";

export { parseAudioTapCsv, mergeAudioIntoSamples };

const PORT = 4400;
const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "sim-telemetry-workbench",
    version: "0.1.0",
    uptimeSec: Number(process.uptime().toFixed(2))
  });
});

app.get("/api/runs", (_req, res) => {
  const runs = discoverRuns();
  const list = Array.from(runs.values()).map((r) => r.summary);
  res.json({ runs: list });
});

app.get("/api/runs/:id", (req, res) => {
  const runs = discoverRuns();
  const run = runs.get(req.params.id);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({
    summary: run.summary,
    samples: run.samples,
    screenshots: (run.screenshotOffsets ?? []).map((s) => ({
      frameIndex: s.frameIndex,
      t: s.t
    }))
  });
});

app.get("/api/runs/:id/screenshot/:frameIndex", (req, res) => {
  const runs = discoverRuns();
  const run = runs.get(req.params.id);
  if (!run || !run.screenshotOffsets) {
    res.status(404).send("Not found");
    return;
  }
  const idx = parseInt(req.params.frameIndex, 10);
  const entry = run.screenshotOffsets[idx];
  if (!entry) {
    res.status(404).send("Frame not found");
    return;
  }
  try {
    if (entry.filePath && fs.existsSync(entry.filePath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.send(fs.readFileSync(entry.filePath));
      return;
    }
    if (run.telemetryFilePath && entry.picturePosition !== undefined) {
      const jpeg = extractReplayScreenshotFromFile(
        run.telemetryFilePath,
        entry.picturePosition
      );
      res.setHeader("Content-Type", "image/jpeg");
      res.send(jpeg);
      return;
    }
    res.status(404).send("No frame source");
  } catch (err) {
    res.status(500).json({ error: "Failed reading frame", detail: String(err) });
  }
});

app.get("/api/shakeit/config", (_req, res) => {
  if (!fs.existsSync(SHAKEIT_SETTINGS_PATH)) {
    res.status(404).json({ error: "ShakeITBassShakersSettingsV2.json not found" });
    return;
  }
  try {
    const raw = JSON.parse(
      fs.readFileSync(SHAKEIT_SETTINGS_PATH, "utf8")
    ) as Record<string, any>;
    const profiles = (raw.Profiles ?? []) as Array<Record<string, any>>;
    const rules: ShakeItCustomFormulaRule[] = [];

    for (const prof of profiles) {
      const containers = (prof.EffectsContainers ?? []) as Array<Record<string, any>>;
      for (const c of containers) {
        if (c.FrontLeftFormula && c.RearLeftFormula) {
          rules.push({
            containerId: String(c.ContainerId ?? ""),
            description: String(c.Description ?? prof.Name ?? "Custom Effect"),
            isEnabled: Boolean(c.IsEnabled),
            gain: Number(c.Gain ?? 100),
            frontLeftFormula: String(c.FrontLeftFormula?.Expression ?? ""),
            frontRightFormula: String(c.FrontRightFormula?.Expression ?? ""),
            rearLeftFormula: String(c.RearLeftFormula?.Expression ?? ""),
            rearRightFormula: String(c.RearRightFormula?.Expression ?? ""),
            frequencyHz: Number(c.Output?.Frequency ?? 44)
          });
        }
      }
    }

    res.json({
      allowEffectsDuringReplays: Boolean(raw.AllowEffectsDuringReplays),
      globalGain: Number(raw.GlobalGain ?? 50),
      rules
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/shakeit/reload", (req, res) => {
  const { containerId, frontLeftFormula, rearLeftFormula, gain, frequencyHz } =
    req.body as {
      containerId?: string;
      frontLeftFormula?: string;
      rearLeftFormula?: string;
      gain?: number;
      frequencyHz?: number;
    };

  try {
    if (fs.existsSync(SHAKEIT_SETTINGS_PATH)) {
      const rawText = fs.readFileSync(SHAKEIT_SETTINGS_PATH, "utf8");
      const data = JSON.parse(rawText) as Record<string, any>;
      data.AllowEffectsDuringReplays = true;

      for (const prof of data.Profiles ?? []) {
        for (const c of prof.EffectsContainers ?? []) {
          if (
            !containerId ||
            c.ContainerId === containerId ||
            (c.FrontLeftFormula && c.RearLeftFormula)
          ) {
            if (typeof frontLeftFormula === "string" && c.FrontLeftFormula) {
              c.FrontLeftFormula.Expression = frontLeftFormula;
            }
            if (typeof rearLeftFormula === "string" && c.RearLeftFormula) {
              c.RearLeftFormula.Expression = rearLeftFormula;
            }
            if (typeof gain === "number") {
              c.Gain = gain;
            }
            if (typeof frequencyHz === "number" && c.Output) {
              c.Output.Frequency = frequencyHz;
            }
          }
        }
      }

      fs.writeFileSync(
        SHAKEIT_SETTINGS_PATH,
        JSON.stringify(data, null, 2),
        "utf8"
      );
    }

    fs.writeFileSync(SHAKEIT_RELOAD_MARKER, new Date().toISOString(), "utf8");

    const tStart = Date.now();
    let consumed = false;
    while (Date.now() - tStart < 400) {
      if (!fs.existsSync(SHAKEIT_RELOAD_MARKER)) {
        consumed = true;
        break;
      }
    }

    res.json({
      ok: true,
      consumedBySimHub: consumed,
      elapsedMs: Date.now() - tStart
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/replay/loop", async (req, res) => {
  const {
    runId,
    startSec = 0,
    endSec = 10,
    udpPort = 8000
  } = req.body as {
    runId: string;
    startSec?: number;
    endSec?: number;
    udpPort?: number;
  };

  const runs = discoverRuns();
  const run = runs.get(runId);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const slice = run.samples.filter((s) => s.t >= startSec && s.t <= endSec);
  if (slice.length === 0) {
    res.status(400).json({ error: "No samples in selected time window" });
    return;
  }

  const durationMs = Math.min(
    30000,
    Math.max(500, Math.round((endSec - startSec) * 1000) + 400)
  );
  const tempCsv = path.join(WORKBENCH_DATA_DIR, `replay_tap_${Date.now()}.csv`);

  let tapProc: ReturnType<typeof spawn> | null = null;
  if (fs.existsSync(AUDIO_TAP_EXE)) {
    tapProc = spawn(
      AUDIO_TAP_EXE,
      ["--duration-ms", String(durationMs), "--out-csv", tempCsv],
      { windowsHide: true }
    );
  }

  const sock = dgram.createSocket("udp4");
  const t0 = Date.now();
  const baseT = slice[0].t;

  try {
    for (let i = 0; i < slice.length; i++) {
      const sample = slice[i];
      const targetElapsedMs = (sample.t - baseT) * 1000;
      const waitMs = targetElapsedMs - (Date.now() - t0);
      if (waitMs > 2) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const pkt = encodeForzaHorizonPacket(sample);
      await new Promise<void>((resolve, reject) => {
        sock.send(pkt, udpPort, "127.0.0.1", (err) =>
          err ? reject(err) : resolve()
        );
      });
    }
  } finally {
    sock.close();
  }

  if (tapProc) {
    await new Promise<void>((resolve) => {
      tapProc?.on("close", () => resolve());
      setTimeout(resolve, 2000);
    });
  }

  let replayedAudio: AudioTapSample[] = [];
  if (fs.existsSync(tempCsv)) {
    replayedAudio = parseAudioTapCsv(fs.readFileSync(tempCsv, "utf8")).map(
      (a) => ({
        ...a,
        t: Number((a.t + startSec).toFixed(3))
      })
    );
    try {
      fs.unlinkSync(tempCsv);
    } catch {
      // ignore
    }
  }

  res.json({
    ok: true,
    packetsSent: slice.length,
    startSec,
    endSec,
    replayedAudio
  });
});

app.post("/api/capture/start", async (req, res) => {
  const { durationSec = 15 } = (req.body ?? {}) as { durationSec?: number };
  const clampedSec = Math.min(120, Math.max(3, durationSec));
  const runId = `capture_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runFolder = path.join(WORKBENCH_DATA_DIR, runId);
  const framesDir = path.join(runFolder, "frames");
  const csvPath = path.join(runFolder, "audio_tap.csv");
  const jsonPath = path.join(runFolder, "telemetry.json");
  fs.mkdirSync(framesDir, { recursive: true });

  const durationMs = clampedSec * 1000;
  let tapProc: ReturnType<typeof spawn> | null = null;
  if (fs.existsSync(AUDIO_TAP_EXE)) {
    tapProc = spawn(
      AUDIO_TAP_EXE,
      [
        "--duration-ms",
        String(durationMs),
        "--out-csv",
        csvPath,
        "--frames-dir",
        framesDir,
        "--fps",
        "10"
      ],
      { windowsHide: true }
    );
  }

  const props = [
    "CarModel",
    "SpeedKmh",
    "Rpms",
    "MaxRpm",
    "Gear",
    "Throttle",
    "Brake",
    "ABSActive",
    "TCActive",
    "AccelerationSurge",
    "AccelerationSway",
    "AccelerationHeave",
    "GameRawData.TireSlipRatioFrontLeft",
    "GameRawData.TireSlipRatioFrontRight",
    "GameRawData.TireSlipRatioRearLeft",
    "GameRawData.TireSlipRatioRearRight",
    "GameRawData.TireCombinedSlipFrontLeft",
    "GameRawData.TireCombinedSlipFrontRight",
    "GameRawData.TireCombinedSlipRearLeft",
    "GameRawData.TireCombinedSlipRearRight",
    "GameRawData.NormalizedSuspensionTravelFrontLeft",
    "GameRawData.NormalizedSuspensionTravelFrontRight",
    "GameRawData.NormalizedSuspensionTravelRearLeft",
    "GameRawData.NormalizedSuspensionTravelRearRight",
    "GameRawData.SurfaceRumbleFrontLeft",
    "GameRawData.SurfaceRumbleFrontRight",
    "GameRawData.SurfaceRumbleRearLeft",
    "GameRawData.SurfaceRumbleRearRight"
  ];

  const rows: Array<Record<string, any>> = [];
  const tStart = Date.now();
  while (Date.now() - tStart < durationMs) {
    const tickStart = Date.now();
    const row: Record<string, any> = {
      t: Number(((tickStart - tStart) / 1000).toFixed(3)),
      ts: Number((tickStart / 1000).toFixed(3))
    };
    await Promise.all(
      props.map(async (p) => {
        try {
          const resp = await fetch(`http://127.0.0.1:8888/api/GetProperty/${p}`);
          if (resp.ok) {
            row[p] = (await resp.text()).trim();
          }
        } catch {
          row[p] = "";
        }
      })
    );
    rows.push(row);
    const elapsed = Date.now() - tickStart;
    if (elapsed < 40) {
      await new Promise((r) => setTimeout(r, 40 - elapsed));
    }
  }

  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), "utf8");

  if (tapProc) {
    await new Promise<void>((resolve) => {
      tapProc?.on("close", () => resolve());
      setTimeout(resolve, 2000);
    });
  }

  res.json({ ok: true, runId, sampleCount: rows.length });
});

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(
      `SimTelemetryWorkbench backend listening on http://127.0.0.1:${PORT}`
    );
  });
}

export { app };
