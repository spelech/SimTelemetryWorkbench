import fs from "node:fs";
import zlib from "node:zlib";
import { ReplayScreenshotFrame, TelemetrySample } from "./types.js";
import { normalizeTelemetryRow } from "./forzaParser.js";

export interface SimHubReplayIndexEntry {
  entryType: number;
  entryPosition: number;
  picturePosition: number;
  frameTimeSec: number;
}

export interface ParsedSimHubReplay {
  samples: TelemetrySample[];
  screenshots: ReplayScreenshotFrame[];
  indexEntries: SimHubReplayIndexEntry[];
}

const HEADER_MAGIC = Buffer.from([0x46, 0x46, 0x30, 0x31, 0x00]); // "FF01\0"
const DATA_START_OFFSET = 10008;
const INDEX_RECORD_SIZE = 25;

/**
 * Parses a SimHub .telemetry.jsonidx binary index buffer.
 * Supports both raw 25-byte records and the 5-byte `[byte 2][int32 len]` prefix written by ReplayWriter.WriteEntries.
 */
export function parseSimHubReplayIndex(idxBuf: Buffer): SimHubReplayIndexEntry[] {
  const startOffset =
    idxBuf.length >= 5 && idxBuf.readUInt8(0) === 2 && (idxBuf.length - 5) % INDEX_RECORD_SIZE === 0 ? 5 : 0;
  const count = Math.floor((idxBuf.length - startOffset) / INDEX_RECORD_SIZE);
  const entries: SimHubReplayIndexEntry[] = [];
  for (let i = 0; i < count; i++) {
    const off = startOffset + i * INDEX_RECORD_SIZE;
    const entryType = idxBuf.readUInt8(off);
    const entryPosition = Number(idxBuf.readBigInt64LE(off + 1));
    const picturePosition = Number(idxBuf.readBigInt64LE(off + 9));
    const frameTimeSec = idxBuf.readDoubleLE(off + 17);
    entries.push({
      entryType,
      entryPosition,
      picturePosition,
      frameTimeSec
    });
  }
  return entries;
}

/**
 * Reads a SimHub .telemetry.json + .telemetry.jsonidx pair from disk or buffers.
 */
export function parseSimHubReplayBuffers(dataBuf: Buffer, idxBuf: Buffer): ParsedSimHubReplay {
  if (dataBuf.length < DATA_START_OFFSET || !dataBuf.subarray(0, 5).equals(HEADER_MAGIC)) {
    throw new Error("Invalid SimHub .telemetry.json header (expected FF01\\0)");
  }

  const indexEntries = parseSimHubReplayIndex(idxBuf);
  const samples: TelemetrySample[] = [];
  const screenshots: ReplayScreenshotFrame[] = [];
  const seenPictures = new Set<number>();

  for (const idx of indexEntries) {
    if (idx.entryType === 1 && idx.entryPosition >= DATA_START_OFFSET && idx.entryPosition + 5 <= dataBuf.length) {
      const marker = dataBuf.readUInt8(idx.entryPosition);
      if (marker === 1) {
        const compLen = dataBuf.readInt32LE(idx.entryPosition + 1);
        const start = idx.entryPosition + 5;
        const end = start + compLen;
        if (compLen > 0 && end <= dataBuf.length) {
          const compressed = dataBuf.subarray(start, end);
          const jsonStr = zlib.inflateRawSync(compressed).toString("utf8");
          const rawObj = JSON.parse(jsonStr) as Record<string, any>;
          samples.push(normalizeTelemetryRow(rawObj, idx.frameTimeSec));
        }
      }
      if (idx.picturePosition >= DATA_START_OFFSET && !seenPictures.has(idx.picturePosition)) {
        seenPictures.add(idx.picturePosition);
        screenshots.push({
          frameIndex: screenshots.length,
          t: idx.frameTimeSec,
          picturePosition: idx.picturePosition
        });
      }
    } else if (idx.entryType === 2 && idx.picturePosition >= DATA_START_OFFSET && !seenPictures.has(idx.picturePosition)) {
      seenPictures.add(idx.picturePosition);
      screenshots.push({
        frameIndex: screenshots.length,
        t: idx.frameTimeSec,
        picturePosition: idx.picturePosition
      });
    }
  }

  return { samples, screenshots, indexEntries };
}

