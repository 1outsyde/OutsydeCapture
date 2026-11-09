/**
 * Upload a big file to a Mux direct upload URL in pieces, so a dropped connection only costs the
 * piece that was in flight (Pulse length step B).
 *
 * Mux's upload URL is resumable: each piece is a PUT with `Content-Range: bytes start-end/total`,
 * the server answers 308 to ask for more and 200 / 201 when the whole file is in, and pieces must
 * be multiples of 256 KB (the last one can be shorter). A 308 may carry `Range: bytes=0-N`, the
 * bytes it really has; if that ends before the piece we sent, we carry on from N + 1.
 *
 * The rules mirror Mux's own uploader, UpChunk 3.5.0 (MIT): a piece with no answer or a 408, 502,
 * 503 or 504 is sent again after a wait; anything else is a failure. UpChunk needs browser File,
 * ReadableStream and EventTarget, which React Native doesn't have, so this is our own small version.
 *
 * Pure logic only: the file reading and the network call are passed in, so this is unit tested in
 * resumableUpload.test.ts against a local server that behaves like the Mux URL.
 */

/** Piece size: 8 MB, a multiple of 256 KB as Mux requires. */
export const CHUNK_SIZE = 8 * 1024 * 1024;
export const CHUNK_MULTIPLE = 256 * 1024;

/** Tries per piece. With the waits below that is about 3.5 minutes of trying before giving up. */
export const MAX_ATTEMPTS = 12;

/** Status codes worth sending a piece again for (UpChunk's list). No answer at all also retries. */
export const RETRY_CODES = [408, 502, 503, 504];

export type ChunkResponse = {
  /** HTTP status, or null when there was no answer (connection dropped, timeout, offline). */
  status: number | null;
  /** The `Range` header of the answer, if any (e.g. "bytes=0-8388607"). */
  range?: string | null;
};

export type ChunkOutcome =
  | { kind: "next" } // piece accepted, send the next one
  | { kind: "done" } // whole file accepted
  | { kind: "resume"; from: number } // server has fewer bytes than sent: carry on from `from`
  | { kind: "retry" } // send this piece again after a wait
  | { kind: "fail"; status: number | null };

/** The piece that starts at `offset`: inclusive byte range and length. */
export function chunkRange(
  offset: number,
  total: number,
  chunkSize = CHUNK_SIZE,
): { start: number; end: number; length: number } {
  const length = Math.max(0, Math.min(chunkSize, total - offset));
  return { start: offset, end: offset + length - 1, length };
}

export function contentRange(
  start: number,
  end: number,
  total: number,
): string {
  return `bytes ${start}-${end}/${total}`;
}

/** Last byte the server says it has, from a `Range: bytes=0-N` header, or null. */
export function receivedEnd(range: string | null | undefined): number | null {
  if (!range) return null;
  const m = /bytes=(\d+)-(\d+)/i.exec(range);
  return m ? parseInt(m[2], 10) : null;
}

/** What to do after the answer to the piece `start`..`end` of a `total` byte file. */
export function chunkOutcome(
  res: ChunkResponse,
  start: number,
  end: number,
  total: number,
): ChunkOutcome {
  const { status } = res;
  if (status === null) return { kind: "retry" };
  if (status === 308) {
    const got = receivedEnd(res.range);
    if (got === null) {
      // A 308 with no Range means the server has nothing yet; only trust it as "next" when this
      // was not the first byte (UpChunk treats 308 as success unless Range says otherwise).
      return start === 0 ? { kind: "resume", from: 0 } : { kind: "next" };
    }
    if (got < end) return { kind: "resume", from: got + 1 };
    return end >= total - 1 ? { kind: "done" } : { kind: "next" };
  }
  if (status === 200 || status === 201 || status === 202 || status === 204) {
    return end >= total - 1 ? { kind: "done" } : { kind: "next" };
  }
  if (RETRY_CODES.includes(status)) return { kind: "retry" };
  return { kind: "fail", status };
}

