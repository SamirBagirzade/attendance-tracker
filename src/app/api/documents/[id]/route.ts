import { NextRequest } from "next/server";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UPLOAD_DIR = join(process.cwd(), "uploads", "documents");

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id: parseInt(id, 10) } });
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });

  try {
    const buffer = await readFile(join(UPLOAD_DIR, doc.storedName));
    const encoded = encodeURIComponent(doc.filename);
    return new Response(buffer, {
      headers: {
        "Content-Type": doc.mimetype,
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return Response.json({ error: "File not found on disk." }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id: parseInt(id, 10) } });
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });

  try { await unlink(join(UPLOAD_DIR, doc.storedName)); } catch { /* already gone */ }
  await prisma.document.delete({ where: { id: doc.id } });

  return new Response(null, { status: 204 });
}
