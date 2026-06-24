import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const UPLOAD_DIR = join(process.cwd(), "uploads", "documents");

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  const name = (formData.get("name") as string | null)?.trim();
  const file = formData.get("file") as File | null;
  const carId = formData.get("carId") ? parseInt(formData.get("carId") as string, 10) : null;
  const employeeId = formData.get("employeeId") ? parseInt(formData.get("employeeId") as string, 10) : null;

  if (!name) return Response.json({ error: "name required." }, { status: 400 });
  if (!file) return Response.json({ error: "file required." }, { status: 400 });
  if (!carId && !employeeId) return Response.json({ error: "carId or employeeId required." }, { status: 400 });
  if (file.size > MAX_SIZE) return Response.json({ error: "File too large (max 10 MB)." }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = extname(file.name) || "";
  const storedName = `${randomUUID()}${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, storedName), buffer);

  const doc = await prisma.document.create({
    data: {
      name,
      filename: file.name,
      mimetype: file.type || "application/octet-stream",
      size: buffer.length,
      storedName,
      carId,
      employeeId,
    },
  });

  return Response.json({ document: doc });
}
