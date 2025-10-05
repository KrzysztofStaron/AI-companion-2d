"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LiquidGlass from "../components/ui/LiquidGlass";
import { chatWithAI } from "../actions/chat";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputBorderRadius, setInputBorderRadius] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(40);

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

  const handleSubmit = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userMessage: ChatMessage = { role: "user", content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
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

      <div className="mx-auto max-w-3xl px-4 pt-16 pb-36">
        <header className="mb-10">
          <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white/90">AI Companion</h1>
          <p className="mt-2 text-white/50 text-sm">Minimal liquid-glass chat. Grayscale, elegant, calm.</p>
        </header>

        {/* Messages feed in a subtle glass card */}
        <LiquidGlass
          borderRadius={18}
          blur={0.6}
          contrast={0.6}
          brightness={0.9}
          saturation={0.9}
          shadowIntensity={0.12}
        >
          <div className="w-full max-h-[55vh] overflow-y-auto p-4 md:p-6 space-y-3">
            {messages.length === 0 && <div className="text-white/50 text-sm">Say hello to begin.</div>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`${
                    m.role === "user" ? "bg-white/20" : "bg-white/10"
                  } text-white/90 rounded-2xl px-3 py-2 max-w-[80%] backdrop-blur-sm border border-white/15`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </LiquidGlass>
      </div>

      {/* Docked input glass */}
      <div className="fixed left-1/2 bottom-6 -translate-x-1/2 w-full max-w-xl px-4">
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
              disabled={isLoading}
              spellCheck={false}
              rows={1}
              className="flex-1 min-w-0 py-2 pr-2 bg-transparent border-none outline-none text-white placeholder-white/60 text-base disabled:opacity-50 resize-none overflow-y-auto min-h-[2.5rem] max-h-32 scrollbar-hide"
              style={{
                height: "auto",
                minHeight: "2.5rem",
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
              disabled={isLoading || !inputValue.trim()}
              className={`${hasMultipleLines ? "p-2" : "p-3"} m-0 shrink-0 transition-all duration-200 ${
                isLoading || !inputValue.trim()
                  ? "bg-transparent opacity-30 cursor-not-allowed"
                  : "bg-white/20 backdrop-blur-sm opacity-80 hover:opacity-100 hover:scale-105"
              } rounded-2xl text-white`}
              style={{ borderRadius: `${inputBorderRadius}px` }}
              title="Send"
            >
              <svg
                width={hasMultipleLines ? "14" : "18"}
                height={hasMultipleLines ? "14" : "18"}
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
  );
}
