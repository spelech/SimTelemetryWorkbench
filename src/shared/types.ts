export interface TelemetrySample {
  /** Elapsed time from start of run in seconds */
  t: number;
  /** Unix epoch timestamp in seconds */
  ts: number;
  CarModel?: string;
  SpeedKmh: number;
  Rpms: number;
  MaxRpm: number;
  Gear: string | number;
  Throttle: number;
  Brake: number;
  Clutch?: number;
  Handbrake?: number;
  Steer?: number;
  ABSActive: number;
  TCActive: number;
  AccelerationSurge: number;
  AccelerationSway: number;
  AccelerationHeave: number;
  "GameRawData.TireSlipRatioFrontLeft": number;
  "GameRawData.TireSlipRatioFrontRight": number;
  "GameRawData.TireSlipRatioRearLeft": number;
  "GameRawData.TireSlipRatioRearRight": number;
  "GameRawData.TireCombinedSlipFrontLeft": number;
  "GameRawData.TireCombinedSlipFrontRight": number;
  "GameRawData.TireCombinedSlipRearLeft": number;
  "GameRawData.TireCombinedSlipRearRight": number;
  "GameRawData.NormalizedSuspensionTravelFrontLeft": number;
  "GameRawData.NormalizedSuspensionTravelFrontRight": number;
  "GameRawData.NormalizedSuspensionTravelRearLeft": number;
  "GameRawData.NormalizedSuspensionTravelRearRight": number;
  "GameRawData.SurfaceRumbleFrontLeft": number;
  "GameRawData.SurfaceRumbleFrontRight": number;
  "GameRawData.SurfaceRumbleRearLeft": number;
  "GameRawData.SurfaceRumbleRearRight": number;
  "GameRawData.WheelInPuddleDepthFrontLeft"?: number;
  "GameRawData.WheelInPuddleDepthFrontRight"?: number;
  "GameRawData.WheelInPuddleDepthRearLeft"?: number;
  "GameRawData.WheelInPuddleDepthRearRight"?: number;
  /** Synthesized or recorded WASAPI shaker RMS/peak signals */
  "Shaker.PedalBrake_RMS"?: number;
  "Shaker.PedalBrake_Peak"?: number;
  "Shaker.PedalThrottle_RMS"?: number;
  "Shaker.PedalThrottle_Peak"?: number;
  "Shaker.SeatLeft_RMS"?: number;
  "Shaker.SeatLeft_Peak"?: number;
  "Shaker.SeatRight_RMS"?: number;
  "Shaker.SeatRight_Peak"?: number;
  [key: string]: string | number | undefined;
}

export interface AudioTapSample {
  /** Unix epoch timestamp in seconds */
  ts: number;
  /** Relative time in seconds */
  t: number;
  pedalBrakeRms: number;
  pedalBrakePeak: number;
  pedalThrottleRms: number;
  pedalThrottlePeak: number;
  seatLeftRms: number;
  seatLeftPeak: number;
  seatRightRms: number;
  seatRightPeak: number;
}

export interface ReplayScreenshotFrame {
  frameIndex: number;
  /** Relative time in seconds from start of replay */
  t: number;
  /** Byte offset in the .telemetry.json container */
  picturePosition: number;
}

export interface RunSummary {
  id: string;
  name: string;
  sourceType: "scratch_json" | "simhub_replay" | "live_capture";
  gameName: string;
  carModel: string;
  sampleCount: number;
  durationSec: number;
  hasAudioTap: boolean;
  hasVideoMp4: boolean;
  screenshotCount: number;
  createdAt: string;
}

export interface ShakeItCustomFormulaRule {
  containerId: string;
  description: string;
  isEnabled: boolean;
  gain: number;
  frontLeftFormula: string;
  frontRightFormula: string;
  rearLeftFormula: string;
  rearRightFormula: string;
  frequencyHz: number;
}
