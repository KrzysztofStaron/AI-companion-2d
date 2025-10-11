"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LiquidGlass from "./ui/LiquidGlass";

type ChatInputProps = {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
};

export default function ChatInput({ onSubmit, isLoading, disabled = false }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [inputBorderRadius, setInputBorderRadius] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(40);

  const hasMultipleLines = useMemo(() => textareaHeight > 50, [textareaHeight]);

  function calculateBorderRadius() {
    if (!textareaRef.current) return 50;
    const currentHeight = textareaRef.current.scrollHeight;
    const twoLineHeight = 52;
    const baseRadius = 50;
    const minRadius = 12;
    if (currentHeight <= twoLineHeight) return baseRadius;
    return minRadius;
  }

  useEffect(() => {
    setInputBorderRadius(calculateBorderRadius());
  }, [inputValue]);

  const handleSubmit = () => {
    if (!inputValue.trim() || isLoading || disabled) return;
    onSubmit(inputValue.trim());
    setInputValue("");
  };

  return (
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
            disabled={isLoading || disabled}
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
            disabled={isLoading || !inputValue.trim() || disabled}
            className={`${hasMultipleLines ? "p-2" : "p-2"} m-0 shrink-0 transition-all duration-200 ${
              isLoading || !inputValue.trim() || disabled
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
  );
}
