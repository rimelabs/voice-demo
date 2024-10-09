"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Mic, Send, Play, Pause } from "lucide-react";

type Message = {
  text: string;
  isUser: boolean;
  audioUrl?: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    setMessages((prev) => [...prev, { text, isUser: true }]);
    setInputText("");

    const response = await fetch("/api/gpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    const botResponse =
      data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "I'm sorry, I couldn't generate a response.";

    const ttsResponse = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: botResponse }),
    });

    const ttsData = await ttsResponse.json();
    const audioContent = atob(ttsData.audioContent);
    const audioArray = new Uint8Array(audioContent.length);
    for (let i = 0; i < audioContent.length; i++) {
      audioArray[i] = audioContent.charCodeAt(i);
    }

    const audioBlob = new Blob([audioArray], { type: "audio/mp3" });
    const audioUrl = URL.createObjectURL(audioBlob);

    setMessages((prev) => [
      ...prev,
      { text: botResponse, isUser: false, audioUrl },
    ]);

    setCurrentAudioUrl(audioUrl);

    // Play the audio automatically
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
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
          handleSendMessage(data.text);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current && currentAudioUrl) {
      if (audioRef.current.paused) {
        audioRef.current.src = currentAudioUrl;
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      <header className="flex items-center gap-1 p-4 bg-black text-white border-b border-white">
        <Image
          className="w-20 h-auto mt-1"
          src="https://rime.ai/_nuxt/RimeSpeechTech_Logo.2582e20f.svg"
          alt="Rime logo"
          width={90}
          height={19}
          priority
        />
        <span className="text-2xl font-black">chat</span>
      </header>
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-black"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.isUser ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                message.isUser
                  ? "bg-blue-500 text-white"
                  : "bg-gray-800 text-white"
              }`}
            >
              <span>{message.text}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-black text-white border-t border-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 rounded border border-gray-300 bg-gray-800 text-white"
          />
          <button
            onClick={handleRecordAudio}
            className={`p-2 rounded-full ${
              isRecording ? "bg-red-500 text-white" : "bg-gray-700 text-white"
            }`}
          >
            <Mic size={20} />
          </button>
          <button
            onClick={handlePlayPause}
            className={`p-2 rounded-full ${
              currentAudioUrl ? "bg-gray-700" : "bg-gray-500 cursor-not-allowed"
            } text-white`}
            disabled={!currentAudioUrl}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => handleSendMessage(inputText)}
            className="p-2 rounded-full bg-blue-500 text-white"
            disabled={!inputText.trim()}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}
