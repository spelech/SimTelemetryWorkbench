export interface SignalDefinition {
  key: string;
  label: string;
  category:
    | "Driver Inputs"
    | "Tire Slip & Surface"
    | "Chassis & Suspension"
    | "4-Ch Shaker Output (WASAPI)"
    | "Live Formula & Replay A/B";
  unit: string;
  color: string;
  scaleGroup: "percent" | "slip" | "speed" | "rpm" | "gload" | "shaker";
  description: string;
}

export const SIGNAL_CATALOG: SignalDefinition[] = [
  // Driver Inputs
  {
    key: "Throttle",
    label: "Throttle (%)",
    category: "Driver Inputs",
    unit: "%",
    color: "#22c55e",
    scaleGroup: "percent",
    description: "Accelerator pedal input (0–100%)"
  },
  {
    key: "Brake",
    label: "Brake (%)",
    category: "Driver Inputs",
    unit: "%",
    color: "#ef4444",
    scaleGroup: "percent",
    description: "Brake pedal input (0–100%)"
  },
  {
    key: "SpeedKmh",
    label: "Speed (km/h)",
    category: "Driver Inputs",
    unit: "km/h",
    color: "#38bdf8",
    scaleGroup: "speed",
    description: "Vehicle ground speed in km/h"
  },
  {
    key: "Rpms",
    label: "Engine RPM",
    category: "Driver Inputs",
    unit: "rpm",
    color: "#f59e0b",
    scaleGroup: "rpm",
    description: "Instantaneous engine RPM"
  },
  {
    key: "GearNum",
    label: "Gear",
    category: "Driver Inputs",
    unit: "gear",
    color: "#a855f7",
    scaleGroup: "gload",
    description: "Numeric transmission gear"
  },

  // Tire Slip & Surface
  {
    key: "GameRawData.TireSlipRatioRearLeft",
    label: "Slip Ratio RL",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#fb923c",
    scaleGroup: "slip",
    description: "Rear-Left longitudinal tire slip ratio (>0 wheelspin, <0 lockup)"
  },
  {
    key: "GameRawData.TireSlipRatioRearRight",
    label: "Slip Ratio RR",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#facc15",
    scaleGroup: "slip",
    description: "Rear-Right longitudinal tire slip ratio (>0 wheelspin, <0 lockup)"
  },
  {
    key: "GameRawData.TireSlipRatioFrontLeft",
    label: "Slip Ratio FL",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#f43f5e",
    scaleGroup: "slip",
    description: "Front-Left longitudinal tire slip ratio (< -0.7 ABS lockup)"
  },
  {
    key: "GameRawData.TireSlipRatioFrontRight",
    label: "Slip Ratio FR",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#ec4899",
    scaleGroup: "slip",
    description: "Front-Right longitudinal tire slip ratio (< -0.7 ABS lockup)"
  },
  {
    key: "GameRawData.TireCombinedSlipRearLeft",
    label: "Combined Slip RL",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#34d399",
    scaleGroup: "slip",
    description: "Rear-Left combined longitudinal + lateral slip magnitude (Forza TCR trigger proxy)"
  },
  {
    key: "GameRawData.TireCombinedSlipRearRight",
    label: "Combined Slip RR",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#2dd4bf",
    scaleGroup: "slip",
    description: "Rear-Right combined longitudinal + lateral slip magnitude (Forza TCR trigger proxy)"
  },
  {
    key: "GameRawData.TireCombinedSlipFrontLeft",
    label: "Combined Slip FL",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#60a5fa",
    scaleGroup: "slip",
    description: "Front-Left combined slip magnitude"
  },
  {
    key: "GameRawData.TireCombinedSlipFrontRight",
    label: "Combined Slip FR",
    category: "Tire Slip & Surface",
    unit: "ratio",
    color: "#818cf8",
    scaleGroup: "slip",
    description: "Front-Right combined slip magnitude"
  },

  // Chassis & Suspension
  {
    key: "AccelerationSurge",
    label: "Longitudinal Surge (m/s²)",
    category: "Chassis & Suspension",
    unit: "m/s²",
    color: "#38bdf8",
    scaleGroup: "gload",
    description: "Forward/braking longitudinal acceleration"
  },
  {
    key: "AccelerationSway",
    label: "Lateral Sway (m/s²)",
    category: "Chassis & Suspension",
    unit: "m/s²",
    color: "#c084fc",
    scaleGroup: "gload",
    description: "Cornering lateral acceleration"
  },
  {
    key: "AccelerationHeave",
    label: "Vertical Heave (m/s²)",
    category: "Chassis & Suspension",
    unit: "m/s²",
    color: "#94a3b8",
    scaleGroup: "gload",
    description: "Vertical road bump heave acceleration"
  },
  {
    key: "GameRawData.SurfaceRumbleFrontLeft",
    label: "Surface Rumble FL",
    category: "Chassis & Suspension",
    unit: "raw",
    color: "#fde047",
    scaleGroup: "slip",
    description: "Curb / gravel surface rumble Front-Left"
  },
  {
    key: "GameRawData.SurfaceRumbleRearLeft",
    label: "Surface Rumble RL",
    category: "Chassis & Suspension",
    unit: "raw",
    color: "#fdba74",
    scaleGroup: "slip",
    description: "Curb / gravel surface rumble Rear-Left"
  },

  // 4-Ch Shaker Output (WASAPI)
  {
    key: "Shaker.PedalThrottle_RMS",
    label: "Shaker: Throttle Pedal RMS (Nobsound Ch1)",
    category: "4-Ch Shaker Output (WASAPI)",
    unit: "rms",
    color: "#10b981",
    scaleGroup: "shaker",
    description: "Recorded WASAPI loopback RMS on Nobsound Ch1 (Dayton TT25-16 Throttle Pedal)"
  },
  {
    key: "Shaker.PedalBrake_RMS",
    label: "Shaker: Brake Pedal RMS (Nobsound Ch0)",
    category: "4-Ch Shaker Output (WASAPI)",
    unit: "rms",
    color: "#f43f5e",
    scaleGroup: "shaker",
    description: "Recorded WASAPI loopback RMS on Nobsound Ch0 (Dayton TT25-16 Brake Pedal)"
  },
  {
    key: "Shaker.SeatLeft_RMS",
    label: "Shaker: Seat Left RMS (Fosi Ch0)",
    category: "4-Ch Shaker Output (WASAPI)",
    unit: "rms",
    color: "#06b6d4",
    scaleGroup: "shaker",
    description: "Recorded WASAPI loopback RMS on Fosi Ch0 (Dayton BST-1 Seat Left)"
  },
  {
    key: "Shaker.SeatRight_RMS",
    label: "Shaker: Seat Right RMS (Fosi Ch1)",
    category: "4-Ch Shaker Output (WASAPI)",
    unit: "rms",
    color: "#8b5cf6",
    scaleGroup: "shaker",
    description: "Recorded WASAPI loopback RMS on Fosi Ch1 (Dayton BST-1 Seat Right)"
  },

  // Live Formula & Replay A/B
  {
    key: "Formula.ThrottlePreview",
    label: "Live Formula: Throttle Slip (0–100%)",
    category: "Live Formula & Replay A/B",
    unit: "%",
    color: "#4ade80",
    scaleGroup: "percent",
    description: "Simulated output (0–100%) of your current RearLeft NCalc formula across this run"
  },
  {
    key: "Formula.BrakePreview",
    label: "Live Formula: Brake ABS (0–100%)",
    category: "Live Formula & Replay A/B",
    unit: "%",
    color: "#fb7185",
    scaleGroup: "percent",
    description: "Simulated output (0–100%) of your current FrontLeft NCalc formula across this run"
  },
  {
    key: "Shaker.ReplayedThrottle_RMS",
    label: "Replayed SimHub: Throttle Pedal RMS",
    category: "Live Formula & Replay A/B",
    unit: "rms",
    color: "#a3e635",
    scaleGroup: "shaker",
    description: "Actual SimHub WASAPI output recorded during last UDP loop replay"
  },
  {
    key: "Shaker.ReplayedBrake_RMS",
    label: "Replayed SimHub: Brake Pedal RMS",
    category: "Live Formula & Replay A/B",
    unit: "rms",
    color: "#fda4af",
    scaleGroup: "shaker",
    description: "Actual SimHub WASAPI output recorded during last UDP loop replay"
  }
];

