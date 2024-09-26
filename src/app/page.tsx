"use client";
import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const handlePlayAudio = async () => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
    audio.play();
    const audioBlob = new Blob([new Uint8Array(data.audioContent)], {
      type: "audio/mp3",
    });
    const audioUrl = URL.createObjectURL(audioBlob);
    setAudioUrl(audioUrl);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Image
          className="h-auto"
          src="https://rime.ai/_nuxt/RimeSpeechTech_Logo.2582e20f.svg"
          alt="Rime logo"
          width={180}
          height={38}
          priority
        />
        <div className="flex flex-col gap-4 items-center sm:items-start">
          <textarea
            className="border border-gray-300 text-black rounded p-2 w-full"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text here"
            rows={4}
          />
          <button
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            onClick={handlePlayAudio}
          >
            Play Audio
          </button>
          {audioUrl && (
            <audio controls src={audioUrl} className="mt-4">
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      </main>
    </div>
  );
}
