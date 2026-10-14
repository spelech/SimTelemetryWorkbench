# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-13
### Added
- Initial project scaffolding adhering to `AgenticEngineeringToolbelt` standards and traditional Git Flow.
- `SimHubPatcher` IL patcher (`dnlib`) enabling sub-10ms live reload of `ShakeITBassShakersSettingsV2.json` via `.reload` marker files without restarting SimHub.
- `AudioTapRunner` 100 Hz (10 ms bucket) 4-channel WASAPI loopback recorder (`Nobsound` Brake/Throttle pedal shakers + `Fosi` Seat Left/Right shakers) and `SimHub.ScreenCapture.dll` DXGI frame recorder.
- `forzaParser`, `simhubReplayParser`, and `formulaEvaluator` with deterministic unit and closed-loop simulation harness test suites.
- Interactive React + `uPlot` multi-lane telemetry workbench with drag-and-drop signal overlays, loop slice UDP replay (`127.0.0.1:8000`), and live ShakeIt NCalc formula tuning.
- 4-stage GitHub Actions CI/CD quality gates, `verify_release.py` integrity/anti-theatre audit, and VitePress living documentation.
