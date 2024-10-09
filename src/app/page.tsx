"use client";
import { useState, useRef } from "react";
import Image from "next/image";

export default function Home() {
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const handlePlayAudio = async () => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

    const audioContent = atob(data.audioContent);
    const audioArray = new Uint8Array(audioContent.length);
    for (let i = 0; i < audioContent.length; i++) {
      audioArray[i] = audioContent.charCodeAt(i);
    }

    const audioBlob = new Blob([audioArray], { type: "audio/mp3" });
    const audioUrl = URL.createObjectURL(audioBlob);
    setAudioUrl(audioUrl);
  };

  const handleGenerateRandomText = async () => {
    const response = await fetch("/api/gpt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Generate a random paragraph." }),
    });

    const data = await response.json();
    setText(data.choices[0].message.content);
  };

  const handleRecordAudio = async () => {
    if (isRecording) {
      setIsRecording(false);
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        const audioChunks: Blob[] = [];
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks);

          const formData = new FormData();
          formData.append("audio", audioBlob, "audio.webm");

          const response = await fetch("/api/asr", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();
          setText(data.text);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Image
          className="w-40 h-auto"
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
          <div className="flex gap-4">
            <button
              className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
              onClick={handlePlayAudio}
            >
              Play Audio
            </button>
            <button
              className="rounded-full border border-solid border-foreground transition-colors flex items-center justify-center bg-transparent text-foreground gap-2 hover:bg-[#f0f0f0] dark:hover:bg-[#333] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
              onClick={handleGenerateRandomText}
            >
              Generate Random Text
            </button>
            <button
              className={`rounded-full border border-solid border-foreground transition-colors flex items-center justify-center bg-transparent text-foreground gap-2 hover:bg-[#f0f0f0] dark:hover:bg-[#333] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 ${
                isRecording ? "bg-red-500 text-white" : ""
              }`}
              onClick={handleRecordAudio}
            >
              {isRecording ? "Stop Recording" : "Record Audio"}
            </button>
          </div>
          {audioUrl && (
            <audio controls src={audioUrl} className="mt-4" autoPlay>
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      </main>
    </div>
  );
}
