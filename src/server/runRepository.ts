import fs from "node:fs";
import path from "node:path";
import {
  AudioTapSample,
  RunSummary,
  TelemetrySample
} from "../shared/types.js";
import { normalizeTelemetryRow } from "../shared/forzaParser.js";
import { parseSimHubReplayBuffers } from "../shared/simhubReplayParser.js";

export const SIMHUB_DIR = "C:\\Program Files (x86)\\SimHub";
export const SHAKEIT_SETTINGS_PATH = path.join(
  SIMHUB_DIR,
  "PluginsData",
  "Common",
  "ShakeITBassShakersSettingsV2.json"
);
export const SHAKEIT_RELOAD_MARKER = SHAKEIT_SETTINGS_PATH + ".reload";
export const SIMHUB_REPLAYS_DIR = path.join(SIMHUB_DIR, "Replays");
export const SCRATCH_DIR =
  "C:\\Users\\Alias\\.gemini\\antigravity-cli\\brain\\ada2fccf-751d-4577-bc49-7b2a6ac8a153\\scratch";
export const WORKBENCH_DATA_DIR = path.resolve(process.cwd(), "data", "runs");
export const AUDIO_TAP_EXE = path.resolve(
  process.cwd(),
  "tools",
  "AudioTapRunner",
  "bin",
  "Release",
  "net48",
  "AudioTapRunner.exe"
);

fs.mkdirSync(WORKBENCH_DATA_DIR, { recursive: true });

export interface LoadedRun {
  summary: RunSummary;
  samples: TelemetrySample[];
  telemetryFilePath?: string;
  framesDir?: string;
  videoFilePath?: string;
  screenshotOffsets?: Array<{
    frameIndex: number;
    t: number;
    picturePosition?: number;
    filePath?: string;
  }>;
}

/**
 * Parses either legacy 10Hz audio_tap*.csv or 100Hz AudioTapRunner CSV streams.
 */
export function parseAudioTapCsv(csvContent: string): AudioTapSample[] {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const result: AudioTapSample[] = [];

  const isNewFormat = header[1]?.trim() === "t";
  let ts0 = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;

    if (isNewFormat) {
      const ts = parseFloat(cols[0]) || 0;
      const t = parseFloat(cols[1]) || 0;
      result.push({
        ts,
        t,
        pedalBrakeRms: parseFloat(cols[2]) || 0,
        pedalBrakePeak: parseFloat(cols[3]) || 0,
        pedalThrottleRms: parseFloat(cols[4]) || 0,
        pedalThrottlePeak: parseFloat(cols[5]) || 0,
        seatLeftRms: parseFloat(cols[6]) || 0,
        seatLeftPeak: parseFloat(cols[7]) || 0,
        seatRightRms: parseFloat(cols[8]) || 0,
        seatRightPeak: parseFloat(cols[9]) || 0
      });
    } else {
      const ts = parseFloat(cols[0]) || 0;
      if (ts0 === 0) ts0 = ts;
      result.push({
        ts,
        t: Math.max(0, ts - ts0),
        pedalBrakeRms: parseFloat(cols[1]) || 0,
        pedalBrakePeak: parseFloat(cols[2]) || 0,
        pedalThrottleRms: parseFloat(cols[3]) || 0,
        pedalThrottlePeak: parseFloat(cols[4]) || 0,
        seatLeftRms: parseFloat(cols[5]) || 0,
        seatLeftPeak: parseFloat(cols[6]) || 0,
        seatRightRms: parseFloat(cols[7]) || 0,
        seatRightPeak: parseFloat(cols[8]) || 0
      });
    }
  }
  return result;
}

/**
 * Merges 100Hz/10Hz audio tap samples onto TelemetrySample[] by matching Unix timestamp `ts` or relative `t`.
 */
