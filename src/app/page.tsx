"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Mic, MicOff, Send, Play, Pause, Loader, X } from "lucide-react";

type Message = {
  text: string;
  isUser: boolean;
  audioUrl?: string;
  isLoading?: boolean;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isLoading) {
      let dots = 1;
      intervalId = setInterval(() => {
        dots = (dots % 3) + 1;
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.isLoading) {
            lastMessage.text = ".".repeat(dots);
          }
          return newMessages;
        });
      }, 500);
    }
    return () => clearInterval(intervalId);
  }, [isLoading]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      setMessages((prev) => [
        ...prev,
        { text, isUser: true },
        { text: ".", isUser: false, isLoading: true },
      ]);
      setInputText("");
      setIsLoading(true);

      abortControllerRef.current = new AbortController();

      try {
        const conversationHistory = messages.map((message) => ({
          role: message.isUser ? "user" : "assistant",
          content: message.text,
        }));

        const response = await fetch("/api/gpt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            conversationHistory,
          }),
          signal: abortControllerRef.current.signal,
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
          signal: abortControllerRef.current.signal,
        });

        const ttsData = await ttsResponse.json();
        const audioContent = atob(ttsData.audioContent);
        const audioArray = new Uint8Array(audioContent.length);
        for (let i = 0; i < audioContent.length; i++) {
          audioArray[i] = audioContent.charCodeAt(i);
        }

        const audioBlob = new Blob([audioArray], { type: "audio/mp3" });
        const audioUrl = URL.createObjectURL(audioBlob);

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages.pop(); // Remove the loading message
          newMessages.push({ text: botResponse, isUser: false, audioUrl });
          return newMessages;
        });

        setCurrentAudioUrl(audioUrl);

        // Play the audio automatically
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          setMessages((prev) => prev.slice(0, -1)); // Remove the loading message
        } else {
          console.error("Error in handleSendMessage:", error);
        }
      } finally {
        setIsLoading(false);
        setIsCancelling(false);
        abortControllerRef.current = null;
      }
    },
    [messages]
  );

  const handleCancelMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsCancelling(false);
    setIsLoading(false);
  }, []);

  const handleRecordAudio = useCallback(async () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
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

          setIsLoading(true);
          const response = await fetch("/api/asr", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();
          await handleSendMessage(data.text);
          setIsLoading(false);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }
  }, [isRecording, handleSendMessage]);

  const handlePlayPause = useCallback(() => {
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
  }, [currentAudioUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (e.metaKey) {
          // Command + Enter for recording
          handleRecordAudio();
        } else if (e.altKey) {
          // Alt + Enter for play/pause
          handlePlayPause();
        } else if (!e.ctrlKey && !e.altKey && !e.shiftKey && inputText.trim()) {
          // Enter (without modifiers) for sending message
          handleSendMessage(inputText);
        }
      } else if (e.key === "Escape" && isLoading) {
        // Escape for cancelling message
        handleCancelMessage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handlePlayPause,
    handleRecordAudio,
    handleSendMessage,
    handleCancelMessage,
    inputText,
    isLoading,
  ]);

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
              isRecording
                ? "bg-red-500"
                : !isLoading
                ? "bg-gray-700"
                : "bg-gray-500 cursor-not-allowed"
            } text-white`}
            disabled={isLoading}
            title="Record (⌘+Return)"
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={handlePlayPause}
            className={`p-2 rounded-full ${
              currentAudioUrl && !isLoading && !isRecording
                ? "bg-gray-700"
                : "bg-gray-500 cursor-not-allowed"
            } text-white`}
            disabled={!currentAudioUrl || isLoading || isRecording}
            title={isPlaying ? "Pause (⌥+Return)" : "Play (⌥+Return)"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => {
              if (isRecording) {
                handleRecordAudio();
              } else if (isLoading) {
                handleCancelMessage();
              } else {
                handleSendMessage(inputText);
              }
            }}
            className={`p-2 rounded-full ${
              isLoading
                ? isCancelling
                  ? "bg-red-500"
                  : "bg-blue-500"
                : isRecording || inputText.trim()
                ? "bg-blue-500"
                : "bg-gray-500 cursor-not-allowed"
            } text-white`}
            disabled={!inputText.trim() && !isLoading && !isRecording}
            onMouseEnter={() => isLoading && setIsCancelling(true)}
            onMouseLeave={() => isLoading && setIsCancelling(false)}
            title={isCancelling ? "Abort (Esc)" : "Send (Return)"}
          >
            {isLoading ? (
              isCancelling ? (
                <X size={20} />
              ) : (
                <Loader size={20} className="animate-spin" />
              )
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}
