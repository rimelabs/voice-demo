import { NextResponse } from "next/server";

type Voice = {
  name: string;
  gender: string;
  age: string;
  country: string;
  region: string;
  demographic: string;
  genre: string[];
};

async function handler() {
  const [allVoicesResponse, voiceDetailsResponse] = await Promise.all([
    fetch("https://users.rime.ai/data/voices/all.json", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.RIME_API_KEY}`,
      },
    }),
    fetch("https://users.rime.ai/data/voices/voice_details.json", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.RIME_API_KEY}`,
      },
    }),
  ]);

  const allVoices = await allVoicesResponse.json();
  const voiceDetails = await voiceDetailsResponse.json();

  const mistVoices = allVoices.mist || [];
  const mistVoicesWithDetails = mistVoices
    .map((speakerId: string) => {
      const details = voiceDetails.find(
        (voice: Voice) => voice.name.toLowerCase() === speakerId.toLowerCase()
      );
      return {
        speaker_id: speakerId,
        name: details?.name || speakerId,
        gender: details?.gender || "",
        age: details?.age || "",
        country: details?.country || "",
        region: details?.region || "",
        demographic: details?.demographic || "",
        genre: details?.genre || [],
      };
    })
    // Alphabetically sort by name
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    voices: mistVoicesWithDetails,
  });
}

export async function GET() {
  return handler();
}

export async function POST() {
  return handler();
}
