import { TelemetrySample } from "./types.js";

export const FORZA_HORIZON_PACKET_LENGTH = 324;

export interface FH6CommonPacket {
  IsRaceOn: number;
  TimestampMS: number;
  EngineMaxRpm: number;
  EngineIdleRpm: number;
  CurrentEngineRpm: number;
  AccelerationX: number;
  AccelerationY: number;
  AccelerationZ: number;
  VelocityX: number;
  VelocityY: number;
  VelocityZ: number;
  AngularVelocityX: number;
  AngularVelocityY: number;
  AngularVelocityZ: number;
  Yaw: number;
  Pitch: number;
  Roll: number;
  NormalizedSuspensionTravelFrontLeft: number;
  NormalizedSuspensionTravelFrontRight: number;
  NormalizedSuspensionTravelRearLeft: number;
  NormalizedSuspensionTravelRearRight: number;
  TireSlipRatioFrontLeft: number;
  TireSlipRatioFrontRight: number;
  TireSlipRatioRearLeft: number;
  TireSlipRatioRearRight: number;
  WheelRotationSpeedFrontLeft: number;
  WheelRotationSpeedFrontRight: number;
  WheelRotationSpeedRearLeft: number;
  WheelRotationSpeedRearRight: number;
  WheelOnRumbleStripFrontLeft: number;
  WheelOnRumbleStripFrontRight: number;
  WheelOnRumbleStripRearLeft: number;
  WheelOnRumbleStripRearRight: number;
  WheelInPuddleDepthFrontLeft: number;
  WheelInPuddleDepthFrontRight: number;
  WheelInPuddleDepthRearLeft: number;
  WheelInPuddleDepthRearRight: number;
  SurfaceRumbleFrontLeft: number;
  SurfaceRumbleFrontRight: number;
  SurfaceRumbleRearLeft: number;
  SurfaceRumbleRearRight: number;
  TireSlipAngleFrontLeft: number;
  TireSlipAngleFrontRight: number;
  TireSlipAngleRearLeft: number;
  TireSlipAngleRearRight: number;
  TireCombinedSlipFrontLeft: number;
  TireCombinedSlipFrontRight: number;
  TireCombinedSlipRearLeft: number;
  TireCombinedSlipRearRight: number;
  SuspensionTravelMetersFrontLeft: number;
  SuspensionTravelMetersFrontRight: number;
  SuspensionTravelMetersRearLeft: number;
  SuspensionTravelMetersRearRight: number;
  CarOrdinal: number;
  CarClass: number;
  CarPerformanceIndex: number;
  DrivetrainType: number;
  NumCylinders: number;
}

export interface FH6DashPacket {
  PositionX: number;
  PositionY: number;
  PositionZ: number;
  Speed: number;
  Power: number;
  Torque: number;
  TireTempFrontLeft: number;
  TireTempFrontRight: number;
  TireTempRearLeft: number;
  TireTempRearRight: number;
  Boost: number;
  Fuel: number;
  DistanceTraveled: number;
  BestLap: number;
  LastLap: number;
  CurrentLap: number;
  CurrentRaceTime: number;
  LapNumber: number;
  RacePosition: number;
  Accel: number;
  Brake: number;
  Clutch: number;
  HandBrake: number;
  Gear: number;
  Steer: number;
  NormalizedDrivingLine: number;
  NormalizedAIBrakeDifference: number;
}

export interface FH6RawReplayObject {
  Common: FH6CommonPacket;
  Reserved: number;
  Damage1: number;
  Damage2: number;
  Dash: FH6DashPacket;
}

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Decodes a 324-byte Forza Horizon (FH4/FH5/FH6) UDP datagram into a TelemetrySample.
 */
