import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

// Uvek se izvrsava na zahtev — health check ne sme da bude kesiran.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch (error) {
    console.error("[health] konekcija ka bazi nije uspela:", error);
    return NextResponse.json({ status: "error", db: "down" }, { status: 503 });
  }
}
