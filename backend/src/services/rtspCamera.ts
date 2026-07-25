import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ServerResponse } from "node:http";

// Relies on ffmpeg being present on PATH (installed via apt in the Docker
// runtime image); override with FFMPEG_PATH if it lives somewhere else.
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "ffmpeg";

const JPEG_SOI = Buffer.from([0xff, 0xd8]);
const JPEG_EOI = Buffer.from([0xff, 0xd9]);

const IDLE_STOP_MS = 30_000;
const SNAPSHOT_TIMEOUT_MS = 8_000;
const RESTART_BACKOFF_MS = 2_000;
const STDERR_TAIL_MAX_CHARS = 2_000;

// The RTSP URL can carry plaintext credentials (rtsp://user:pass@host/...) —
// never let those reach logs.
function maskUrl(url: string): string {
  return url.replace(/\/\/[^/@]+@/, "//***@");
}

export type CameraState = "idle" | "connecting" | "streaming" | "error";

export interface CameraStatus {
  state: CameraState;
  error?: string;
}

/**
 * Decodes one RTSP stream into MJPEG via a single shared ffmpeg process, so
 * multiple preview viewers / snapshot calls don't each open their own RTSP
 * connection (many IP cameras cap concurrent viewers).
 */
class RtspCameraManager extends EventEmitter {
  private readonly url: string;
  private process: ChildProcessWithoutNullStreams | null = null;
  private buffer = Buffer.alloc(0);
  private latestFrame: Buffer | null = null;
  private readonly subscribers = new Set<ServerResponse>();
  private state: CameraState = "idle";
  private lastError: string | undefined;
  private idleTimer: NodeJS.Timeout | null = null;
  private pendingFrameWaiters: Array<(frame: Buffer) => void> = [];
  // ffmpeg's own exit code is frequently useless on Windows (auth failures,
  // codec errors, etc. all surface as a garbled unsigned wraparound), so we
  // keep the tail of its stderr around to fold into error messages/logs.
  private stderrTail = "";

  constructor(url: string) {
    super();
    this.url = url;
  }

