import { defineConfig } from "vitepress";

export default defineConfig({
  title: "SimTelemetryWorkbench",
  description:
    "Scientific telemetry visualization, 100 Hz WASAPI shaker analyzer, and zero-restart SimHub ShakeIt formula tuner.",
  base: "/SimTelemetryWorkbench/",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/spelech/SimTelemetryWorkbench" }
    ]
  }
});
