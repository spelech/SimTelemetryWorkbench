# 📋 Software Requirements Specification: SimTelemetryWorkbench

This specification defines the functional requirements and automated test traceability matrix for **SimTelemetryWorkbench**.

---

## 🎯 Requirements & Traceability Matrix

| Requirement ID | Summary | Acceptance Criteria | Automated Test Proof |
| :--- | :--- | :--- | :--- |
| **`REQ-001`** | **Health Check Probe** | The backend exposes `/health` returning HTTP 200 and service status JSON. | `src/shared/__tests__/workbenchHarness.test.ts` |
| **`REQ-002`** | **Forza 324-Byte UDP Codec** | Encodes and decodes 324-byte `FH6Packet` Sled+Dash structures losslessly. | `src/shared/__tests__/workbenchCore.test.ts` |
| **`REQ-003`** | **SimHub Replay Parser** | Reads and writes Brotli-compressed `.telemetry.json` and `.telemetry.jsonidx` streams with embedded JPEG screenshots. | `src/shared/__tests__/workbenchCore.test.ts` |
| **`REQ-004`** | **SimHub NCalc Formula Evaluator** | Evaluates `if`, `Max`, `Min`, `abs`, and logical expressions across telemetry arrays. | `src/shared/__tests__/workbenchCore.test.ts` |
| **`REQ-005`** | **100 Hz WASAPI Audio Tap Merge** | Parses 100 Hz 4-channel WASAPI CSV streams and aligns shaker RMS/Peak with telemetry samples. | `src/shared/__tests__/workbenchCore.test.ts` |
| **`REQ-006`** | **Closed-Loop Simulation Harness** | Sweeps 1,000+ synthetic packets, injects malformed disturbances, and formats failures in a 6-part feedback envelope. | `src/shared/__tests__/workbenchHarness.test.ts` |

---

## 📜 Requirement Definitions

### `[REQ-001]` Health Check Probe
- **Description**: The backend server must expose an unauthenticated `GET /health` endpoint returning service status and uptime.
- **Verification**: Full HTTP roundtrip integration test in `workbenchHarness.test.ts`.

### `[REQ-002]` Forza 324-Byte UDP Packet Codec
- **Description**: The parser must encode and decode 324-byte Forza Horizon (`FH6Packet`) UDP frames including 4-wheel slip ratios, combined slip, suspension travel, and dash inputs.
- **Verification**: Round-trip binary buffer assertions and boundary sweeps.

### `[REQ-003]` SimHub Native Replay Format Compatibility
- **Description**: The parser must read and construct SimHub `.telemetry.json` (Brotli stream + raw JPEG slices) and `.telemetry.jsonidx` binary indices.
- **Verification**: Round-trip buffer construction and extraction assertions.

### `[REQ-004]` Real-Time NCalc Formula Evaluation
- **Description**: The evaluator must compile SimHub NCalc expressions into fast JavaScript functions for 60 FPS curve previewing.
- **Verification**: Unit and boundary sweep assertions across ABS lockup and TCR wheelspin formulas.
