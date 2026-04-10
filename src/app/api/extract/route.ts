import { NextResponse } from "next/server";
import { extractClaims } from "@/lib/extractor";

type ExtractRequestBody = {
  text?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractRequestBody;

    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json({ error: "'text' is required" }, { status: 400 });
    }

    const claims = await extractClaims(body.text);
    return NextResponse.json({ claims });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