/**
 * Extracts a single embedded DXGI JPEG screenshot from a .telemetry.json file at picturePosition.
 */
export function extractReplayScreenshotFromFile(telemetryFilePath: string, picturePosition: number): Buffer {
  const fd = fs.openSync(telemetryFilePath, "r");
  try {
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, picturePosition);
    const marker = header.readUInt8(0);
    if (marker !== 2) {
      throw new Error(`Expected screenshot marker 2 at offset ${picturePosition}, got ${marker}`);
    }
    const len = header.readInt32LE(1);
    if (len <= 0 || len > 20 * 1024 * 1024) {
      throw new Error(`Invalid JPEG length ${len} at offset ${picturePosition}`);
    }
    const jpeg = Buffer.alloc(len);
    fs.readSync(fd, jpeg, 0, len, picturePosition + 5);
    return jpeg;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Serializes telemetry entries and optional JPEG screenshots into SimHub's native
 * .telemetry.json and .telemetry.jsonidx binary buffers.
 */
export function buildSimHubReplayBuffers(
  items: Array<
    | { type: "telemetry"; tSec: number; payload: Record<string, any> }
    | { type: "screenshot"; tSec: number; jpegBytes: Buffer }
  >
): { dataBuf: Buffer; idxBuf: Buffer } {
  const dataChunks: Buffer[] = [];
  const header = Buffer.alloc(DATA_START_OFFSET, 0);
  HEADER_MAGIC.copy(header, 0);
  header.writeInt32LE(10000, 5);
  dataChunks.push(header);

  const idxChunks: Buffer[] = [];
  let currentOffset = DATA_START_OFFSET;
  let lastTelemetryPos = 0;
  let lastPicturePos = 0;

  const telemetryIndexRecords: Buffer[] = [];

  for (const item of items) {
    if (item.type === "screenshot") {
      lastPicturePos = currentOffset;
      const entryHeader = Buffer.alloc(5);
      entryHeader.writeUInt8(2, 0);
      entryHeader.writeInt32LE(item.jpegBytes.length, 1);
      dataChunks.push(entryHeader, item.jpegBytes);
      currentOffset += 5 + item.jpegBytes.length;

      const idxRec = Buffer.alloc(INDEX_RECORD_SIZE);
      idxRec.writeUInt8(2, 0);
      idxRec.writeBigInt64LE(BigInt(lastTelemetryPos), 1);
      idxRec.writeBigInt64LE(BigInt(lastPicturePos), 9);
      idxRec.writeDoubleLE(item.tSec, 17);
      telemetryIndexRecords.push(idxRec);
    } else {
      lastTelemetryPos = currentOffset;
      const jsonBytes = Buffer.from(JSON.stringify(item.payload), "utf8");
      const deflated = zlib.deflateRawSync(jsonBytes);
      const entryHeader = Buffer.alloc(5);
      entryHeader.writeUInt8(1, 0);
      entryHeader.writeInt32LE(deflated.length, 1);
      dataChunks.push(entryHeader, deflated);
      currentOffset += 5 + deflated.length;

      const idxRec = Buffer.alloc(INDEX_RECORD_SIZE);
      idxRec.writeUInt8(1, 0);
      idxRec.writeBigInt64LE(BigInt(lastTelemetryPos), 1);
      idxRec.writeBigInt64LE(BigInt(lastPicturePos), 9);
      idxRec.writeDoubleLE(item.tSec, 17);
      telemetryIndexRecords.push(idxRec);
    }
  }

  const idxHeader = Buffer.alloc(5);
  idxHeader.writeUInt8(2, 0);
  idxHeader.writeInt32LE(telemetryIndexRecords.length * 17, 1);
  idxChunks.push(idxHeader, ...telemetryIndexRecords);

  const dataBuf = Buffer.concat(dataChunks);
  const idxBuf = Buffer.concat(idxChunks);

  return { dataBuf, idxBuf };
}
