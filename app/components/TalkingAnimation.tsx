"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

interface TalkingAnimationProps {
  frames: string[];
  animSpeed: number;
  currentFrame: number;
  onFrameChange: (frame: number) => void;
}

export function TalkingAnimation({ frames, animSpeed, currentFrame, onFrameChange }: TalkingAnimationProps) {
  const animationRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPlaying = frames.length > 0;

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        const nextFrame = (currentFrame + 1) % frames.length;
        onFrameChange(nextFrame);
        animationRef.current = setTimeout(animate, animSpeed);
      };

      animate();
    } else {
      if (animationRef.current !== undefined) {
        clearTimeout(animationRef.current);
        animationRef.current = undefined;
      }
    }

    return () => {
      if (animationRef.current !== undefined) {
        clearTimeout(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [isPlaying, animSpeed, frames.length, onFrameChange]);

  if (frames.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Talking Animation</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="animation-speed" className="text-sm text-gray-600">
              Speed:
            </label>
            <input
              id="animation-speed"
              type="range"
              min="100"
              max="1000"
              step="50"
              value={animSpeed}
              className="w-20"
              readOnly
            />
            <span className="text-sm text-gray-600 min-w-[3rem]">{animSpeed}ms</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-[240px] items-center justify-center rounded border border-dashed border-gray-300 bg-white p-6">
        <div className="text-center">
          <div className="relative">
            <Image
              src={frames[currentFrame]}
              alt={`Talking frame ${currentFrame + 1}`}
              width={120}
              height={120}
              className="mx-auto rounded shadow-sm"
              unoptimized
            />
            {isPlaying && <div className="absolute inset-0 rounded bg-blue-500 opacity-20 animate-pulse"></div>}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Frame {currentFrame + 1} of {frames.length}
            {isPlaying && " (Animating)"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {frames.map((frame, index) => (
          <div key={index} className="text-center">
            <Image
              src={frame}
              alt={`Talking frame ${index + 1}`}
              width={80}
              height={80}
              className={`mx-auto rounded shadow-sm ${
                index === currentFrame && isPlaying ? "ring-2 ring-blue-500" : ""
              }`}
              unoptimized
            />
            <p className="mt-1 text-xs text-gray-500">Frame {index + 1}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
