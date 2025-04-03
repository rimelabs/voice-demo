import { NextResponse } from "next/server";

type Voice = {
  name: string;
  model_id: string;
  gender: string;
  age: string;
  country: string;
  region: string;
  demographic: string;
  genre: string[];
  language: string;
};

async function handler() {
  const response = await fetch("https://users.rime.ai/data/voices/voice_details.json", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.RIME_API_KEY}`,
    },
  });

  const voiceDetails = await response.json();

  // Sort voices to prioritize mistv2 before mist
  const sortedVoices = voiceDetails.sort((a: Voice, b: Voice) => {
    if (a.model_id === "mistv2" && b.model_id === "mist") return -1;
    if (a.model_id === "mist" && b.model_id === "mistv2") return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    voices: sortedVoices,
  });
}

export async function GET() {
  return handler();
}

export async function POST() {
  return handler();
}
