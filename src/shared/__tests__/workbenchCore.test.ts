import { describe, expect, it } from "vitest";
import {
  decodeForzaHorizonPacket,
  encodeForzaHorizonPacket,
  FORZA_HORIZON_PACKET_LENGTH,
  normalizeTelemetryRow
} from "../forzaParser.js";
import {
  buildSimHubReplayBuffers,
  parseSimHubReplayBuffers
} from "../simhubReplayParser.js";
import { compileSimHubFormula, evaluateFormulaSeries } from "../formulaEvaluator.js";
import { TelemetrySample } from "../types.js";

function makeSample(overrides: Partial<TelemetrySample> = {}): TelemetrySample {
  return {
    t: 2.5,
    ts: 1700000002.5,
    CarModel: "Car_2024",
    SpeedKmh: 120,
    Rpms: 6800,
    MaxRpm: 8500,
    Gear: "3",
    Throttle: 85,
    Brake: 0,
    ABSActive: 0,
    TCActive: 0,
    AccelerationSurge: 4.5,
    AccelerationSway: -1.2,
    AccelerationHeave: 0.3,
    "GameRawData.TireSlipRatioFrontLeft": 0.05,
    "GameRawData.TireSlipRatioFrontRight": 0.06,
    "GameRawData.TireSlipRatioRearLeft": 0.92,
    "GameRawData.TireSlipRatioRearRight": 0.88,
    "GameRawData.TireCombinedSlipFrontLeft": 0.1,
    "GameRawData.TireCombinedSlipFrontRight": 0.1,
    "GameRawData.TireCombinedSlipRearLeft": 0.95,
    "GameRawData.TireCombinedSlipRearRight": 0.91,
    "GameRawData.NormalizedSuspensionTravelFrontLeft": 0.4,
    "GameRawData.NormalizedSuspensionTravelFrontRight": 0.42,
    "GameRawData.NormalizedSuspensionTravelRearLeft": 0.55,
    "GameRawData.NormalizedSuspensionTravelRearRight": 0.56,
    "GameRawData.SurfaceRumbleFrontLeft": 0.12,
    "GameRawData.SurfaceRumbleFrontRight": 0.15,
    "GameRawData.SurfaceRumbleRearLeft": 0.22,
    "GameRawData.SurfaceRumbleRearRight": 0.2,
    ...overrides
  };
}

describe("forzaParser", () => {
  it("encodes and decodes a 324-byte Forza Horizon UDP packet round-trip", () => {
    const original = makeSample();
    const packet = encodeForzaHorizonPacket(original);
    expect(packet.length).toBe(FORZA_HORIZON_PACKET_LENGTH);

    const decoded = decodeForzaHorizonPacket(packet, original.t, original.ts);
    expect(decoded.CarModel).toBe("Car_2024");
    expect(decoded.SpeedKmh).toBeCloseTo(120, 1);
    expect(decoded.Rpms).toBeCloseTo(6800, 1);
    expect(decoded.MaxRpm).toBeCloseTo(8500, 1);
    expect(decoded.Gear).toBe("3");
    expect(decoded.Throttle).toBeCloseTo(85, 0);
    expect(decoded["GameRawData.TireSlipRatioRearLeft"]).toBeCloseTo(0.92, 3);
    expect(decoded.AccelerationSurge).toBeCloseTo(4.5, 2);
  });

  it("normalizes loosely typed JSON rows from drive_log.json", () => {
    const normalized = normalizeTelemetryRow({
      t: 1.1,
      ts: 100.1,
      SpeedKmh: "98.4",
      Rpms: "5400",
      Gear: "2",
      Throttle: "100",
      Brake: "0",
      "GameRawData.TireSlipRatioRearLeft": "0.65"
    });
    expect(normalized.SpeedKmh).toBeCloseTo(98.4, 2);
    expect(normalized.Rpms).toBe(5400);
    expect(normalized.Gear).toBe("2");
    expect(normalized["GameRawData.TireSlipRatioRearLeft"]).toBeCloseTo(0.65, 3);
  });
});

