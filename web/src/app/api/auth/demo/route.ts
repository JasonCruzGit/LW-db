import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { signToken } from "@/lib/server/jwt";

export async function POST() {
  const email = (process.env.DEMO_EMAIL || "admin@church.local").toLowerCase();

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: "Demo Admin",
          role: "admin",
          passwordHash: await bcrypt.hash("password123", 10),
        },
      });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error("[api/auth/demo]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

