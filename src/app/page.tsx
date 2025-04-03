"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Mic,
  MicOff,
  Send,
  Play,
  Pause,
  Loader,
  X,
  Trash2,
  Settings,
  Pencil,
  Check,
  Keyboard,
} from "lucide-react";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isEditingVoice, setIsEditingVoice] = useState(false);
  const [editingVoiceName, setEditingVoiceName] = useState("");
  const [voices, setVoices] = useState<
    Array<{
      name: string;
      model_id: string;
      gender: string;
      age: string;
      country: string;
      region: string;
      demographic: string;
      genre: string[];
    }>
  >([]);
  const [selectedVoice, setSelectedVoice] = useState("lagoon");
  const [selectedModelId, setSelectedModelId] = useState("mist");
  const [searchTerm, setSearchTerm] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch("/api/voices");
        const data = await response.json();
        setVoices(data.voices);
      } catch (error) {
        console.error("Error fetching voices:", error);
      }
    };

    fetchVoices();
  }, []);

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

        const response = await fetch("/api/llm", {
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
          body: JSON.stringify({ 
            text: botResponse, 
            speaker: selectedVoice,
            modelId: selectedModelId
          }),
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
    [messages, selectedVoice, voices, selectedModelId]
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
        if (!audioRef.current.src) {
          audioRef.current.src = currentAudioUrl;
        }
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [currentAudioUrl]);

  const handleClearChat = useCallback(() => {
    // Stop any ongoing processes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    // Clear all states
    setMessages([]);
    setInputText("");
    setIsRecording(false);
    setIsPlaying(false);
    setCurrentAudioUrl(null);
    setIsLoading(false);
    setIsCancelling(false);

    // Clear audio
    if (audioRef.current) {
      audioRef.current.src = "";
    }
  }, [isRecording]);

  const handleSettingsClick = useCallback(() => {
    setIsHelpOpen(false);
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const handleHelpClick = useCallback(() => {
    setIsSettingsOpen(false);
    setIsHelpOpen((prev) => !prev);
  }, []);

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
      } else if (e.key === "Escape") {
        // Escape for cancelling message
        if (isLoading) {
          handleCancelMessage();
        }
        // Escape for restarting audio
        if (isPlaying) {
          handlePlayPause();
        }
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
        // Escape for closing menu
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
        }
        if (isHelpOpen) {
          setIsHelpOpen(false);
        }
      } else if (e.ctrlKey) {
        if (e.key === "d") {
          e.preventDefault();
          handleClearChat();
        } else if (e.key === "k") {
          e.preventDefault();
          handleHelpClick();
        } else if (e.key === "s") {
          e.preventDefault();
          handleSettingsClick();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handlePlayPause,
    handleRecordAudio,
    handleSendMessage,
    handleCancelMessage,
    handleClearChat,
    handleHelpClick,
    handleSettingsClick,
    inputText,
    isLoading,
    isPlaying,
    isSettingsOpen,
    isHelpOpen,
  ]);

  const handleCloseSettings = useCallback(() => {
    setSearchTerm("");
    setIsSettingsOpen(false);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-black">
      <header className="flex items-center justify-between p-4 bg-black text-white border-b border-white">
        <div className="flex items-center">
          <Image
            className="h-8 w-auto mt-1"
            src="/rime-logo.svg"
            alt="Rime logo"
            width={120}
            height={38}
            priority
          />
          <span className="text-[29px] font-extrabold -mt-[2px]">.chat</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors duration-200"
            title="Clear Chat (^+D)"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={handleHelpClick}
            className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors duration-200"
            title="Keyboard Shortcuts (^+K)"
          >
            <Keyboard size={20} />
          </button>
          <button
            onClick={handleSettingsClick}
            className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors duration-200"
            title="Settings (^+S)"
          >
            <Settings size={20} />
          </button>
        </div>
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
                ? "bg-red-500 hover:bg-red-400 transition-colors duration-200"
                : !isLoading
                ? "bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
                : "bg-gray-500 cursor-not-allowed"
            } text-white`}
            disabled={isLoading}
            title="Record (⌘+Enter)"
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={handlePlayPause}
            className={`p-2 rounded-full ${
              currentAudioUrl && !isLoading && !isRecording
                ? "bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
                : "bg-gray-500 cursor-not-allowed"
            } text-white`}
            disabled={!currentAudioUrl || isLoading || isRecording}
            title={isPlaying ? "Pause (⌥+Enter)" : "Play (⌥+Enter)"}
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
                  ? "bg-red-500 hover:bg-red-400 transition-colors duration-200"
                  : "bg-blue-500 hover:bg-blue-400 transition-colors duration-200"
                : isRecording || inputText.trim()
                ? "bg-blue-500 hover:bg-blue-400 transition-colors duration-200"
                : "bg-gray-500 cursor-not-allowed"
            } text-white`}
            disabled={!inputText.trim() && !isLoading && !isRecording}
            onMouseEnter={() => isLoading && setIsCancelling(true)}
            onMouseLeave={() => isLoading && setIsCancelling(false)}
            title={isCancelling ? "Abort (Esc)" : "Send (Enter)"}
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
      {isSettingsOpen && (
        <div
          className="fixed inset-0 bg-white bg-opacity-70 flex items-center justify-center z-50"
          onClick={handleCloseSettings}
        >
          <div
            className="w-5/6 md:w-3/6 h-4/6 bg-black border border-white rounded-lg p-6 relative overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseSettings}
              className="absolute top-2 right-2 text-white hover:text-gray-300"
            >
              <X size={20} />
            </button>
            <h2 className="text-white text-xl mb-4">Settings</h2>
            <div className="text-white">
              <h3 className="text-lg mb-2 flex items-center">
                Selected Voice:
                {isEditingVoice ? (
                  <>
                    <input
                      type="text"
                      value={editingVoiceName}
                      onChange={(e) => setEditingVoiceName(e.target.value)}
                      className="ml-2 p-1 bg-gray-700 text-white rounded"
                    />
                    <button
                      onClick={() => {
                        setSelectedVoice(editingVoiceName);
                        setIsEditingVoice(false);
                      }}
                      className="ml-2 text-white hover:text-gray-300"
                    >
                      <Check size={20} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="ml-2">{selectedVoice}</span>
                    <button
                      onClick={() => {
                        setIsEditingVoice(true);
                        setEditingVoiceName(selectedVoice);
                      }}
                      className="ml-2 text-white hover:text-gray-300"
                    >
                      <Pencil size={20} />
                    </button>
                  </>
                )}
              </h3>
              <input
                type="text"
                placeholder="Search voices..."
                className="w-full p-2 my-4 bg-gray-700 text-white rounded"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <ul className="max-h-96 overflow-y-auto">
                {voices
                  .filter((voice) => {
                    if (!searchTerm.trim()) return true;
                    const searchTerms =
                      searchTerm.match(/("[^"]*"|\S+)/g) || [];
                    return searchTerms.every((term) => {
                      const cleanTerm = term
                        .replace(/^"|"$/g, "")
                        .toLowerCase();
                      const isQuoted =
                        term.startsWith('"') && term.endsWith('"');
                      const matchWord = (str: string) =>
                        isQuoted
                          ? str.toLowerCase() === cleanTerm
                          : str.toLowerCase().includes(cleanTerm);
                      return (
                        matchWord(voice.name) ||
                        matchWord(voice.model_id) ||
                        matchWord(voice.gender) ||
                        matchWord(voice.age) ||
                        matchWord(voice.country) ||
                        matchWord(voice.region) ||
                        matchWord(voice.demographic) ||
                        voice.genre.some(matchWord)
                      );
                    });
                  })
                  .sort((a, b) => {
                    // Prioritize mistv2 before mist
                    if (a.model_id === "mistv2" && b.model_id === "mist") return -1;
                    if (a.model_id === "mist" && b.model_id === "mistv2") return 1;
                    // Then sort alphabetically by name
                    return a.name.localeCompare(b.name);
                  })
                  .map((voice) => (
                    <li
                      key={`${voice.name}-${voice.model_id}`}
                      className={`border-y border-gray-700 p-2 transition-colors duration-200 ${
                        selectedVoice === voice.name && selectedModelId === voice.model_id
                          ? "bg-blue-500"
                          : "hover:bg-gray-700"
                      } ${
                        // Only apply cursor-pointer on small screens
                        "md:cursor-default cursor-pointer"
                      }`}
                      onClick={() => {
                        // Only allow click on small screens
                        if (window.innerWidth < 768) {
                          setSelectedVoice(voice.name);
                          setSelectedModelId(voice.model_id);
                          handleCloseSettings();
                        }
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p>
                            <strong>Name:</strong> {voice.name}
                          </p>
                          <p>
                            <strong>Model ID:</strong> {voice.model_id}
                          </p>
                          <p>
                            <strong>Gender:</strong> {voice.gender}
                          </p>
                          <p>
                            <strong>Age:</strong> {voice.age}
                          </p>
                          <p>
                            <strong>Country:</strong> {voice.country}
                          </p>
                          <p>
                            <strong>Region:</strong> {voice.region}
                          </p>
                          <p>
                            <strong>Demographic:</strong> {voice.demographic}
                          </p>
                          <p>
                            <strong>Genres:</strong> {voice.genre.join(", ")}
                          </p>
                        </div>
                        <button
                          className={`hidden md:block px-4 py-2 text-white rounded transition-colors duration-200 ${
                            selectedVoice === voice.name && selectedModelId === voice.model_id
                              ? "bg-blue-600"
                              : "bg-blue-500 hover:bg-blue-600"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVoice(voice.name);
                            setSelectedModelId(voice.model_id);
                            handleCloseSettings();
                          }}
                          disabled={selectedVoice === voice.name && selectedModelId === voice.model_id}
                        >
                          {selectedVoice === voice.name && selectedModelId === voice.model_id ? "Selected" : "Select"}
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {isHelpOpen && (
        <div
          className="fixed inset-0 bg-white bg-opacity-70 flex items-center justify-center z-50"
          onClick={handleCloseHelp}
        >
          <div
            className="w-5/6 md:w-3/6 bg-black border border-white rounded-lg p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseHelp}
              className="absolute top-2 right-2 text-white hover:text-gray-300"
            >
              <X size={20} />
            </button>
            <h2 className="text-white text-xl mb-4">Keyboard Shortcuts</h2>
            <ul className="text-white space-y-2">
              <li>
                <strong>Enter:</strong> Send message
              </li>
              <li>
                <strong>⌘ + Enter:</strong> Start/stop and send recording
              </li>
              <li>
                <strong>⌥ + Enter:</strong> Play/pause response audio
              </li>
              <li>
                <strong>⌃ + D:</strong> Clear chat
              </li>
              <li>
                <strong>⌃ + K:</strong> Toggle keyboard shortcuts
              </li>
              <li>
                <strong>⌃ + S:</strong> Toggle settings
              </li>
              <li>
                <strong>Escape:</strong> Cancel response, restart audio, or
                close menu
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
