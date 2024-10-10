import { NextRequest, NextResponse } from "next/server";

async function handler(request: NextRequest) {
  const { text, speaker } = await request.json();

  const response = await fetch("https://users.rime.ai/v1/rime-tts", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.RIME_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      speaker: speaker || "lagoon",
      text: text,
      modelId: "mist",
      samplingRate: 22050,
      speedAlpha: 1.0,
      audioFormat: "mp3",
      reduceLatency: false,
    }),
  });

  const data = await response.json();

  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
