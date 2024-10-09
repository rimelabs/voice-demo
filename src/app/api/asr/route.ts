import { NextRequest, NextResponse } from "next/server";

async function handler(request: NextRequest) {
  const formData = await request.formData();
  const audioBlob = formData.get("audio") as Blob;

  if (!audioBlob) {
    return NextResponse.json(
      { error: "No audio file provided" },
      { status: 400 }
    );
  }

  // Convert the blob to an MP3 file
  const arrayBuffer = await audioBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const mp3Blob = new Blob([uint8Array], { type: "audio/mp3" });

  const audioFormData = new FormData();
  audioFormData.append("file", mp3Blob, "audio.mp3");
  audioFormData.append("model", "whisper-1");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: audioFormData,
    }
  );

  const data = await response.json();

  return NextResponse.json(data);
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
