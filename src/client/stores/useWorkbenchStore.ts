import { create } from "zustand";
import {
  ChartLaneConfig,
  DEFAULT_CHART_LANES,
  getSignalDef
} from "../signalCatalog.js";

export const THROTTLE_PRESETS = [
  {
    name: "Tuned Road & Corner-Exit TCR (SlipRatio > 0.18 or CombinedSlip > 0.85)",
    formula:
      "if([DataCorePlugin.GameData.Throttle]>25 and Max(Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight]),Max([DataCorePlugin.GameRawData.TireCombinedSlipRearLeft],[DataCorePlugin.GameRawData.TireCombinedSlipRearRight])*0.30)>0.18,Min(100,35+(Max(Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight]),Max([DataCorePlugin.GameRawData.TireCombinedSlipRearLeft],[DataCorePlugin.GameRawData.TireCombinedSlipRearRight])*0.30)-0.18)*130),0)"
  },
  {
    name: "Previous Gravel/1st-Gear Config (SlipRatio > 0.35, Throttle > 40)",
    formula:
      "if([DataCorePlugin.GameData.Throttle]>40 and Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight])>0.35,Min(100,40+(Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight])-0.35)*100),0)"
  },
  {
    name: "Pure Longitudinal Wheelspin (SlipRatio > 0.15, Progressive 30-100%)",
    formula:
      "if([DataCorePlugin.GameData.Throttle]>20 and Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight])>0.15,Min(100,30+(Max([DataCorePlugin.GameRawData.TireSlipRatioRearLeft],[DataCorePlugin.GameRawData.TireSlipRatioRearRight])-0.15)*140),0)"
  }
];

interface WorkbenchState {
  selectedRunId: string;
  lanes: ChartLaneConfig[];
  cursorTime: number;
  isPlaying: boolean;
  loopStartSec: number;
  loopEndSec: number;
  containerId: string;
  brakeFormula: string;
  throttleFormula: string;
  gain: number;
  frequencyHz: number;
  statusBanner: string;
  isBusy: boolean;
  setSelectedRunId: (id: string) => void;
  setLanes: (lanes: ChartLaneConfig[]) => void;
  addSignalToLane: (laneId: string, signalKey: string) => void;
  removeSignalFromLane: (laneId: string, signalKey: string) => void;
  removeLane: (laneId: string) => void;
  createNewLaneWithSignal: (signalKey: string) => void;
  setCursorTime: (t: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setLoopRange: (startSec: number, endSec: number) => void;
  setContainerId: (id: string) => void;
  setBrakeFormula: (formula: string) => void;
  setThrottleFormula: (formula: string) => void;
  setGain: (gain: number) => void;
  setFrequencyHz: (hz: number) => void;
  setStatusBanner: (msg: string) => void;
  setIsBusy: (busy: boolean) => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  selectedRunId: "",
  lanes: DEFAULT_CHART_LANES,
  cursorTime: 0,
  isPlaying: false,
  loopStartSec: 5,
  loopEndSec: 18,
  containerId: "",
  brakeFormula:
    "if([DataCorePlugin.GameData.Brake]>30 and Min([DataCorePlugin.GameRawData.TireSlipRatioFrontLeft],[DataCorePlugin.GameRawData.TireSlipRatioFrontRight])<-0.7,100,0)",
  throttleFormula: THROTTLE_PRESETS[0].formula,
  gain: 100,
  frequencyHz: 44,
  statusBanner: "",
  isBusy: false,
  setSelectedRunId: (id) => set({ selectedRunId: id }),
  setLanes: (lanes) => set({ lanes }),
  addSignalToLane: (laneId, signalKey) =>
    set((state) => ({
      lanes: state.lanes.map((l) =>
        l.id === laneId && !l.signals.includes(signalKey)
          ? { ...l, signals: [...l.signals, signalKey] }
          : l
      )
    })),
  removeSignalFromLane: (laneId, signalKey) =>
    set((state) => ({
      lanes: state.lanes.map((l) =>
        l.id === laneId
          ? { ...l, signals: l.signals.filter((s) => s !== signalKey) }
          : l
      )
    })),
  removeLane: (laneId) =>
    set((state) => ({
      lanes: state.lanes.filter((l) => l.id !== laneId)
    })),
  createNewLaneWithSignal: (signalKey) => {
    const def = getSignalDef(signalKey);
    set((state) => ({
      lanes: [
        ...state.lanes,
        {
          id: `lane-${Date.now()}`,
          title: `${def.label} Analysis`,
          signals: [signalKey]
        }
      ]
    }));
  },
  setCursorTime: (cursorTime) => set({ cursorTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setLoopRange: (loopStartSec, loopEndSec) =>
    set({ loopStartSec, loopEndSec, cursorTime: loopStartSec }),
  setContainerId: (containerId) => set({ containerId }),
  setBrakeFormula: (brakeFormula) => set({ brakeFormula }),
  setThrottleFormula: (throttleFormula) => set({ throttleFormula }),
  setGain: (gain) => set({ gain }),
  setFrequencyHz: (frequencyHz) => set({ frequencyHz }),
  setStatusBanner: (statusBanner) => set({ statusBanner }),
  setIsBusy: (isBusy) => set({ isBusy })
}));
