"use client";

import { useState, useTransition } from "react";
import LiquidGlass from "../components/ui/LiquidGlass";
import ChatInput from "../components/ChatInput";
import CharacterRenderer from "../components/CharacterRenderer";
import { chatWithAI } from "../actions/chat";
import { generateStablePipeline } from "../actions/generateStablePipeline";

type ChatMessage = { role: "user" | "assistant"; content: string };

type GenerateState = {
  baseImageUrl?: string;
  talkingAnimationUrl?: string;
  error?: string;
  message?: string;
  status?: number;
};

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Character generation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generateState, setGenerateState] = useState<GenerateState>({});
  const [isPending, startTransition] = useTransition();

  // TTS function using OpenAI API
  const generateTTS = async (text: string) => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("TTS generation failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element and play
      const audio = new Audio(audioUrl);

      // Start talking animation while audio plays
      if ((window as any).startTalkingAnimation) {
        (window as any).startTalkingAnimation();
      }

      audio.play();

      // Stop talking animation when audio ends
      audio.onended = () => {
        if ((window as any).stopTalkingAnimation) {
          (window as any).stopTalkingAnimation();
        }
      };
    } catch (error) {
      console.error("TTS error:", error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setGenerateState({});
  };

  const handleGenerateCharacter = () => {
    if (!selectedFile) {
      setGenerateState({ error: "missing-image", message: "Select an image to continue." });
      return;
    }

    startTransition(async () => {
      try {
        const imageBuffer = await selectedFile.arrayBuffer();
        const result = await generateStablePipeline({
          image: imageBuffer,
          mimeType: selectedFile.type,
          seed: Date.now(),
        });

        if (result.error) {
          setGenerateState(result);
        } else {
          setGenerateState(result);
        }
      } catch (error) {
        setGenerateState({
          error: "client-error",
          message: error instanceof Error ? error.message : "Something went wrong while generating the character.",
        });
      }
    });
  };

  const handleSubmit = async (message: string) => {
    if (!message.trim() || isLoading) return;
    const userMessage: ChatMessage = { role: "user", content: message.trim() };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);
    try {
      const result = await chatWithAI([...messages, userMessage]);
      if (result.error) {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${result.error}` }]);
      } else {
        const reply: ChatMessage = { role: "assistant", content: result.content || "No response" };
        setMessages(prev => [...prev, reply]);

        // Generate TTS for AI response
        if (result.content) {
          generateTTS(result.content);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background: grayscale radial + subtle vignette, no blue-purple gradients */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.06),transparent_45%),linear-gradient(to_bottom,#0a0a0a,#111111)]" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: "inset 0 0 200px rgba(0,0,0,0.6)" }}
        />
        {/* Liquid caustics gloss lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#9ca3af" />
            </linearGradient>
          </defs>
          <g stroke="url(#g)" strokeWidth="0.6" fill="none">
            <path d="M-50 100 C 200 0, 400 200, 650 100" />
            <path d="M-80 300 C 120 180, 420 360, 780 260" />
            <path d="M-40 520 C 220 420, 420 640, 760 560" />
          </g>
        </svg>
      </div>

      <div className="flex h-screen">
        {/* Main Character Canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative">
            {/* Character Upload/Generation Area */}
            {!generateState.baseImageUrl && (
              <LiquidGlass
                borderRadius={24}
                blur={0.8}
                contrast={0.7}
                brightness={0.95}
                saturation={0.95}
                shadowIntensity={0.15}
              >
                <div className="p-8 text-center max-w-md">
                  <h2 className="text-xl font-light text-white/90 mb-4">Create Your Character</h2>
                  <p className="text-white/60 text-sm mb-6">Upload an image to generate a South Park-style character</p>

                  <div className="space-y-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full text-white/80 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/20 file:text-white hover:file:bg-white/30"
                    />

                    <button
                      onClick={() => setGenerateState({ baseImageUrl: "bypassed" })}
                      className="w-full py-3 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-lg text-white transition-all duration-200 font-medium"
                    >
                      Skip Generation (Instant Test)
                    </button>
                  </div>

                  {generateState.error && (
                    <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-300 text-sm">{generateState.message}</p>
                    </div>
                  )}
                </div>
              </LiquidGlass>
            )}

            {/* Character Display */}
            {generateState.baseImageUrl && <CharacterRenderer baseImageUrl={generateState.baseImageUrl} />}
          </div>
        </div>

        {/* Side Chat Panel */}
        <div className="w-96 border-l border-white/10 flex flex-col">
          <div className="p-6 border-b border-white/10">
            <h1 className="text-lg font-light text-white/90">AI Chat</h1>
            <p className="text-white/50 text-xs mt-1">Chat with your character</p>
          </div>

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-white/50 text-sm text-center py-8">
                {generateState.baseImageUrl
                  ? "Start chatting with your character!"
                  : "Generate a character first to start chatting"}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`${
                    m.role === "user" ? "bg-white/20" : "bg-white/10"
                  } text-white/90 rounded-2xl px-3 py-2 max-w-[85%] backdrop-blur-sm border border-white/15 text-sm`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input area */}
          <ChatInput onSubmit={handleSubmit} isLoading={isLoading} disabled={!generateState.baseImageUrl} />
        </div>
      </div>
    </div>
  );
}
