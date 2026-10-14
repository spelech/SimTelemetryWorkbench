using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using SimHub.ScreenCapture;

namespace AudioTapRunner;

public static class Program
{
    private const string SimHubDir = @"C:\Program Files (x86)\SimHub";

    static Program()
    {
        AppDomain.CurrentDomain.AssemblyResolve += (_, args) =>
        {
            var asmName = new AssemblyName(args.Name).Name + ".dll";
            var candidate = Path.Combine(SimHubDir, asmName);
            return File.Exists(candidate) ? Assembly.LoadFrom(candidate) : null;
        };
    }

    public static int Main(string[] args)
    {
        int durationMs = 10000;
        string outCsv = "audio_tap.csv";
        string framesDir = null;
        int fps = 10;

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--duration-ms" && i + 1 < args.Length)
                durationMs = int.Parse(args[++i], CultureInfo.InvariantCulture);
            else if (args[i] == "--out-csv" && i + 1 < args.Length)
                outCsv = args[++i];
            else if (args[i] == "--frames-dir" && i + 1 < args.Length)
                framesDir = args[++i];
            else if (args[i] == "--fps" && i + 1 < args.Length)
                fps = int.Parse(args[++i], CultureInfo.InvariantCulture);
        }

        return RunCapture(durationMs, outCsv, framesDir, fps);
    }

    private sealed class DeviceTap
    {
        public string Tag;
        public string FriendlyName;
        public WasapiLoopbackCapture Capture;
        public int Channels;
        public int Bits;
        public bool IsFloat;
        public readonly Dictionary<int, double[]> SumSq = new Dictionary<int, double[]>();
        public readonly Dictionary<int, double[]> Peak = new Dictionary<int, double[]>();
        public readonly Dictionary<int, int> Count = new Dictionary<int, int>();
    }

    private static int RunCapture(int durationMs, string outCsv, string framesDir, int fps)
    {
        DateTime t0 = DateTime.UtcNow;
        double epoch0 = (t0 - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;

        var enumerator = new MMDeviceEnumerator();
        var targets = new[]
        {
            ("Pedals", new[] { "a93d1563-1db8-4f4f-b4ef-1620d6e3ac2c", "Nobsound", "Pedals", "USB2.0 Device" }),
            ("Chassis", new[] { "974b8af4-53b8-4db8-b227-4fe232bf495b", "Fosi", "Chassis", "USB Audio Adapter" })
        };
        var taps = new List<DeviceTap>();

        foreach (var (tag, matchTokens) in targets)
        {
            MMDevice found = null;
            foreach (var dev in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
            {
                bool hit = false;
                foreach (var token in matchTokens)
                {
                    if ((dev.ID != null && dev.ID.IndexOf(token, StringComparison.OrdinalIgnoreCase) >= 0) ||
                        (dev.FriendlyName != null && dev.FriendlyName.IndexOf(token, StringComparison.OrdinalIgnoreCase) >= 0))
                    {
                        hit = true;
                        break;
                    }
                }
                if (hit)
                {
                    found = dev;
                    break;
                }
            }

            if (found == null)
            {
                Console.Error.WriteLine($"Warning: Audio device for '{tag}' not found.");
                continue;
            }

            var tap = new DeviceTap
            {
                Tag = tag,
                FriendlyName = found.FriendlyName,
                Capture = new WasapiLoopbackCapture(found)
            };
            tap.Channels = tap.Capture.WaveFormat.Channels;
            tap.Bits = tap.Capture.WaveFormat.BitsPerSample;
            tap.IsFloat = tap.Bits == 32;

            DeviceTap cur = tap;
            tap.Capture.DataAvailable += (_, e) =>
            {
                // 100 Hz = 10 ms buckets
                int bucket = (int)((DateTime.UtcNow - t0).TotalMilliseconds / 10.0);
                int bps = cur.Bits / 8;
                int frameSize = bps * cur.Channels;
                if (frameSize <= 0) return;
                int frames = e.BytesRecorded / frameSize;
                if (frames <= 0) return;

                lock (cur)
                {
                    if (!cur.SumSq.ContainsKey(bucket))
                    {
                        cur.SumSq[bucket] = new double[cur.Channels];
                        cur.Peak[bucket] = new double[cur.Channels];
                        cur.Count[bucket] = 0;
                    }
                    for (int i = 0; i < frames; i++)
                    {
                        for (int c = 0; c < cur.Channels; c++)
                        {
                            int off = i * frameSize + c * bps;
                            double v = cur.IsFloat
                                ? BitConverter.ToSingle(e.Buffer, off)
                                : BitConverter.ToInt16(e.Buffer, off) / 32768.0;
                            cur.SumSq[bucket][c] += v * v;
                            double abs = Math.Abs(v);
                            if (abs > cur.Peak[bucket][c])
                                cur.Peak[bucket][c] = abs;
                        }
                    }
                    cur.Count[bucket] += frames;
                }
            };

            taps.Add(tap);
        }

        JpegCaptureTarget jpegCapture = null;
        int capturedFrames = 0;
        if (!string.IsNullOrEmpty(framesDir))
        {
            Directory.CreateDirectory(framesDir);
            try
            {
                string display = Screen.PrimaryScreen?.DeviceName ?? @"\\.\DISPLAY1";
                jpegCapture = ScreenCaptureFactory.Instance.CreateJpegCapture(display, fps);
                jpegCapture.JpegCaptureReady += (_, e) =>
                {
                    if (e?.Bytes == null || e.Bytes.Length == 0) return;
                    int elapsedMs = (int)(DateTime.UtcNow - t0).TotalMilliseconds;
                    string framePath = Path.Combine(framesDir, $"frame_{elapsedMs:D7}.jpg");
                    try
                    {
                        File.WriteAllBytes(framePath, e.Bytes);
                        Interlocked.Increment(ref capturedFrames);
                    }
                    catch
                    {
                        // Ignore single frame write contention
                    }
                };
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("DXGI ScreenCapture warning: " + ex.Message);
            }
        }

        foreach (var tap in taps)
            tap.Capture.StartRecording();

        Thread.Sleep(durationMs);

        foreach (var tap in taps)
            tap.Capture.StopRecording();

        try
        {
            jpegCapture?.Dispose();
        }
        catch
        {
        }

        Thread.Sleep(150);

        int maxBuckets = (durationMs / 10) + 10;
        var sb = new StringBuilder();
        sb.AppendLine("ts,t,pedalBrakeRms,pedalBrakePeak,pedalThrottleRms,pedalThrottlePeak,seatLeftRms,seatLeftPeak,seatRightRms,seatRightPeak");

        var pedalsTap = taps.Find(t => t.Tag == "Pedals");
        var chassisTap = taps.Find(t => t.Tag == "Chassis");

        for (int b = 0; b < maxBuckets; b++)
        {
            double tRel = b * 0.01;
            double ts = epoch0 + tRel;
            GetBucketCh(pedalsTap, b, 0, out double pbRms, out double pbPeak);
            GetBucketCh(pedalsTap, b, 1, out double ptRms, out double ptPeak);
            GetBucketCh(chassisTap, b, 0, out double slRms, out double slPeak);
            GetBucketCh(chassisTap, b, 1, out double srRms, out double srPeak);

            sb.AppendFormat(
                CultureInfo.InvariantCulture,
                "{0:F3},{1:F3},{2:F5},{3:F5},{4:F5},{5:F5},{6:F5},{7:F5},{8:F5},{9:F5}\n",
                ts, tRel, pbRms, pbPeak, ptRms, ptPeak, slRms, slPeak, srRms, srPeak);
        }

        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outCsv)) ?? ".");
        File.WriteAllText(outCsv, sb.ToString(), new UTF8Encoding(false));
        Console.WriteLine($"Wrote {maxBuckets} 100Hz buckets to {outCsv} (DXGI frames={capturedFrames})");
        return 0;
    }

    private static void GetBucketCh(DeviceTap tap, int bucket, int ch, out double rms, out double peak)
    {
        rms = 0;
        peak = 0;
        if (tap == null) return;
        lock (tap)
        {
            if (tap.SumSq.TryGetValue(bucket, out var sq) &&
                tap.Peak.TryGetValue(bucket, out var pk) &&
                tap.Count.TryGetValue(bucket, out int cnt) &&
                cnt > 0 && ch < sq.Length)
            {
                rms = Math.Sqrt(sq[ch] / cnt);
                peak = pk[ch];
            }
        }
    }
}
