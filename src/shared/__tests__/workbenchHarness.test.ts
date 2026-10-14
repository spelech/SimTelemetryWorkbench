import { describe, expect, it } from "vitest";
import http from "node:http";
import { AddressInfo } from "node:net";
import { app, parseAudioTapCsv } from "../../server/index.js";
import {
  decodeForzaHorizonPacket,
  encodeForzaHorizonPacket,
  FORZA_HORIZON_PACKET_LENGTH
} from "../forzaParser.js";
import { compileSimHubFormula, evaluateFormulaSeries } from "../formulaEvaluator.js";
import { useWorkbenchStore } from "../../client/stores/useWorkbenchStore.js";
import { TelemetrySample } from "../types.js";

export interface FeedbackEnvelope {
  status: "FAILED";
  test_name: string;
  inputs: Record<string, unknown>;
  assumptions: string[];
  active_settings: Record<string, unknown>;
  action_history: Array<{ step: number; action: string; status: string }>;
  output_delta: Record<string, unknown>;
  captured_logs: string[];
  reproduction_command: string;
}

function formatFeedbackEnvelope(envelope: FeedbackEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

function buildSyntheticSample(index: number, slipRatio: number, throttle: number): TelemetrySample {
  return {
    t: Number((index * 0.016).toFixed(3)),
    ts: 1700000000 + index * 0.016,
    CarModel: `SynthCar_${index % 5}`,
    SpeedKmh: 40 + (index % 220),
    Rpms: 2500 + ((index * 15) % 6000),
    MaxRpm: 8500,
    Gear: String(1 + (index % 6)),
    Throttle: throttle,
    Brake: throttle > 10 ? 0 : 80,
    ABSActive: slipRatio < -0.7 ? 1 : 0,
    TCActive: slipRatio > 0.2 ? 1 : 0,
    AccelerationSurge: slipRatio * 4.0,
    AccelerationSway: Math.sin(index * 0.1) * 3.0,
    AccelerationHeave: Math.cos(index * 0.2) * 0.5,
    "GameRawData.TireSlipRatioFrontLeft": slipRatio < 0 ? slipRatio : 0.02,
    "GameRawData.TireSlipRatioFrontRight": slipRatio < 0 ? slipRatio * 0.95 : 0.02,
    "GameRawData.TireSlipRatioRearLeft": slipRatio > 0 ? slipRatio : -0.02,
    "GameRawData.TireSlipRatioRearRight": slipRatio > 0 ? slipRatio * 0.98 : -0.02,
    "GameRawData.TireCombinedSlipFrontLeft": Math.abs(slipRatio),
    "GameRawData.TireCombinedSlipFrontRight": Math.abs(slipRatio),
    "GameRawData.TireCombinedSlipRearLeft": Math.abs(slipRatio) * 1.15,
    "GameRawData.TireCombinedSlipRearRight": Math.abs(slipRatio) * 1.12,
    "GameRawData.NormalizedSuspensionTravelFrontLeft": 0.45,
    "GameRawData.NormalizedSuspensionTravelFrontRight": 0.46,
    "GameRawData.NormalizedSuspensionTravelRearLeft": 0.52,
    "GameRawData.NormalizedSuspensionTravelRearRight": 0.51,
    "GameRawData.SurfaceRumbleFrontLeft": 0.1,
    "GameRawData.SurfaceRumbleFrontRight": 0.1,
    "GameRawData.SurfaceRumbleRearLeft": 0.15,
    "GameRawData.SurfaceRumbleRearRight": 0.14
  };
}

describe("Closed-Loop Simulation & HTTP Integration Harness", () => {
  it("executes full HTTP pipeline roundtrips against /health and /api/runs", async () => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const healthRes = await fetch(`${baseUrl}/health`);
      expect(healthRes.status).toBe(200);
      const healthJson = (await healthRes.json()) as {
        status: string;
        service: string;
        version: string;
      };
      expect(healthJson.status).toBe("healthy");
      expect(healthJson.service).toBe("sim-telemetry-workbench");
      expect(healthJson.version).toBe("0.1.0");

      const runsRes = await fetch(`${baseUrl}/api/runs`);
      expect(runsRes.status).toBe(200);
      const runsJson = (await runsRes.json()) as { runs: unknown[] };
      expect(Array.isArray(runsJson.runs)).toBe(true);

      const missingRes = await fetch(`${baseUrl}/api/runs/non_existent_run_id`);
      expect(missingRes.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("sweeps 1,000 synthetic FH6 telemetry packets across 0-1-N slip boundaries with 6-part feedback envelope", () => {
    const batchSize = 1000;
    const slipSweep = [-1.25, -0.75, -0.2, 0.0, 0.15, 0.22, 0.45, 1.35];
    const throttleFormula = useWorkbenchStore.getState().throttleFormula;
    const samples: TelemetrySample[] = [];

    for (let i = 0; i < batchSize; i++) {
      const slip = slipSweep[i % slipSweep.length];
      const throttle = slip > 0 ? 85 : 0;
      const sample = buildSyntheticSample(i, slip, throttle);
      const encoded = encodeForzaHorizonPacket(sample);
      const decoded = decodeForzaHorizonPacket(encoded, sample.t, sample.ts);
      samples.push(decoded);
    }

    const outputs = evaluateFormulaSeries(samples, throttleFormula);
    const outOfBounds = outputs.filter((v) => !Number.isFinite(v) || v < 0 || v > 100);

    if (outOfBounds.length > 0) {
      throw new Error(
        formatFeedbackEnvelope({
          status: "FAILED",
          test_name: "Test_HighThroughput_FH6PacketAndFormulaSweep",
          inputs: { batchSize, slipSweep, throttleFormula },
          assumptions: [
            "All 324-byte FH6Packet floats round-trip without NaN",
            "Formula outputs clamp strictly to [0, 100]"
          ],
          active_settings: { packetLength: FORZA_HORIZON_PACKET_LENGTH },
          action_history: [
            { step: 1, action: "EncodeDecode1000Packets", status: "OK" },
            { step: 2, action: "EvaluateFormulaSeries", status: "OUT_OF_BOUNDS" }
          ],
          output_delta: {
            expectedOutOfBoundsCount: 0,
            actualOutOfBoundsCount: outOfBounds.length
          },
          captured_logs: [`First invalid output: ${String(outOfBounds[0])}`],
          reproduction_command: "npx vitest run src/shared/__tests__/workbenchHarness.test.ts"
        })
      );
    }

    expect(samples.length).toBe(batchSize);
    expect(outputs.length).toBe(batchSize);
    // High wheelspin sample (index 6 -> slip = 0.45, throttle = 85) must produce positive shaker output
    expect(outputs[6]).toBeGreaterThan(35);
    // Braking sample (index 0 -> slip = -1.25, throttle = 0) must produce 0 throttle shaker output
    expect(outputs[0]).toBe(0);
  });

  it("handles disturbance injection: truncated UDP buffers, malformed formulas, and corrupt CSV rows", () => {
    // 1. Truncated UDP buffer (< 324 bytes) must throw a clear domain error
    const truncated = Buffer.alloc(128);
    expect(() => decodeForzaHorizonPacket(truncated)).toThrow(/Expected at least 324 bytes/);

    // 2. Malformed NCalc syntax must degrade gracefully to 0 without crashing the UI loop
    const brokenEval = compileSimHubFormula("if([DataCorePlugin.GameData.Throttle] > (((");
    const sample = buildSyntheticSample(0, 0.5, 90);
    expect(brokenEval(sample)).toBe(0);

    // 3. Empty and corrupt CSV input must return valid rows only
    expect(parseAudioTapCsv("")).toEqual([]);
    const noisyCsv = "ts,t,bRms,bPeak,tRms,tPeak,slRms,slPeak,srRms,srPeak\ninvalid_short\n1700.1,0.1,0.5,0.8,0.2,0.4,0.1,0.2,0.1,0.2";
    const rows = parseAudioTapCsv(noisyCsv);
    expect(rows.length).toBe(1);
    expect(rows[0].pedalBrakeRms).toBeCloseTo(0.5, 3);
  });

  it("verifies Zustand useWorkbenchStore state transitions for lane overlay and removal", () => {
    const store = useWorkbenchStore.getState();
    const initialCount = store.lanes.length;

    store.createNewLaneWithSignal("Rpms");
    expect(useWorkbenchStore.getState().lanes.length).toBe(initialCount + 1);

    const newLaneId = useWorkbenchStore.getState().lanes[initialCount].id;
    store.addSignalToLane(newLaneId, "SpeedKmh");
    expect(useWorkbenchStore.getState().lanes[initialCount].signals).toContain("SpeedKmh");

    store.removeSignalFromLane(newLaneId, "SpeedKmh");
    expect(useWorkbenchStore.getState().lanes[initialCount].signals).not.toContain("SpeedKmh");

    store.removeLane(newLaneId);
    expect(useWorkbenchStore.getState().lanes.length).toBe(initialCount);
  });
});
