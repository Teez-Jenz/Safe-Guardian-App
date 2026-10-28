import { NextResponse } from "next/server";
import { processOverdueCheckIns } from "@/lib/checkInWorker";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await processOverdueCheckIns();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("Check-in cron GET error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await processOverdueCheckIns();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("Check-in cron POST error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