/** Wait before try number `attempt` (2, 3, ...): 1 s, 2 s, 4 s, 8 s, 16 s, then 30 s. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 2));
}

export type ResumableUploadDeps = {
  total: number;
  /** Reads `length` bytes from `start`. */
  readChunk: (start: number, length: number) => Promise<Uint8Array>;
  /** Sends one piece; never throws for network trouble, returns { status: null } instead. */
  sendChunk: (
    bytes: Uint8Array,
    headers: Record<string, string>,
    onPieceProgress: (sentInPiece: number) => void,
  ) => Promise<ChunkResponse>;
  contentType: string;
  onProgress?: (p: { loaded: number; total: number; percent: number }) => void;
  /** Resolves when the app is in the foreground (pieces are not sent while it's in the background). */
  waitUntilActive?: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  chunkSize?: number;
  maxAttempts?: number;
};

export class ResumableUploadError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ResumableUploadError";
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

/** Uploads the whole file. Resolves when the server has every byte; throws ResumableUploadError. */
export async function runResumableUpload(
  deps: ResumableUploadDeps,
): Promise<void> {
  const {
    total,
    readChunk,
    sendChunk,
    contentType,
    onProgress,
    waitUntilActive,
    sleep = defaultSleep,
    chunkSize = CHUNK_SIZE,
    maxAttempts = MAX_ATTEMPTS,
  } = deps;
  if (!(total > 0))
    throw new ResumableUploadError("The video file is empty.", null);
  if (chunkSize % CHUNK_MULTIPLE !== 0) {
    throw new ResumableUploadError(
      "Piece size must be a multiple of 256 KB.",
      null,
    );
  }

  const report = (loaded: number) =>
    onProgress?.({
      loaded,
      total,
      percent: Math.min(100, Math.floor((loaded / total) * 100)),
    });

  let offset = 0;
  let rewinds = 0;
  report(0);
  while (offset < total) {
    const { start, end, length } = chunkRange(offset, total, chunkSize);
    const bytes = await readChunk(start, length);
    if (bytes.byteLength !== length) {
      throw new ResumableUploadError("The video file couldn't be read.", null);
    }
    const headers = {
      "Content-Type": contentType,
      "Content-Range": contentRange(start, end, total),
    };

    let attempt = 1;
    for (;;) {
      if (waitUntilActive) await waitUntilActive();
      const res = await sendChunk(bytes, headers, (sent) =>
        report(start + Math.min(sent, length)),
      );
      const outcome = chunkOutcome(res, start, end, total);
      if (outcome.kind === "done") {
        report(total);
        return;
      }
      if (outcome.kind === "next") {
        offset = end + 1;
        report(offset);
        break;
      }
      if (outcome.kind === "resume" && outcome.from > start) {
        // The server kept only part of the piece: read again from where it stopped.
        offset = outcome.from;
        report(offset);
        break;
      }
      if (outcome.kind === "fail") {
        throw new ResumableUploadError(
          `The video upload was refused (${outcome.status}).`,
          outcome.status,
        );
      }
      if (outcome.kind === "resume" && outcome.from < start) {
        // The server has less than we thought: go back to where it stopped. Counts as a try, and
        // the try count carries over, so a server that keeps going back can't loop forever.
        if (++rewinds > maxAttempts) {
          throw new ResumableUploadError(
            "The video upload lost its connection. Check your signal and try again.",
            res.status,
          );
        }
        offset = outcome.from;
        report(offset);
        break;
      }
      // Left: retry, or a "resume" that made no progress (counts as a try so it can't loop forever).
      attempt += 1;
      if (attempt > maxAttempts) {
        throw new ResumableUploadError(
          "The video upload lost its connection. Check your signal and try again.",
          res.status,
        );
      }
      await sleep(retryDelayMs(attempt));
    }
  }
  // Every piece was accepted with 308s but the last answer never said done: the server decides.
  report(total);
}