export function decodeForzaHorizonPacket(buf: Buffer, tSec = 0, tsSec = Date.now() / 1000): TelemetrySample {
  if (buf.length < FORZA_HORIZON_PACKET_LENGTH) {
    throw new Error(`Expected at least ${FORZA_HORIZON_PACKET_LENGTH} bytes, got ${buf.length}`);
  }

  const timestampMs = buf.readUInt32LE(4);
  const maxRpm = buf.readFloatLE(8);
  const rpms = buf.readFloatLE(16);
  const accX = buf.readFloatLE(20);
  const accY = buf.readFloatLE(24);
  const accZ = buf.readFloatLE(28);

  const normSuspFL = buf.readFloatLE(68);
  const normSuspFR = buf.readFloatLE(72);
  const normSuspRL = buf.readFloatLE(76);
  const normSuspRR = buf.readFloatLE(80);

  const slipRatioFL = buf.readFloatLE(84);
  const slipRatioFR = buf.readFloatLE(88);
  const slipRatioRL = buf.readFloatLE(92);
  const slipRatioRR = buf.readFloatLE(96);

  const puddleFL = buf.readFloatLE(132);
  const puddleFR = buf.readFloatLE(136);
  const puddleRL = buf.readFloatLE(140);
  const puddleRR = buf.readFloatLE(144);

  const rumbleFL = buf.readFloatLE(148);
  const rumbleFR = buf.readFloatLE(152);
  const rumbleRL = buf.readFloatLE(156);
  const rumbleRR = buf.readFloatLE(160);

  const combinedSlipFL = buf.readFloatLE(180);
  const combinedSlipFR = buf.readFloatLE(184);
  const combinedSlipRL = buf.readFloatLE(188);
  const combinedSlipRR = buf.readFloatLE(192);

  const carOrdinal = buf.readInt32LE(212);

  // Dash starts at offset 244 (after 232-byte Sled + 12-byte Horizon extension)
  const speedMs = buf.readFloatLE(256);
  const accelByte = buf.readUInt8(315);
  const brakeByte = buf.readUInt8(316);
  const clutchByte = buf.readUInt8(317);
  const handbrakeByte = buf.readUInt8(318);
  const gearByte = buf.readUInt8(319);
  const steerSByte = buf.readInt8(320);

  const gearStr = gearByte === 0 ? "R" : gearByte === 11 ? "N" : String(gearByte);

  return {
    t: tSec || timestampMs / 1000,
    ts: tsSec,
    CarModel: `Car_${carOrdinal}`,
    SpeedKmh: Math.abs(speedMs * 3.6),
    Rpms: Math.max(0, rpms),
    MaxRpm: Math.max(0, maxRpm),
    Gear: gearStr,
    Throttle: (100 / 255) * accelByte,
    Brake: (100 / 255) * brakeByte,
    Clutch: (100 / 255) * clutchByte,
    Handbrake: (100 / 255) * handbrakeByte,
    Steer: steerSByte,
    ABSActive: 0,
    TCActive: 0,
    AccelerationSway: -accX,
    AccelerationHeave: -accY,
    AccelerationSurge: -accZ,
    "GameRawData.TireSlipRatioFrontLeft": slipRatioFL,
    "GameRawData.TireSlipRatioFrontRight": slipRatioFR,
    "GameRawData.TireSlipRatioRearLeft": slipRatioRL,
    "GameRawData.TireSlipRatioRearRight": slipRatioRR,
    "GameRawData.TireCombinedSlipFrontLeft": combinedSlipFL,
    "GameRawData.TireCombinedSlipFrontRight": combinedSlipFR,
    "GameRawData.TireCombinedSlipRearLeft": combinedSlipRL,
    "GameRawData.TireCombinedSlipRearRight": combinedSlipRR,
    "GameRawData.NormalizedSuspensionTravelFrontLeft": normSuspFL,
    "GameRawData.NormalizedSuspensionTravelFrontRight": normSuspFR,
    "GameRawData.NormalizedSuspensionTravelRearLeft": normSuspRL,
    "GameRawData.NormalizedSuspensionTravelRearRight": normSuspRR,
    "GameRawData.SurfaceRumbleFrontLeft": rumbleFL,
    "GameRawData.SurfaceRumbleFrontRight": rumbleFR,
    "GameRawData.SurfaceRumbleRearLeft": rumbleRL,
    "GameRawData.SurfaceRumbleRearRight": rumbleRR,
    "GameRawData.WheelInPuddleDepthFrontLeft": puddleFL,
    "GameRawData.WheelInPuddleDepthFrontRight": puddleFR,
    "GameRawData.WheelInPuddleDepthRearLeft": puddleRL,
    "GameRawData.WheelInPuddleDepthRearRight": puddleRR
  };
}

/**
 * Encodes a TelemetrySample into a 324-byte Forza Horizon (FH6Packet) UDP datagram
 * so any recorded run (including JSON property logs) can be replayed directly into SimHub on UDP port 8000.
 */
