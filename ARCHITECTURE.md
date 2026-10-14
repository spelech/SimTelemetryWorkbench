# 🏛️ Architecture: SimTelemetryWorkbench

This document details the architecture, module boundaries, data flows, and deterministic test guarantees of **SimTelemetryWorkbench**.

---

## 🏗️ High-Level System Architecture

```mermaid
flowchart TD
    subgraph Sim["Sim & Tactile Hardware Layer"]
        FH6["Forza Horizon 6 / ACC<br>(324-Byte UDP Telemetry)"]
        SimHub["SimHubWPF.exe<br>(Patched ShakeITV3PluginBase)"]
        Amps["Nobsound (Pedals) & Fosi (Seat)<br>4-Ch USB Audio Amplifiers"]
    end

    subgraph NativeTools["Native .NET 4.8 Capture & Patch Tools"]
        Patcher["SimHubPatcher<br>(dnlib IL Hot-Reload Injection)"]
        TapRunner["AudioTapRunner<br>(100 Hz WASAPI + SimHub DXGI JPEG)"]
    end

    subgraph Backend["Express Telemetry & Replay API (:4400)"]
        Parsers["Forza & SimHub Replay Parsers<br>(Brotli + Binary Index)"]
        Evaluator["NCalc Formula Evaluator"]
        UdpInjector["324-Byte FH6Packet UDP Injector<br>(127.0.0.1:8000)"]
    end

    subgraph Frontend["React 19 + uPlot Workbench UI (:5173)"]
        ChartStack["Synchronized uPlot Chart Lanes<br>(Drag-and-Drop Signal Overlay)"]
        FrameSync["Synced DXGI Gameplay Frame Viewer"]
        LiveTuner["Live ShakeIt Formula Tuner"]
    end

    FH6 --> SimHub
    Patcher --> SimHub
    SimHub --> Amps
    Amps --> TapRunner
    SimHub --> TapRunner
    TapRunner --> Backend
    Parsers --> Backend
    Evaluator --> Frontend
    Frontend --> Backend
    Backend --> UdpInjector
    UdpInjector --> SimHub
```

---

## 📡 Closed-Loop Tuning & Replay Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Engineer as Driver / Engineer
    participant UI as React + uPlot Workbench
    participant API as Express Backend (:4400)
    participant SimHub as Patched SimHubWPF.exe
    participant Tap as AudioTapRunner (100Hz WASAPI)

    Engineer->>UI: Edit NCalc Slip Formula & Select Loop [startSec, endSec]
    UI->>UI: Compute Live Formula Preview Curve (60 FPS)
    Engineer->>UI: Click "Push Live to SimHub (.reload)"
    UI->>API: POST /api/shakeit/reload (Formula + Gain + Hz)
    API->>SimHub: Write ShakeITBassShakersSettingsV2.json + .reload marker
    SimHub-->>API: Consume .reload in <10ms & Re-allocate FMOD Output
    Engineer->>UI: Click "Replay Loop Slice via SimHub UDP"
    UI->>API: POST /api/replay/loop (runId, startSec, endSec)
    API->>Tap: Spawn 100 Hz 4-Channel WASAPI Loopback Capture
    API->>SimHub: Stream 324-Byte FH6Packet UDP Datagrams (127.0.0.1:8000)
    Tap-->>API: Return 100 Hz Shaker RMS & Peak CSV Series
    API-->>UI: Return Replayed Shaker Series for A/B Chart Overlay
```

---

## 🧩 Modular Boundaries & Directory Structure

```text
├── src/
│   ├── shared/           # Forza 324B packet codec, SimHub Brotli replay parser, NCalc evaluator
│   ├── server/           # Express REST API (/health, /api/runs, /api/shakeit/reload, /api/replay/loop)
│   └── client/           # React 19 + uPlot synchronized multi-lane workbench UI & Zustand store
├── tools/
│   ├── SimHubPatcher/    # dnlib IL injector for zero-restart ShakeIt settings hot-reload
│   └── AudioTapRunner/   # 100 Hz WASAPI loopback + SimHub.ScreenCapture.dll DXGI recorder
├── scripts/              # Git Flow release automation and verify_release.py integrity engine
└── docs/                 # VitePress living documentation site
```

---

## 📐 Non-Functional Requirements & Design Guarantees

1. **Sub-10ms Config Reload**: Patched `SimHub.Plugins.dll` detects `.reload` marker files on the next 60 Hz update tick without process restart.
2. **100 Hz Tactile Resolution**: `AudioTapRunner` aggregates 4-channel WASAPI loopback float samples in 10 ms windows to resolve 44–58 Hz carrier bursts.
3. **Deterministic Closed-Loop Replay**: Any recorded telemetry slice re-encodes into bit-exact 324-byte `FH6Packet` UDP datagrams for repeatable A/B shaker verification.
4. **Anti-Test Theatre Verification**: Automated tests exercise real binary packet roundtrips, real Brotli replay buffers, and real HTTP pipeline requests with 6-part diagnostic feedback envelopes.
