import { NextResponse } from "next/server";
import { keeperLog } from "@/lib/keeper-log";

// Public — no auth required. Returns recent keeper execution history.
export async function GET() {
  const entries = keeperLog.getRecent(50);
  const stats   = keeperLog.stats();
  return NextResponse.json({ entries, stats });
}