export function encodeForzaHorizonPacket(sample: TelemetrySample): Buffer {
  const buf = Buffer.alloc(FORZA_HORIZON_PACKET_LENGTH, 0);

  // IsRaceOn = 1
  buf.writeInt32LE(1, 0);
  buf.writeUInt32LE(Math.max(0, Math.round(sample.t * 1000)) >>> 0, 4);
  buf.writeFloatLE(toNum(sample.MaxRpm, 8500), 8);
  buf.writeFloatLE(800, 12); // EngineIdleRpm
  buf.writeFloatLE(toNum(sample.Rpms, 0), 16);

  // Accelerations (SimHub inverts X, Y, Z)
  buf.writeFloatLE(-toNum(sample.AccelerationSway, 0), 20);
  buf.writeFloatLE(-toNum(sample.AccelerationHeave, 0), 24);
  buf.writeFloatLE(-toNum(sample.AccelerationSurge, 0), 28);

  // Velocity Z (forward m/s) for GroundSpeed
  const speedMs = toNum(sample.SpeedKmh, 0) / 3.6;
  buf.writeFloatLE(speedMs, 40);

  // NormalizedSuspensionTravel
  buf.writeFloatLE(toNum(sample["GameRawData.NormalizedSuspensionTravelFrontLeft"]), 68);
  buf.writeFloatLE(toNum(sample["GameRawData.NormalizedSuspensionTravelFrontRight"]), 72);
  buf.writeFloatLE(toNum(sample["GameRawData.NormalizedSuspensionTravelRearLeft"]), 76);
  buf.writeFloatLE(toNum(sample["GameRawData.NormalizedSuspensionTravelRearRight"]), 80);

  // TireSlipRatio
  buf.writeFloatLE(toNum(sample["GameRawData.TireSlipRatioFrontLeft"]), 84);
  buf.writeFloatLE(toNum(sample["GameRawData.TireSlipRatioFrontRight"]), 88);
  buf.writeFloatLE(toNum(sample["GameRawData.TireSlipRatioRearLeft"]), 92);
  buf.writeFloatLE(toNum(sample["GameRawData.TireSlipRatioRearRight"]), 96);

  // WheelInPuddleDepth
  buf.writeFloatLE(toNum(sample["GameRawData.WheelInPuddleDepthFrontLeft"]), 132);
  buf.writeFloatLE(toNum(sample["GameRawData.WheelInPuddleDepthFrontRight"]), 136);
  buf.writeFloatLE(toNum(sample["GameRawData.WheelInPuddleDepthRearLeft"]), 140);
  buf.writeFloatLE(toNum(sample["GameRawData.WheelInPuddleDepthRearRight"]), 144);

  // SurfaceRumble
  buf.writeFloatLE(toNum(sample["GameRawData.SurfaceRumbleFrontLeft"]), 148);
  buf.writeFloatLE(toNum(sample["GameRawData.SurfaceRumbleFrontRight"]), 152);
  buf.writeFloatLE(toNum(sample["GameRawData.SurfaceRumbleRearLeft"]), 156);
  buf.writeFloatLE(toNum(sample["GameRawData.SurfaceRumbleRearRight"]), 160);

  // TireCombinedSlip
  buf.writeFloatLE(toNum(sample["GameRawData.TireCombinedSlipFrontLeft"]), 180);
  buf.writeFloatLE(toNum(sample["GameRawData.TireCombinedSlipFrontRight"]), 184);
  buf.writeFloatLE(toNum(sample["GameRawData.TireCombinedSlipRearLeft"]), 188);
  buf.writeFloatLE(toNum(sample["GameRawData.TireCombinedSlipRearRight"]), 192);

  // SuspensionTravelMeters default 0.2m
  buf.writeFloatLE(0.2, 196);
  buf.writeFloatLE(0.2, 200);
  buf.writeFloatLE(0.2, 204);
  buf.writeFloatLE(0.2, 208);

  // CarOrdinal
  const carMatch = String(sample.CarModel ?? "").match(/(\d+)/);
  buf.writeInt32LE(carMatch ? parseInt(carMatch[1], 10) : 1000, 212);

  // Dash starts at offset 244
  buf.writeFloatLE(speedMs, 256); // Speed in m/s
  buf.writeFloatLE(sample.t, 308); // CurrentRaceTime
  buf.writeUInt8(1, 314); // RacePosition
  buf.writeUInt8(Math.min(255, Math.max(0, Math.round((toNum(sample.Throttle) * 255) / 100))), 315);
  buf.writeUInt8(Math.min(255, Math.max(0, Math.round((toNum(sample.Brake) * 255) / 100))), 316);
  buf.writeUInt8(Math.min(255, Math.max(0, Math.round((toNum(sample.Clutch) * 255) / 100))), 317);
  buf.writeUInt8(Math.min(255, Math.max(0, Math.round((toNum(sample.Handbrake) * 255) / 100))), 318);

  const gStr = String(sample.Gear ?? "1").toUpperCase();
  const gearByte = gStr === "R" ? 0 : gStr === "N" ? 11 : Math.min(10, Math.max(0, parseInt(gStr, 10) || 1));
  buf.writeUInt8(gearByte, 319);

  return buf;
}

