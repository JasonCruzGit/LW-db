import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database unreachable";
    return NextResponse.json({ ok: false, db: false, error: msg }, { status: 503 });
  }
}