export interface ChartLaneConfig {
  id: string;
  title: string;
  signals: string[];
}

export const DEFAULT_CHART_LANES: ChartLaneConfig[] = [
  {
    id: "lane-inputs",
    title: "Driver Inputs & Speed",
    signals: ["Throttle", "Brake", "SpeedKmh"]
  },
  {
    id: "lane-throttle-slip",
    title: "Throttle Wheelspin / TCR vs. Pedal Shaker & Live Formula",
    signals: [
      "GameRawData.TireSlipRatioRearLeft",
      "GameRawData.TireCombinedSlipRearLeft",
      "Formula.ThrottlePreview",
      "Shaker.PedalThrottle_RMS",
      "Shaker.ReplayedThrottle_RMS"
    ]
  },
  {
    id: "lane-brake-abs",
    title: "Front Braking Slip vs. Brake Pedal Shaker & Live Formula",
    signals: [
      "GameRawData.TireSlipRatioFrontLeft",
      "GameRawData.TireSlipRatioFrontRight",
      "Formula.BrakePreview",
      "Shaker.PedalBrake_RMS",
      "Shaker.ReplayedBrake_RMS"
    ]
  },
  {
    id: "lane-seat-gload",
    title: "Seat Bass Shakers (Fosi BST-1) & Chassis G-Loads",
    signals: [
      "Shaker.SeatLeft_RMS",
      "Shaker.SeatRight_RMS",
      "AccelerationSurge",
      "AccelerationSway"
    ]
  }
];

export function getSignalDef(key: string): SignalDefinition {
  const found = SIGNAL_CATALOG.find((s) => s.key === key);
  if (found) return found;
  return {
    key,
    label: key,
    category: "Tire Slip & Surface",
    unit: "",
    color: "#38bdf8",
    scaleGroup: "slip",
    description: key
  };
}
