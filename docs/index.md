# SimTelemetryWorkbench Documentation

Welcome to the living documentation for **SimTelemetryWorkbench**.

## Overview

**SimTelemetryWorkbench** provides closed-loop telemetry analysis, 100 Hz 4-channel WASAPI bass-shaker loopback recording, 324-byte `FH6Packet` UDP slice replay, and sub-10ms SimHub ShakeIt configuration hot-reloading.

## Architecture & Subsystems

- **SimHubPatcher (`tools/SimHubPatcher`)**: Injects a `.reload` file watcher into `ShakeITV3PluginBase.DataUpdate` in `SimHub.Plugins.dll` using `dnlib` and regenerates the module `Mvid` to bypass stale NGen native images.
- **AudioTapRunner (`tools/AudioTapRunner`)**: Links against `NAudio.Wasapi.dll` and `SimHub.ScreenCapture.dll` to capture 100 Hz 4-channel shaker RMS/Peak streams and DXGI gameplay screenshots.
- **Interactive Workbench (`src/client` & `src/server`)**: Synchronized `uPlot` multi-lane telemetry charts with drag-and-drop signal overlays, real-time NCalc formula evaluation, and UDP loop replay.
