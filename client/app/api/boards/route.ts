import { NextResponse } from "next/server";
import { fetchFromBackend } from "@/lib/backend";

export async function GET() {
  try {
    const response = await fetchFromBackend("/api/boards", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }
    return NextResponse.json({ boards: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Boards backend unavailable.";
    return NextResponse.json({ boards: [], error: message }, { status: 502 });
  }
}