export function mergeAudioIntoSamples(
  samples: TelemetrySample[],
  audioSamples: AudioTapSample[]
): void {
  if (samples.length === 0 || audioSamples.length === 0) return;

  const useUnixTs =
    samples[0].ts > 1_000_000_000 &&
    audioSamples[0].ts > 1_000_000_000 &&
    Math.abs(samples[0].ts - audioSamples[0].ts) < 300;

  let audioIdx = 0;
  for (const s of samples) {
    const targetVal = useUnixTs ? s.ts : s.t;
    while (
      audioIdx + 1 < audioSamples.length &&
      Math.abs(
        (useUnixTs ? audioSamples[audioIdx + 1].ts : audioSamples[audioIdx + 1].t) -
          targetVal
      ) <=
        Math.abs(
          (useUnixTs ? audioSamples[audioIdx].ts : audioSamples[audioIdx].t) -
            targetVal
        )
    ) {
      audioIdx++;
    }
    const closest = audioSamples[audioIdx];
    const diff = Math.abs((useUnixTs ? closest.ts : closest.t) - targetVal);
    if (diff <= 0.25) {
      s["Shaker.PedalBrake_RMS"] = closest.pedalBrakeRms;
      s["Shaker.PedalBrake_Peak"] = closest.pedalBrakePeak;
      s["Shaker.PedalThrottle_RMS"] = closest.pedalThrottleRms;
      s["Shaker.PedalThrottle_Peak"] = closest.pedalThrottlePeak;
      s["Shaker.SeatLeft_RMS"] = closest.seatLeftRms;
      s["Shaker.SeatLeft_Peak"] = closest.seatLeftPeak;
      s["Shaker.SeatRight_RMS"] = closest.seatRightRms;
      s["Shaker.SeatRight_Peak"] = closest.seatRightPeak;
    } else {
      s["Shaker.PedalBrake_RMS"] = 0;
      s["Shaker.PedalBrake_Peak"] = 0;
      s["Shaker.PedalThrottle_RMS"] = 0;
      s["Shaker.PedalThrottle_Peak"] = 0;
      s["Shaker.SeatLeft_RMS"] = 0;
      s["Shaker.SeatLeft_Peak"] = 0;
      s["Shaker.SeatRight_RMS"] = 0;
      s["Shaker.SeatRight_Peak"] = 0;
    }
  }
}

