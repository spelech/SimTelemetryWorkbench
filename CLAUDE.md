# 🤖 Claude Code Agent Configuration

This repository adheres to the architecture, coding standards, test harness conventions, and CI/CD quality gates codified in `AgenticEngineeringToolbelt`.

## 📌 Master Rules Reference
Always follow all guidelines in [**AGENTS.md**](AGENTS.md), [**ARCHITECTURE.md**](ARCHITECTURE.md), and [**REQUIREMENTS.md**](REQUIREMENTS.md).

## ⚡ Active Skills
- `engineering-archetype`: Master architectural standards across C#, Python, TS, and C++.
- `scaffold-project`: Scaffolds projects adhering to traditional Git Flow, living documentation, and 4-stage CI/CD.
- `test-harness-builder`: Builds closed-loop simulation harnesses, tap points, Playwright UI drivers, and 6-part feedback envelopes.

## 🎯 Core Execution Tenets
1. **Traditional Git Flow**: Work in `feature/*` branches off `develop`. Release through `release/*` branches to `main` with tags and back to `develop`. Urgent fixes flow through `hotfix/*` off `main`.
2. **APIs First, MCP Later**: Keep domain logic inside typed, standalone libraries and REST APIs. Expose MCP tools strictly as thin wrappers.
3. **Simulation & Control Harnesses**: Treat software as an observable dynamic system. Build diagnostic tap points, stress loops, disturbance injection, and 6-part feedback envelopes.
4. **Tiered Testing Cadence**: Tier 1 (inner loop on demand), Tier 2 (stabilization gate before manual testing), Tier 3 (full matrix, harness sweeps, and Playwright audits before PR/release).
5. **Living Documentation & ASD-STE100**: Apply ASD-STE100 rules ($\le$ 20-25 words per sentence, active voice, imperative mood). Embed native Mermaid diagrams. Publish via VitePress.
6. **Anti-Test Theatre & Representative Verification**: Test with real implementations and full HTTP roundtrips. Never mock internal interfaces or repositories. Follow the Deterministic Test Budget Formula ($1 + \text{Branches} + \text{Boundaries} + \text{Disturbances}$) in [**AGENTS.md**](AGENTS.md).
