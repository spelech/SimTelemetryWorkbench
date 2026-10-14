import { TelemetrySample } from "./types.js";

/**
 * Replaces NCalc `if(cond, trueExpr, falseExpr)` calls (including nested ones)
 * with JS ternary `((cond) ? (trueExpr) : (falseExpr))`.
 */
function convertNCalcIfs(expr: string): string {
  let result = expr;
  const ifRegex = /\bif\s*\(/i;
  let safety = 0;

  while (safety++ < 100) {
    const match = ifRegex.exec(result);
    if (!match) break;

    const startIdx = match.index;
    const openParenIdx = startIdx + match[0].length - 1;
    let depth = 0;
    const commaPositions: number[] = [];
    let closeParenIdx = -1;

    for (let i = openParenIdx; i < result.length; i++) {
      const ch = result[i];
      if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth--;
        if (depth === 0) {
          closeParenIdx = i;
          break;
        }
      } else if (ch === "," && depth === 1) {
        commaPositions.push(i);
      }
    }

    if (closeParenIdx === -1 || commaPositions.length < 2) {
      break;
    }

    const condPart = result.slice(openParenIdx + 1, commaPositions[0]);
    const truePart = result.slice(commaPositions[0] + 1, commaPositions[1]);
    const falsePart = result.slice(commaPositions[1] + 1, closeParenIdx);

    const ternary = `((${condPart}) ? (${truePart}) : (${falsePart}))`;
    result = result.slice(0, startIdx) + ternary + result.slice(closeParenIdx + 1);
  }

  return result;
}

/**
 * Resolves a SimHub property path (e.g. `DataCorePlugin.GameData.Brake` or
 * `DataCorePlugin.GameRawData.TireSlipRatioRearLeft`) against a TelemetrySample.
 */
export function resolveSampleProp(sample: TelemetrySample, rawPath: string): number {
  const cleaned = rawPath
    .replace(/^DataCorePlugin\.GameData\./i, "")
    .replace(/^DataCorePlugin\./i, "")
    .replace(/^NewData\./i, "");

  const val = sample[cleaned] ?? sample[rawPath];
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "string") {
    if (val === "R") return -1;
    if (val === "N") return 0;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Compiles a SimHub NCalc/JS formula into a fast evaluator function `(sample: TelemetrySample) => number`.
 */
export function compileSimHubFormula(formula: string): (sample: TelemetrySample) => number {
  const trimmed = formula.trim();
  if (!trimmed) {
    return () => 0;
  }

  let jsExpr = trimmed.replace(/\[([^\]]+)\]/g, (_m, propPath: string) => {
    const escaped = propPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `__get("${escaped}")`;
  });

  jsExpr = convertNCalcIfs(jsExpr);

  jsExpr = jsExpr
    .replace(/\band\b/gi, "&&")
    .replace(/\bor\b/gi, "||")
    .replace(/\bnot\b/gi, "!")
    .replace(/<>/g, "!==")
    .replace(/\bMin\s*\(/gi, "Math.min(")
    .replace(/\bMax\s*\(/gi, "Math.max(")
    .replace(/\bAbs\s*\(/gi, "Math.abs(")
    .replace(/\bPow\s*\(/gi, "Math.pow(")
    .replace(/\bSqrt\s*\(/gi, "Math.sqrt(")
    .replace(/\bRound\s*\(/gi, "Math.round(")
    .replace(/\bClamp\s*\(/gi, "__clamp(");

  let fn: (
    get: (p: string) => number,
    clamp: (v: number, lo: number, hi: number) => number
  ) => number;
  try {
    fn = new Function(
      "__get",
      "__clamp",
      `"use strict"; return Number(${jsExpr});`
    ) as (
      get: (p: string) => number,
      clamp: (v: number, lo: number, hi: number) => number
    ) => number;
  } catch {
    return () => 0;
  }

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  return (sample: TelemetrySample): number => {
    try {
      const out = fn((p: string) => resolveSampleProp(sample, p), clamp);
      if (!Number.isFinite(out)) return 0;
      return Math.min(100, Math.max(0, out));
    } catch {
      return 0;
    }
  };
}

/**
 * Evaluates a SimHub formula over an entire array of TelemetrySamples.
 */
export function evaluateFormulaSeries(samples: TelemetrySample[], formula: string): number[] {
  const evaluator = compileSimHubFormula(formula);
  return samples.map((s) => evaluator(s));
}