/**
 * Normalizes a loosely-typed JSON row from drive_log*.json or SimHub's FH6Packet replay entry
 * into a strongly-typed TelemetrySample.
 */
export function normalizeTelemetryRow(raw: Record<string, any>, fallbackTimeSec = 0): TelemetrySample {
  if (raw.Common && raw.Dash) {
    const c = raw.Common as FH6CommonPacket;
    const d = raw.Dash as FH6DashPacket;
    const gearByte = toNum(d.Gear, 1);
    const gearStr = gearByte === 0 ? "R" : gearByte === 11 ? "N" : String(gearByte);
    return {
      t: fallbackTimeSec || toNum(c.TimestampMS) / 1000,
      ts: fallbackTimeSec,
      CarModel: `Car_${toNum(c.CarOrdinal, 0)}`,
      SpeedKmh: Math.abs(toNum(d.Speed) * 3.6),
      Rpms: Math.max(0, toNum(c.CurrentEngineRpm)),
      MaxRpm: Math.max(0, toNum(c.EngineMaxRpm, 8500)),
      Gear: gearStr,
      Throttle: (100 / 255) * toNum(d.Accel),
      Brake: (100 / 255) * toNum(d.Brake),
      Clutch: (100 / 255) * toNum(d.Clutch),
      Handbrake: (100 / 255) * toNum(d.HandBrake),
      Steer: toNum(d.Steer),
      ABSActive: 0,
      TCActive: 0,
      AccelerationSway: -toNum(c.AccelerationX),
      AccelerationHeave: -toNum(c.AccelerationY),
      AccelerationSurge: -toNum(c.AccelerationZ),
      "GameRawData.TireSlipRatioFrontLeft": toNum(c.TireSlipRatioFrontLeft),
      "GameRawData.TireSlipRatioFrontRight": toNum(c.TireSlipRatioFrontRight),
      "GameRawData.TireSlipRatioRearLeft": toNum(c.TireSlipRatioRearLeft),
      "GameRawData.TireSlipRatioRearRight": toNum(c.TireSlipRatioRearRight),
      "GameRawData.TireCombinedSlipFrontLeft": toNum(c.TireCombinedSlipFrontLeft),
      "GameRawData.TireCombinedSlipFrontRight": toNum(c.TireCombinedSlipFrontRight),
      "GameRawData.TireCombinedSlipRearLeft": toNum(c.TireCombinedSlipRearLeft),
      "GameRawData.TireCombinedSlipRearRight": toNum(c.TireCombinedSlipRearRight),
      "GameRawData.NormalizedSuspensionTravelFrontLeft": toNum(c.NormalizedSuspensionTravelFrontLeft),
      "GameRawData.NormalizedSuspensionTravelFrontRight": toNum(c.NormalizedSuspensionTravelFrontRight),
      "GameRawData.NormalizedSuspensionTravelRearLeft": toNum(c.NormalizedSuspensionTravelRearLeft),
      "GameRawData.NormalizedSuspensionTravelRearRight": toNum(c.NormalizedSuspensionTravelRearRight),
      "GameRawData.SurfaceRumbleFrontLeft": toNum(c.SurfaceRumbleFrontLeft),
      "GameRawData.SurfaceRumbleFrontRight": toNum(c.SurfaceRumbleFrontRight),
      "GameRawData.SurfaceRumbleRearLeft": toNum(c.SurfaceRumbleRearLeft),
      "GameRawData.SurfaceRumbleRearRight": toNum(c.SurfaceRumbleRearRight),
      "GameRawData.WheelInPuddleDepthFrontLeft": toNum(c.WheelInPuddleDepthFrontLeft),
      "GameRawData.WheelInPuddleDepthFrontRight": toNum(c.WheelInPuddleDepthFrontRight),
      "GameRawData.WheelInPuddleDepthRearLeft": toNum(c.WheelInPuddleDepthRearLeft),
      "GameRawData.WheelInPuddleDepthRearRight": toNum(c.WheelInPuddleDepthRearRight)
    };
  }

  return {
    t: toNum(raw.t, fallbackTimeSec),
    ts: toNum(raw.ts, fallbackTimeSec),
    CarModel: String(raw.CarModel ?? "Unknown"),
    SpeedKmh: toNum(raw.SpeedKmh),
    Rpms: toNum(raw.Rpms),
    MaxRpm: toNum(raw.MaxRpm, 8500),
    Gear: raw.Gear !== undefined && raw.Gear !== "" ? String(raw.Gear) : "1",
    Throttle: toNum(raw.Throttle),
    Brake: toNum(raw.Brake),
    ABSActive: toNum(raw.ABSActive),
    TCActive: toNum(raw.TCActive),
    AccelerationSurge: toNum(raw.AccelerationSurge),
    AccelerationSway: toNum(raw.AccelerationSway),
    AccelerationHeave: toNum(raw.AccelerationHeave),
    "GameRawData.TireSlipRatioFrontLeft": toNum(raw["GameRawData.TireSlipRatioFrontLeft"]),
    "GameRawData.TireSlipRatioFrontRight": toNum(raw["GameRawData.TireSlipRatioFrontRight"]),
    "GameRawData.TireSlipRatioRearLeft": toNum(raw["GameRawData.TireSlipRatioRearLeft"]),
    "GameRawData.TireSlipRatioRearRight": toNum(raw["GameRawData.TireSlipRatioRearRight"]),
    "GameRawData.TireCombinedSlipFrontLeft": toNum(raw["GameRawData.TireCombinedSlipFrontLeft"]),
    "GameRawData.TireCombinedSlipFrontRight": toNum(raw["GameRawData.TireCombinedSlipFrontRight"]),
    "GameRawData.TireCombinedSlipRearLeft": toNum(raw["GameRawData.TireCombinedSlipRearLeft"]),
    "GameRawData.TireCombinedSlipRearRight": toNum(raw["GameRawData.TireCombinedSlipRearRight"]),
    "GameRawData.NormalizedSuspensionTravelFrontLeft": toNum(raw["GameRawData.NormalizedSuspensionTravelFrontLeft"]),
    "GameRawData.NormalizedSuspensionTravelFrontRight": toNum(raw["GameRawData.NormalizedSuspensionTravelFrontRight"]),
    "GameRawData.NormalizedSuspensionTravelRearLeft": toNum(raw["GameRawData.NormalizedSuspensionTravelRearLeft"]),
    "GameRawData.NormalizedSuspensionTravelRearRight": toNum(raw["GameRawData.NormalizedSuspensionTravelRearRight"]),
    "GameRawData.SurfaceRumbleFrontLeft": toNum(raw["GameRawData.SurfaceRumbleFrontLeft"]),
    "GameRawData.SurfaceRumbleFrontRight": toNum(raw["GameRawData.SurfaceRumbleFrontRight"]),
    "GameRawData.SurfaceRumbleRearLeft": toNum(raw["GameRawData.SurfaceRumbleRearLeft"]),
    "GameRawData.SurfaceRumbleRearRight": toNum(raw["GameRawData.SurfaceRumbleRearRight"]),
    "GameRawData.WheelInPuddleDepthFrontLeft": toNum(raw["GameRawData.WheelInPuddleDepthFrontLeft"]),
    "GameRawData.WheelInPuddleDepthFrontRight": toNum(raw["GameRawData.WheelInPuddleDepthFrontRight"]),
    "GameRawData.WheelInPuddleDepthRearLeft": toNum(raw["GameRawData.WheelInPuddleDepthRearLeft"]),
    "GameRawData.WheelInPuddleDepthRearRight": toNum(raw["GameRawData.WheelInPuddleDepthRearRight"])
  };
}
