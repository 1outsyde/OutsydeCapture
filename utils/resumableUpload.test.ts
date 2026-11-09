import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import {
  CHUNK_SIZE,
  CHUNK_MULTIPLE,
  chunkOutcome,
  chunkRange,
  contentRange,
  receivedEnd,
  retryDelayMs,
  runResumableUpload,
  ResumableUploadError,
  type ChunkResponse,
} from "./resumableUpload";

// ── Pure rules ───────────────────────────────────────────────────────────────

test("pieces are 8 MB, a multiple of 256 KB", () => {
  assert.equal(CHUNK_SIZE, 8 * 1024 * 1024);
  assert.equal(CHUNK_SIZE % CHUNK_MULTIPLE, 0);
});

test("chunkRange: full pieces, then the short last one", () => {
  assert.deepEqual(chunkRange(0, 20, 8), { start: 0, end: 7, length: 8 });
  assert.deepEqual(chunkRange(16, 20, 8), { start: 16, end: 19, length: 4 });
  assert.equal(contentRange(16, 19, 20), "bytes 16-19/20");
});

test("receivedEnd reads the Range header", () => {
  assert.equal(receivedEnd("bytes=0-8388607"), 8388607);
  assert.equal(receivedEnd("Bytes=0-9"), 9);
  assert.equal(receivedEnd(null), null);
  assert.equal(receivedEnd("nonsense"), null);
});

test("chunkOutcome follows Mux / UpChunk rules", () => {
  const o = (r: ChunkResponse, s: number, e: number, t: number) =>
    chunkOutcome(r, s, e, t).kind;
  assert.equal(o({ status: 308, range: "bytes=0-7" }, 0, 7, 20), "next");
  assert.equal(o({ status: 308, range: "bytes=0-3" }, 0, 7, 20), "resume");
  assert.deepEqual(
    chunkOutcome({ status: 308, range: "bytes=0-3" }, 0, 7, 20),
    {
      kind: "resume",
      from: 4,
    },
  );
  assert.equal(o({ status: 308 }, 8, 15, 20), "next");
  assert.equal(o({ status: 201 }, 16, 19, 20), "done");
  assert.equal(o({ status: 200 }, 16, 19, 20), "done");
  assert.equal(o({ status: 308, range: "bytes=0-19" }, 16, 19, 20), "done");
  assert.equal(o({ status: null }, 0, 7, 20), "retry");
  for (const s of [408, 502, 503, 504])
    assert.equal(o({ status: s }, 0, 7, 20), "retry");
  for (const s of [400, 401, 403, 404, 410, 500])
    assert.equal(o({ status: s }, 0, 7, 20), "fail");
});

test("retryDelayMs grows to a 30 s cap", () => {
  assert.deepEqual(
    [2, 3, 4, 5, 6, 7, 12].map(retryDelayMs),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000],
  );
});

// ── Whole upload against a local server that behaves like the Mux URL ───────

type Fault =
  | { kind: "drop" } // close the connection before answering
  | { kind: "status"; status: number } // answer with this status, keep nothing
  | { kind: "keepHalf" } // keep half the piece, answer 308 with Range to it
  | { kind: "cutMidPiece" }; // keep half the piece, then close the connection

/**
 * Strict resumable server: a piece must start exactly at the bytes it has, otherwise it answers
 * 308 with the Range it really has. 308 + Range after each piece, 201 when complete.
 */
function fakeMux(total: number, faults: Map<number, Fault[]>) {
  const received: Buffer[] = [];
  let have = 0;
  let pieceCalls = 0;
  let faultsFired = 0;
  const server = http.createServer((req, res) => {
    const call = pieceCalls++;
    const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(
      String(req.headers["content-range"] ?? ""),
    );
    const parts: Buffer[] = [];
    req.on("data", (d: Buffer) => parts.push(d));
    req.on("end", () => {
      const body = Buffer.concat(parts);
      const fault = faults.get(call)?.shift();
      if (fault) faultsFired++;
      const range = () => (have > 0 ? { Range: `bytes=0-${have - 1}` } : {});
      if (!m || Number(m[3]) !== total || req.method !== "PUT") {
        res.writeHead(400).end();
        return;
      }
      const start = Number(m[1]);
      if (start !== have) {
        res.writeHead(308, range()).end();
        return;
      }
      if (fault?.kind === "drop") {
        req.socket.destroy();
        return;
      }
      if (fault?.kind === "status") {
        res.writeHead(fault.status).end();
        return;
      }
      if (fault?.kind === "keepHalf" || fault?.kind === "cutMidPiece") {
        const half = body.subarray(0, Math.floor(body.length / 2));
        received.push(Buffer.from(half));
        have += half.length;
        if (fault.kind === "cutMidPiece") req.socket.destroy();
        else res.writeHead(308, range()).end();
        return;
      }
      received.push(Buffer.from(body));
      have += body.length;
      if (have === total) res.writeHead(201).end();
      else res.writeHead(308, range()).end();
    });
  });
  return {
    server,
    file: () => Buffer.concat(received),
    calls: () => pieceCalls,
    fired: () => faultsFired,
    listen: () =>
      new Promise<string>((r) =>
        server.listen(0, "127.0.0.1", () =>
          r(
            `http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`,
          ),
        ),
      ),
  };
}

