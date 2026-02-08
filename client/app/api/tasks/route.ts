import { NextResponse } from "next/server";
import { fetchFromBackend } from "@/lib/backend";

export async function GET() {
  try {
    const response = await fetchFromBackend("/api/tasks", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }
    return NextResponse.json({ tasks: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tasks backend unavailable.";
    return NextResponse.json({ tasks: [], error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetchFromBackend("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tasks backend unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
