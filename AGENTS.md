# AGENTS.md

Instructions and architectural guidelines for AI coding agents working on **SimTelemetryWorkbench**.

## 🛑 Guardrails & Rules
1. **Strict TypeScript & Zero Linter Warnings**: Frontends and backend services must pass `npm run lint` (`--max-warnings 0`) and `npx tsc --noEmit`.
2. **Traditional Git Flow**: Work in `feature/*` branches off `develop`. Release through `release/v*` branches to `main` with SemVer tags (`vX.Y.Z`) and sync back to `develop`.
3. **Anti-Test Theatre & Representative Verification**: Test software using real HTTP roundtrips, real packet encoders/decoders, and real simulation harnesses. Never mock internal domain services or parsers.
4. **ASD-STE100 Documentation**: Keep documentation sentences concise ($\le$ 25 words), in active voice, with native Mermaid diagrams.
5. **Version Synchronization**: Keep `package.json`, `Directory.Build.props`, and `CHANGELOG.md` synchronized and verified via `python scripts/verify_release.py`.

## 📚 Reference Documents
- [Architecture Overview](ARCHITECTURE.md)
- [Software Requirements & Traceability](REQUIREMENTS.md)
- [Changelog](CHANGELOG.md)

## 🛠️ Verification Commands
```bash
# Release & Anti-Test-Theatre Audit
python scripts/verify_release.py --audit-tests
python scripts/verify_release.py --ci

# Lint, Typecheck, Unit/Harness Tests & Production Build
npm run lint
npx tsc --noEmit
npm test
npm run build
```
