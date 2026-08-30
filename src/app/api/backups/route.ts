import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { requireAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// pg_dump rejects Prisma's ?schema= query parameter, so strip the query string.
function pgDumpUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  return url.split("?")[0];
}

type StartResult =
  | { ok: true; firstChunk: Buffer }
  | { ok: false; message: string };

// Wait for either the first byte of output or an early exit, so a pg_dump that
// fails outright still produces a JSON 500 instead of a 200 with a broken file.
function waitForFirstChunk(
  child: ReturnType<typeof spawn>,
  readStderr: () => string,
): Promise<StartResult> {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (result: StartResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.stdout?.once("data", (chunk: Buffer) => {
      // Stop the flow immediately — the ReadableStream below resumes it once it
      // has somewhere to put the bytes, so nothing is dropped in between.
      child.stdout?.pause();
      settle({ ok: true, firstChunk: chunk });
    });

    child.once("error", (error: Error) => {
      settle({ ok: false, message: error.message });
    });

    child.once("close", (code) => {
      settle({
        ok: false,
        message: readStderr().trim() || `pg_dump exited with code ${code}`,
      });
    });
  });
}

// ADMIN-only: a dump contains every row in the database, password hashes included.
//
// This streams a real pg_dump rather than a hand-assembled JSON payload. The old
// format listed columns by hand, so it silently stopped matching the schema as
// columns were added — and restoring it discarded everything it had missed.
// Restoring is now a CLI procedure; see docs/restore.md.
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);

  if (denied) {
    return denied;
  }

  let url: string;

  try {
    url = pgDumpUrl();
  } catch (error) {
    console.error("[backup] Not configured:", error);
    return NextResponse.json({ error: "Server is not configured for backups." }, { status: 500 });
  }

  const child = spawn("pg_dump", [url, "-Fc", "--no-owner", "--no-privileges"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += String(chunk);
  });

  // Don't leave a dump running if the admin closes the tab mid-download.
  const abort = () => child.kill("SIGTERM");
  request.signal.addEventListener("abort", abort);

  const started = await waitForFirstChunk(child, () => stderr);

  if (!started.ok) {
    request.signal.removeEventListener("abort", abort);
    console.error("[backup] pg_dump failed:", started.message);
    return NextResponse.json({ error: "Could not create the backup. Check server logs." }, { status: 500 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(started.firstChunk));

      child.stdout?.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      child.once("close", (code) => {
        request.signal.removeEventListener("abort", abort);

        if (code === 0) {
          controller.close();
          return;
        }

        // Headers are already sent, so the only honest signal left is to break
        // the transfer. A truncated dump that looks complete is worse.
        console.error("[backup] pg_dump failed mid-stream:", stderr.trim());
        controller.error(new Error("pg_dump failed"));
      });

      child.stdout?.resume();
    },
    cancel() {
      child.kill("SIGTERM");
    },
  });

  const filename = `attendance-tracker-${format(new Date(), "yyyy-MM-dd-HHmm")}.dump`;
  void logAudit(request, "EXPORT", "Backup", null, { filename });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
