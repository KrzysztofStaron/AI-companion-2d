"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import LiquidGlass from "../components/ui/LiquidGlass";
import { chatWithAI } from "../actions/chat";
import { generateStablePipeline } from "../actions/generateStablePipeline";
import { splitSpritesheet, useFrameExtractor } from "../pre-processing/split";
import Image from "next/image";

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
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputBorderRadius, setInputBorderRadius] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(40);

  // Character generation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generateState, setGenerateState] = useState<GenerateState>({});
  const [isPending, startTransition] = useTransition();
  const frameExtractor = useFrameExtractor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const hasMultipleLines = useMemo(() => textareaHeight > 50, [textareaHeight]);

  function calculateBorderRadius() {
    if (!textareaRef.current) return 50;
    const currentHeight = textareaRef.current.scrollHeight;
    const twoLineHeight = 60;
    const baseRadius = 50;
    const minRadius = 12;
    if (currentHeight <= twoLineHeight) return baseRadius;
    return minRadius;
  }

  useEffect(() => {
    setInputBorderRadius(calculateBorderRadius());
  }, [inputValue]);

  // Animation function for head shaking
  const animateHead = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let startTime = Date.now();
    const duration = 2000; // 2 seconds
    const amplitude = 3; // -10 to +10 pixels

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Smooth easing function (ease-in-out)
      const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
      const easedProgress = easeInOut(progress);

      // Calculate shake offset
      const shakeX = Math.sin(elapsed * 0.01) * amplitude * (1 - easedProgress);
      const shakeY = Math.cos(elapsed * 0.008) * amplitude * (1 - easedProgress);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw body (no animation)
      if (bodyImg.current?.complete) {
        ctx.drawImage(bodyImg.current, 0, 0, 300, 300);
      }

      // Draw head group with shake animation
      if (headImg.current?.complete) {
        ctx.save();
        ctx.translate(shakeX, shakeY + 3);
        ctx.drawImage(headImg.current, 0, 0, 300, 300);
        ctx.restore();
      }

      if (eyesImg.current?.complete) {
        ctx.save();
        ctx.translate(shakeX, shakeY + 3);
        ctx.drawImage(eyesImg.current, 0, 0, 300, 300);
        ctx.restore();
      }

      // Alternate between mouth1 and mouth2 for talking animation
      const mouthFrame = Math.floor(elapsed / 200) % 2; // Switch every 200ms
      const currentMouth = mouthFrame === 0 ? mouthImg1.current : mouthImg2.current;

      if (currentMouth?.complete) {
        ctx.save();
        ctx.translate(shakeX, shakeY + 3);
        ctx.drawImage(currentMouth, 0, 0, 300, 300);
        ctx.restore();
      }

      if (hairImg.current?.complete) {
        ctx.save();
        ctx.translate(shakeX, shakeY + 3);
        ctx.drawImage(hairImg.current, 0, 0, 300, 300);
        ctx.restore();
      }

      // Draw 2 dots with same size as line stroke
      ctx.save();
      ctx.translate(shakeX, shakeY + 3);
      ctx.fillStyle = "#000000";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 5; // Same as SVG stroke width

      // First dot
      ctx.beginPath();
      ctx.arc(130, 140, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      // Second dot
      ctx.beginPath();
      ctx.arc(170, 140, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.restore();

      // Continue animation if not finished
      if (elapsed < duration) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  };

  // Store image references for animation
  const bodyImg = useRef<HTMLImageElement | null>(null);
  const headImg = useRef<HTMLImageElement | null>(null);
  const eyesImg = useRef<HTMLImageElement | null>(null);
  const mouthImg1 = useRef<HTMLImageElement | null>(null);
  const mouthImg2 = useRef<HTMLImageElement | null>(null);
  const hairImg = useRef<HTMLImageElement | null>(null);

  // Draw character on canvas using SVG elements
  useEffect(() => {
    if (generateState.baseImageUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size
      canvas.width = 300;
      canvas.height = 300;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Group 1: Body (just body)
      const bodyImgElement = document.createElement("img") as HTMLImageElement;
      bodyImgElement.onload = () => {
        bodyImg.current = bodyImgElement;
        ctx.drawImage(bodyImgElement, 0, 0, 300, 300);

        // Group 2: Head (head + eyes + mouth + hair)
        const headImgElement = document.createElement("img") as HTMLImageElement;
        headImgElement.onload = () => {
          headImg.current = headImgElement;
          ctx.drawImage(headImgElement, 0, 0, 300, 300);

          const eyesImgElement = document.createElement("img") as HTMLImageElement;
          eyesImgElement.onload = () => {
            eyesImg.current = eyesImgElement;
            ctx.drawImage(eyesImgElement, 0, 0, 300, 300);

            const mouthImg1Element = document.createElement("img") as HTMLImageElement;
            mouthImg1Element.onload = () => {
              mouthImg1.current = mouthImg1Element;
              ctx.drawImage(mouthImg1Element, 0, 0, 300, 300);

              const mouthImg2Element = document.createElement("img") as HTMLImageElement;
              mouthImg2Element.onload = () => {
                mouthImg2.current = mouthImg2Element;

                const hairImgElement = document.createElement("img") as HTMLImageElement;
                hairImgElement.onload = () => {
                  hairImg.current = hairImgElement;
                  ctx.drawImage(hairImgElement, 0, 0, 300, 300);

                  // Start head shaking animation
                  setTimeout(() => {
                    animateHead();
                  }, 500); // Start after 500ms
                };
                hairImgElement.src = "/hair.svg";
              };
              mouthImg2Element.src = "/mouth2.png";
            };
            mouthImg1Element.src = "/mouth1.svg";
          };
          eyesImgElement.src = "/eyes.svg";
        };
        headImgElement.src = "/head.svg";
      };
      bodyImgElement.src = "/body.svg";
    }
  }, [generateState.baseImageUrl]);

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

  const handleSubmit = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userMessage: ChatMessage = { role: "user", content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = "2.5rem";
      setTextareaHeight(50);
    }

    setIsLoading(true);
    try {
      const result = await chatWithAI([...messages, userMessage]);
      if (result.error) {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${result.error}` }]);
      } else {
        const reply: ChatMessage = { role: "assistant", content: result.content || "No response" };
        setMessages(prev => [...prev, reply]);
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
            {generateState.baseImageUrl && (
              <div className="relative">
                <div className="character-display">
                  <canvas
                    ref={canvasRef}
                    width={300}
                    height={300}
                    className="mx-auto border border-white/20 rounded-lg"
                  />
                  <div className="text-xs text-white/50 text-center mt-4">Character Generated</div>
                </div>
              </div>
            )}
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
          <div className="p-4 border-t border-white/10">
            <LiquidGlass
              borderRadius={inputBorderRadius}
              blur={0.6}
              contrast={0.6}
              brightness={0.9}
              saturation={0.9}
              shadowIntensity={0.1}
              justifyContent="start"
            >
              <div className={`flex w-full pl-4 pr-2 py-2 ${hasMultipleLines ? "items-end" : "items-center"}`}>
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  placeholder={isLoading ? "Thinking…" : "Type a message"}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  disabled={isLoading || !generateState.baseImageUrl}
                  spellCheck={false}
                  rows={1}
                  className="flex-1 min-w-0 py-2 pr-2 bg-transparent border-none outline-none text-white placeholder-white/60 text-sm disabled:opacity-50 resize-none overflow-y-auto min-h-[2rem] max-h-24 scrollbar-hide"
                  style={{
                    height: "auto",
                    minHeight: "2rem",
                    borderRadius: `${inputBorderRadius}px`,
                    paddingRight:
                      textareaRef.current && textareaRef.current.scrollHeight > textareaRef.current.clientHeight
                        ? "16px"
                        : "8px",
                  }}
                  onInput={e => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = target.scrollHeight + "px";
                    setTextareaHeight(target.scrollHeight);
                    setInputBorderRadius(calculateBorderRadius());
                    target.style.paddingRight = target.scrollHeight > target.clientHeight ? "16px" : "8px";
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !inputValue.trim() || !generateState.baseImageUrl}
                  className={`${hasMultipleLines ? "p-2" : "p-2"} m-0 shrink-0 transition-all duration-200 ${
                    isLoading || !inputValue.trim() || !generateState.baseImageUrl
                      ? "bg-transparent opacity-30 cursor-not-allowed"
                      : "bg-white/20 backdrop-blur-sm opacity-80 hover:opacity-100 hover:scale-105"
                  } rounded-xl text-white`}
                  style={{ borderRadius: `${inputBorderRadius}px` }}
                  title="Send"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white m-auto"
                  >
                    <path d="M22 2L11 13" />
                    <path d="m22 2-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </LiquidGlass>
          </div>
        </div>
      </div>
    </div>
  );
}