  getStatus(): CameraStatus {
    return this.lastError ? { state: this.state, error: this.lastError } : { state: this.state };
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdleStop(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.subscribers.size === 0) this.stop();
    }, IDLE_STOP_MS);
  }

  private ensureRunning(): void {
    this.clearIdleTimer();
    if (this.process) return;

    this.state = "connecting";
    this.lastError = undefined;
    this.buffer = Buffer.alloc(0);
    this.stderrTail = "";

    const proc = spawn(FFMPEG_PATH, [
      "-rtsp_transport",
      "tcp",
      "-i",
      this.url,
      // This stream is only ever shown at .cam-wrap's on-screen size (well
      // under 1280px wide), not saved — downscaling it cuts bandwidth ~4x
      // for the continuous live preview, which chokes weaker/older devices
      // at the camera's native resolution. captureFullFrame() below grabs
      // an undownscaled frame separately for the actual saved photo.
      "-vf",
      "scale='min(1280,iw)':-2",
      "-f",
      "mjpeg",
      "-q:v",
      "3",
      "-r",
      "10",
      "pipe:1",
    ]);
    this.process = proc;

    proc.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    proc.stderr.on("data", (chunk: Buffer) => {
      this.stderrTail = (this.stderrTail + chunk.toString()).slice(-STDERR_TAIL_MAX_CHARS);
    });
    proc.on("error", (err) => {
      if (this.process !== proc) return;
      this.state = "error";
      this.lastError = err.message;
      this.process = null;
      console.error(`[rtsp-camera] failed to launch ffmpeg for ${maskUrl(this.url)}:`, err.message);
    });
    proc.on("exit", (code) => {
      if (this.process !== proc) return; // torn down intentionally via stop()
      const hadSubscribers = this.subscribers.size > 0;
      this.process = null;
      this.state = "error";
      const detail = this.stderrTail.trim();
      this.lastError = detail
        ? `ffmpeg exited with code ${code}: ${detail.split("\n").pop()}`
        : `ffmpeg exited with code ${code}`;
      console.error(
        `[rtsp-camera] ffmpeg exited (code ${code}) for ${maskUrl(this.url)}${detail ? `\n${detail}` : ""}`,
      );
      if (hadSubscribers) {
        setTimeout(() => {
          if (this.subscribers.size > 0 && !this.process) this.ensureRunning();
        }, RESTART_BACKOFF_MS);
      }
    });
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const start = this.buffer.indexOf(JPEG_SOI);
      if (start < 0) {
        if (this.buffer.length > 1) this.buffer = this.buffer.subarray(this.buffer.length - 1);
        return;
      }
      const end = this.buffer.indexOf(JPEG_EOI, start + 2);
      if (end < 0) {
        if (start > 0) this.buffer = this.buffer.subarray(start);
        return;
      }
      const frame = Buffer.from(this.buffer.subarray(start, end + 2));
      this.buffer = this.buffer.subarray(end + 2);
      this.handleFrame(frame);
    }
  }

  private handleFrame(frame: Buffer): void {
    this.state = "streaming";
    this.lastError = undefined;
    this.latestFrame = frame;
    const waiters = this.pendingFrameWaiters;
    this.pendingFrameWaiters = [];
    waiters.forEach((resolve) => resolve(frame));
    for (const res of this.subscribers) this.writeFrame(res, frame);
  }

  private writeFrame(res: ServerResponse, frame: Buffer): void {
    res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
    res.write(frame);
    res.write("\r\n");
  }

  subscribe(res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-store",
      Connection: "close",
    });
    this.subscribers.add(res);
    this.ensureRunning();
    if (this.latestFrame) this.writeFrame(res, this.latestFrame);
    res.on("close", () => {
      this.subscribers.delete(res);
      if (this.subscribers.size === 0) this.scheduleIdleStop();
    });
  }

  async getLatestFrame(timeoutMs = SNAPSHOT_TIMEOUT_MS): Promise<Buffer> {
    this.ensureRunning();
    if (this.latestFrame && this.state === "streaming") return this.latestFrame;

    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingFrameWaiters = this.pendingFrameWaiters.filter((w) => w !== waiter);
        reject(new Error(this.lastError ?? "Timed out waiting for a frame from the camera"));
      }, timeoutMs);
      const waiter = (frame: Buffer): void => {
        clearTimeout(timer);
        resolve(frame);
      };
      this.pendingFrameWaiters.push(waiter);
    });
  }

  /**
   * Grabs a single frame at the camera's native resolution via its own
   * short-lived ffmpeg process, independent of the shared downscaled
   * preview stream — used for the actual saved photo, which shouldn't be
   * capped at the preview's reduced size. Briefly opens a second RTSP
   * session alongside the live preview's; fine for cameras that support
   * more than one concurrent viewer (most do), but something to watch for
   * on cameras with a session limit of exactly one.
   */
  async captureFullFrame(timeoutMs = SNAPSHOT_TIMEOUT_MS): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const proc = spawn(FFMPEG_PATH, [
        "-rtsp_transport",
        "tcp",
        "-i",
        this.url,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-f",
        "mjpeg",
        "pipe:1",
      ]);

      let stdout = Buffer.alloc(0);
      let stderrTail = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill("SIGKILL");
        reject(new Error("Timed out capturing a full-resolution frame from the camera"));
      }, timeoutMs);

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout = Buffer.concat([stdout, chunk]);
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-STDERR_TAIL_MAX_CHARS);
      });
      proc.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        console.error(
          `[rtsp-camera] failed to launch one-shot capture for ${maskUrl(this.url)}:`,
          err.message,
        );
        reject(err);
      });
      proc.on("exit", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const start = stdout.indexOf(JPEG_SOI);
        const end = start >= 0 ? stdout.indexOf(JPEG_EOI, start + 2) : -1;
        if (start >= 0 && end >= 0) {
          resolve(Buffer.from(stdout.subarray(start, end + 2)));
          return;
        }
        const detail = stderrTail.trim();
        console.error(
          `[rtsp-camera] one-shot capture failed (code ${code}) for ${maskUrl(this.url)}${detail ? `\n${detail}` : ""}`,
        );
        reject(
          new Error(
            detail
              ? `capture failed (code ${code}): ${detail.split("\n").pop()}`
              : `capture failed (code ${code})`,
          ),
        );
      });
    });
  }

  stop(): void {
    this.clearIdleTimer();
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
    this.state = "idle";
    this.lastError = undefined;
    this.latestFrame = null;
    this.buffer = Buffer.alloc(0);
  }
}

let current: RtspCameraManager | null = null;
let currentUrl: string | null = null;

/** Returns the shared manager for `url`, tearing down a stale one if the configured URL changed. */
export function getRtspCameraManager(url: string): RtspCameraManager {
  if (current && currentUrl !== url) {
    current.stop();
    current = null;
  }
  if (!current) {
    current = new RtspCameraManager(url);
    currentUrl = url;
  }
  return current;
}