export function discoverRuns(): Map<string, LoadedRun> {
  const runs = new Map<string, LoadedRun>();

  const scratchPairs = [
    {
      id: "scratch_run3_latest",
      name: "FH6 Run 3 — Hard Braking & Gravel/Asphalt Slip",
      jsonFile: "drive_log.json",
      csvFile: "audio_tap.csv"
    },
    {
      id: "scratch_run2_extended",
      name: "FH6 Run 2 — Extended High-Speed & Launch Session",
      jsonFile: "drive_log_run2.json",
      csvFile: "audio_tap_run2.csv"
    },
    {
      id: "scratch_run1_car1",
      name: "FH6 Run 1 — Baseline Car 1 Test",
      jsonFile: "drive_log_car1.json",
      csvFile: "audio_tap_car1.csv"
    }
  ];

  for (const pair of scratchPairs) {
    const jsonPath = path.join(SCRATCH_DIR, pair.jsonFile);
    const csvPath = path.join(SCRATCH_DIR, pair.csvFile);
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const rawRows = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Array<
        Record<string, any>
      >;
      const samples = rawRows.map((r) => normalizeTelemetryRow(r));
      let hasAudio = false;
      if (fs.existsSync(csvPath)) {
        const audio = parseAudioTapCsv(fs.readFileSync(csvPath, "utf8"));
        mergeAudioIntoSamples(samples, audio);
        hasAudio = audio.length > 0;
      }
      const stat = fs.statSync(jsonPath);
      const durationSec =
        samples.length > 0 ? samples[samples.length - 1].t - samples[0].t : 0;
      const carModel =
        samples.find((s) => s.CarModel && s.CarModel !== "Unknown")?.CarModel ??
        "FH6 Car";

      runs.set(pair.id, {
        summary: {
          id: pair.id,
          name: pair.name,
          sourceType: "scratch_json",
          gameName: "Forza Horizon 6",
          carModel: String(carModel),
          sampleCount: samples.length,
          durationSec: Number(durationSec.toFixed(2)),
          hasAudioTap: hasAudio,
          hasVideoMp4: false,
          screenshotCount: 0,
          createdAt: stat.mtime.toISOString()
        },
        samples
      });
    } catch (err) {
      console.error(`Failed loading scratch run ${pair.id}:`, err);
    }
  }

  if (fs.existsSync(SIMHUB_REPLAYS_DIR)) {
    const gameDirs = fs.readdirSync(SIMHUB_REPLAYS_DIR, { withFileTypes: true });
    for (const gd of gameDirs) {
      if (!gd.isDirectory()) continue;
      const gameFolder = path.join(SIMHUB_REPLAYS_DIR, gd.name);
      const files = fs.readdirSync(gameFolder);
      for (const f of files) {
        if (!f.endsWith(".telemetry.json")) continue;
        const baseName = f.slice(0, -".telemetry.json".length);
        const dataPath = path.join(gameFolder, f);
        const idxPath = path.join(gameFolder, `${baseName}.telemetry.jsonidx`);
        if (!fs.existsSync(idxPath)) continue;

        try {
          const dataBuf = fs.readFileSync(dataPath);
          const idxBuf = fs.readFileSync(idxPath);
          const parsed = parseSimHubReplayBuffers(dataBuf, idxBuf);
          const stat = fs.statSync(dataPath);
          const id = `simhub_${gd.name}_${baseName}`;
          const durationSec =
            parsed.samples.length > 0
              ? parsed.samples[parsed.samples.length - 1].t - parsed.samples[0].t
              : 0;

          const audioPath = path.join(gameFolder, `${baseName}.audio_tap.csv`);
          let hasAudio = false;
          if (fs.existsSync(audioPath)) {
            const audio = parseAudioTapCsv(fs.readFileSync(audioPath, "utf8"));
            mergeAudioIntoSamples(parsed.samples, audio);
            hasAudio = audio.length > 0;
          }

          runs.set(id, {
            summary: {
              id,
              name: `[SimHub Replay] ${gd.name} — ${baseName}`,
              sourceType: "simhub_replay",
              gameName: gd.name,
              carModel: String(parsed.samples[0]?.CarModel ?? gd.name),
              sampleCount: parsed.samples.length,
              durationSec: Number(durationSec.toFixed(2)),
              hasAudioTap: hasAudio,
              hasVideoMp4: false,
              screenshotCount: parsed.screenshots.length,
              createdAt: stat.mtime.toISOString()
            },
            samples: parsed.samples,
            telemetryFilePath: dataPath,
            screenshotOffsets: parsed.screenshots
          });
        } catch (err) {
          console.error(`Failed loading SimHub replay ${f}:`, err);
        }
      }
    }
  }

  if (fs.existsSync(WORKBENCH_DATA_DIR)) {
    const runDirs = fs.readdirSync(WORKBENCH_DATA_DIR, { withFileTypes: true });
    for (const rd of runDirs) {
      if (!rd.isDirectory()) continue;
      const folder = path.join(WORKBENCH_DATA_DIR, rd.name);
      const jsonPath = path.join(folder, "telemetry.json");
      const csvPath = path.join(folder, "audio_tap.csv");
      const framesDir = path.join(folder, "frames");
      if (!fs.existsSync(jsonPath)) continue;

      try {
        const rawRows = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Array<
          Record<string, any>
        >;
        const samples = rawRows.map((r) => normalizeTelemetryRow(r));
        let hasAudio = false;
        if (fs.existsSync(csvPath)) {
          const audio = parseAudioTapCsv(fs.readFileSync(csvPath, "utf8"));
          mergeAudioIntoSamples(samples, audio);
          hasAudio = audio.length > 0;
        }
        const screenshotOffsets: Array<{
          frameIndex: number;
          t: number;
          filePath: string;
        }> = [];
        if (fs.existsSync(framesDir)) {
          const jpgs = fs
            .readdirSync(framesDir)
            .filter((x) => x.endsWith(".jpg"))
            .sort();
          jpgs.forEach((jpg, idx) => {
            const m = jpg.match(/frame_(\d+)\.jpg/);
            const elapsedMs = m ? parseInt(m[1], 10) : idx * 100;
            screenshotOffsets.push({
              frameIndex: idx,
              t: elapsedMs / 1000,
              filePath: path.join(framesDir, jpg)
            });
          });
        }
        const stat = fs.statSync(jsonPath);
        const durationSec =
          samples.length > 0 ? samples[samples.length - 1].t - samples[0].t : 0;
        runs.set(rd.name, {
          summary: {
            id: rd.name,
            name: `Workbench Capture — ${rd.name}`,
            sourceType: "live_capture",
            gameName: "Forza Horizon 6",
            carModel: String(samples[0]?.CarModel ?? "FH6"),
            sampleCount: samples.length,
            durationSec: Number(durationSec.toFixed(2)),
            hasAudioTap: hasAudio,
            hasVideoMp4: false,
            screenshotCount: screenshotOffsets.length,
            createdAt: stat.mtime.toISOString()
          },
          samples,
          framesDir,
          screenshotOffsets
        });
      } catch (err) {
        console.error(`Failed loading workbench run ${rd.name}:`, err);
      }
    }
  }

  return runs;
}