const PIECE = CHUNK_MULTIPLE * 2; // 512 KB pieces keep the test fast
const sendWithFetch =
  (url: string) =>
  async (
    bytes: Uint8Array,
    headers: Record<string, string>,
  ): Promise<ChunkResponse> => {
    try {
      const r = await fetch(url, {
        method: "PUT",
        headers,
        body: Buffer.from(bytes) as unknown as BodyInit,
      });
      return { status: r.status, range: r.headers.get("range") };
    } catch {
      return { status: null };
    }
  };

async function upload(
  source: Buffer,
  faults: Map<number, Fault[]>,
  maxAttempts?: number,
) {
  const mux = fakeMux(source.length, faults);
  const url = await mux.listen();
  const seen: number[] = [];
  try {
    await runResumableUpload({
      total: source.length,
      readChunk: async (start, length) =>
        new Uint8Array(source.subarray(start, start + length)),
      sendChunk: sendWithFetch(url),
      contentType: "video/mp4",
      onProgress: (p) => seen.push(p.percent),
      sleep: async () => {},
      chunkSize: PIECE,
      maxAttempts,
    });
    return { file: mux.file(), calls: mux.calls(), fired: mux.fired(), seen };
  } finally {
    mux.server.close();
  }
}

test("clean upload arrives byte for byte", async () => {
  const src = randomBytes(PIECE * 6 + 12345);
  const r = await upload(src, new Map());
  assert.ok(r.file.equals(src));
  assert.equal(r.calls, 7);
  assert.equal(r.seen.at(-1), 100);
});

test("a dropped connection, a 503 and a 504 only cost the piece in flight", async () => {
  const src = randomBytes(PIECE * 5 + 777);
  const r = await upload(
    src,
    new Map<number, Fault[]>([
      [1, [{ kind: "drop" }]],
      [3, [{ kind: "status", status: 503 }]],
      [5, [{ kind: "status", status: 504 }]],
    ]),
  );
  assert.ok(r.file.equals(src));
  assert.equal(r.fired, 3);
  assert.equal(r.calls, 6 + 3); // 6 pieces + 3 resends
});

test("server keeps half a piece (308 + short Range): carries on from there", async () => {
  const src = randomBytes(PIECE * 4 + 1);
  const r = await upload(
    src,
    new Map<number, Fault[]>([[2, [{ kind: "keepHalf" }]]]),
  );
  assert.ok(r.file.equals(src));
  assert.equal(r.fired, 1);
  // Pieces 1 and 2, half of 3, then the rest from mid piece 3: 2.5P to 3.5P, 3.5P to the end.
  assert.equal(r.calls, 5);
});

test("connection cut mid piece: server tells where it stopped, upload carries on", async () => {
  const src = randomBytes(PIECE * 4 + 99);
  const r = await upload(
    src,
    new Map<number, Fault[]>([[1, [{ kind: "cutMidPiece" }]]]),
  );
  assert.ok(r.file.equals(src));
  assert.equal(r.fired, 1);
  // Piece 1, cut piece 2, its resend (answered 308 + Range 1.5P), then 3 pieces from 1.5P.
  assert.equal(r.calls, 6);
});

test("a refused piece (400) stops with a clear error", async () => {
  const src = randomBytes(PIECE * 3);
  await assert.rejects(
    upload(
      src,
      new Map<number, Fault[]>([[1, [{ kind: "status", status: 400 }]]]),
    ),
    (e: unknown) => e instanceof ResumableUploadError && e.status === 400,
  );
});

test("no answer at all gives up after the last try", async () => {
  const src = randomBytes(PIECE * 2);
  const drops = Array.from({ length: 20 }, () => ({ kind: "drop" }) as Fault);
  await assert.rejects(
    upload(src, new Map<number, Fault[]>(drops.map((d, i) => [i, [d]])), 4),
    (e: unknown) =>
      e instanceof ResumableUploadError &&
      /lost its connection/.test(e.message),
  );
});

test("waits for the app to come back before sending", async () => {
  const src = randomBytes(PIECE * 2 + 5);
  const mux = fakeMux(src.length, new Map());
  const url = await mux.listen();
  let waits = 0;
  try {
    await runResumableUpload({
      total: src.length,
      readChunk: async (s, l) => new Uint8Array(src.subarray(s, s + l)),
      sendChunk: sendWithFetch(url),
      contentType: "video/mp4",
      waitUntilActive: async () => {
        waits++;
      },
      sleep: async () => {},
      chunkSize: PIECE,
    });
  } finally {
    mux.server.close();
  }
  assert.ok(mux.file().equals(src));
  assert.equal(waits, 3); // once before each piece
});

test("rejects an empty file and a piece size that isn't a multiple of 256 KB", async () => {
  const base = {
    readChunk: async () => new Uint8Array(),
    sendChunk: async () => ({ status: 201 }),
    contentType: "video/mp4",
  };
  await assert.rejects(
    runResumableUpload({ ...base, total: 0 }),
    ResumableUploadError,
  );
  await assert.rejects(
    runResumableUpload({ ...base, total: 10, chunkSize: 1000 }),
    ResumableUploadError,
  );
});