describe("simhubReplayParser", () => {
  it("writes and parses SimHub .telemetry.json and .telemetry.jsonidx buffers with telemetry and screenshots", () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const { dataBuf, idxBuf } = buildSimHubReplayBuffers([
      {
        type: "telemetry",
        tSec: 0.016,
        payload: {
          Common: {
            TimestampMS: 16,
            CurrentEngineRpm: 4200,
            EngineMaxRpm: 8000,
            CarOrdinal: 1337,
            TireSlipRatioFrontLeft: -0.82,
            TireSlipRatioFrontRight: -0.79,
            TireSlipRatioRearLeft: -0.2,
            TireSlipRatioRearRight: -0.22
          },
          Dash: {
            Speed: 25,
            Accel: 0,
            Brake: 204,
            Gear: 2
          }
        }
      },
      {
        type: "screenshot",
        tSec: 0.033,
        jpegBytes: fakeJpeg
      }
    ]);

    const parsed = parseSimHubReplayBuffers(dataBuf, idxBuf);
    expect(parsed.samples.length).toBe(1);
    expect(parsed.screenshots.length).toBe(1);
    expect(parsed.samples[0].SpeedKmh).toBeCloseTo(90, 1);
    expect(parsed.samples[0].Brake).toBeCloseTo(80, 0);
    expect(parsed.samples[0]["GameRawData.TireSlipRatioFrontLeft"]).toBeCloseTo(-0.82, 2);
    expect(parsed.screenshots[0].t).toBeCloseTo(0.033, 3);
  });
});

describe("formulaEvaluator", () => {
  it("evaluates our FH6 Brake ABS and Throttle Slip NCalc formulas accurately", () => {
    const absFormula =
      "if([DataCorePlugin.GameData.Brake]>30 and Min([DataCorePlugin.GameRawData.TireSlipRatioFrontLeft],[DataCorePlugin.GameRawData.TireSlipRatioFrontRight])<-0.7,100,0)";
    const tcFormula =
      "if([DataCorePlugin.GameData.Throttle]>40 and Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight])>0.35,Min(100,40+(Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight])-0.35)*100),0)";

    const brakingSample = makeSample({
      Brake: 75,
      Throttle: 0,
      "GameRawData.TireSlipRatioFrontLeft": -0.85,
      "GameRawData.TireSlipRatioFrontRight": -0.6
    });
    const launchSample = makeSample({
      Brake: 0,
      Throttle: 90,
      "GameRawData.TireSlipRatioRearLeft": 0.65,
      "GameRawData.TireSlipRatioRearRight": 0.5
    });

    const evalAbs = compileSimHubFormula(absFormula);
    expect(evalAbs(brakingSample)).toBe(100);
    expect(evalAbs(launchSample)).toBe(0);

    const tcValues = evaluateFormulaSeries([brakingSample, launchSample], tcFormula);
    expect(tcValues[0]).toBe(0);
    expect(tcValues[1]).toBeCloseTo(70, 1);
  });
});

describe("audioTapCsv & mergeAudioIntoSamples", async () => {
  const { parseAudioTapCsv, mergeAudioIntoSamples } = await import("../../server/index.js");

  it("parses 100 Hz WASAPI CSV rows and merges shaker RMS/Peak into telemetry samples", () => {
    const csv = [
      "ts,t,pedal_brake_rms,pedal_brake_peak,pedal_throttle_rms,pedal_throttle_peak,seat_left_rms,seat_left_peak,seat_right_rms,seat_right_peak",
      "1700000002.49,2.49,0.4200,0.8500,0.0100,0.0200,0.1200,0.2500,0.1100,0.2300",
      "1700000002.50,2.50,0.5500,0.9200,0.0000,0.0000,0.1500,0.3000,0.1400,0.2800"
    ].join("\n");

    const parsed = parseAudioTapCsv(csv);
    expect(parsed.length).toBe(2);
    expect(parsed[1].pedalBrakeRms).toBeCloseTo(0.55, 3);

    const sample = makeSample({ t: 2.5, ts: 1700000002.5 });
    mergeAudioIntoSamples([sample], parsed);
    expect(sample["Shaker.PedalBrake_RMS"]).toBeCloseTo(0.55, 3);
    expect(sample["Shaker.PedalBrake_Peak"]).toBeCloseTo(0.92, 3);
    expect(sample["Shaker.SeatLeft_RMS"]).toBeCloseTo(0.15, 3);
  });
});

