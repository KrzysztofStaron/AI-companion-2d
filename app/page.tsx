"use client";

import Image from "next/image";
import { useState, useTransition, useEffect, useRef } from "react";
import { generateSouthParkCharacter } from "./actions/generateSouthParkCharacter";
import { generateTalkingFrames } from "./actions/generateTalkingFrames";
import { splitSpritesheet } from "./pre-processing/split";

type GenerateState = {
  result?: string;
  error?: string;
  message?: string;
  status?: number;
};

const initialState: GenerateState = {};

export default function Home() {
  const [state, setState] = useState<GenerateState>(initialState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [spriteFrames, setSpriteFrames] = useState<string[]>([]);
  const [talkingFrames, setTalkingFrames] = useState<string[]>([]);
  const [isGeneratingTalking, startGeneratingTalking] = useTransition();
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(500); // milliseconds
  const animationRef = useRef<NodeJS.Timeout | number | undefined>(undefined);
  const currentFrameRef = useRef(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setState(initialState);
    setSpriteFrames([]);
    setTalkingFrames([]);
    setIsAnimating(false);
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
  };

  const startAnimation = () => {
    if (talkingFrames.length === 0 || isAnimating) return;

    setIsAnimating(true);
    currentFrameRef.current = 0;

    const animate = () => {
      if (!isAnimating) return;

      currentFrameRef.current = (currentFrameRef.current + 1) % talkingFrames.length;
      animationRef.current = setTimeout(animate, animationSpeed);
    };

    animate();
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
    currentFrameRef.current = 0;
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  const handleGenerate = () => {
    if (!selectedFile) {
      setState({ error: "missing-image", message: "Select an image to continue." });
      return;
    }

    startTransition(async () => {
      try {
        const imageBuffer = await selectedFile.arrayBuffer();
        const result = await generateSouthParkCharacter({
          image: imageBuffer,
          mimeType: selectedFile.type,
        });
        setState(result);

        // Automatically split the returned image when ready
        if (result.result) {
          try {
            const frames = await splitSpritesheet(result.result, 2, 2);
            setSpriteFrames(frames);

            // Generate talking frames using the first frame
            if (frames.length > 0) {
              startGeneratingTalking(async () => {
                try {
                  const talkingResult = await generateTalkingFrames({
                    firstFrame: frames[0],
                  });

                  if (talkingResult.result) {
                    const talkingSpriteFrames = await splitSpritesheet(talkingResult.result, 2, 1);
                    setTalkingFrames(talkingSpriteFrames);
                  }
                } catch (talkingError) {
                  console.error("Failed to generate talking frames:", talkingError);
                }
              });
            }
          } catch (splitError) {
            console.error("Failed to split sprite sheet:", splitError);
          }
        }
      } catch (error) {
        setState({
          error: "client-error",
          message: error instanceof Error ? error.message : "Something went wrong while generating the character.",
        });
      }
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">South Park Character Generator</h1>

      <div className="mb-8 space-y-6">
        <div>
          <label htmlFor="image" className="block text-sm font-medium mb-2 text-gray-800">
            Upload Image
          </label>
          <input
            type="file"
            id="image"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full rounded border border-gray-300 bg-white p-4 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending || !selectedFile}
          className="w-full rounded bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {isPending ? "Generating..." : "Generate South Park Character"}
        </button>
      </div>

      <div id="result" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Result</h2>
          {state.result && (
            <a
              href={state.result}
              download="south-park-character.png"
              className="inline-flex items-center rounded border border-green-600 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-600 hover:text-white"
            >
              Download
            </a>
          )}
        </div>

        <div className="flex min-h-[240px] items-center justify-center rounded border border-dashed border-gray-300 bg-white p-6">
          {state.result ? (
            <div className="text-center">
              <Image
                src={state.result}
                alt="Generated South Park character"
                width={320}
                height={320}
                className="mx-auto rounded shadow-sm"
                unoptimized
              />
            </div>
          ) : state.error ? (
            <div className="text-center text-sm text-red-600">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-1 text-xs text-red-500">{state.message ?? "Please try again."}</p>
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500">
              Upload an image and click generate to see the transformation.
            </div>
          )}
        </div>
      </div>

      {spriteFrames.length > 0 && (
        <div id="sprite-frames" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Sprite Frames</h2>
            <p className="text-sm text-gray-600">Total frames: {spriteFrames.length} | Displaying first frame</p>
          </div>

          <div className="flex min-h-[240px] items-center justify-center rounded border border-dashed border-gray-300 bg-white p-6">
            <div className="text-center">
              <Image
                src={spriteFrames[0]}
                alt="First sprite frame"
                width={120}
                height={120}
                className="mx-auto rounded shadow-sm"
                unoptimized
              />
              <p className="mt-2 text-sm text-gray-600">First Frame</p>
            </div>
          </div>
        </div>
      )}

      {talkingFrames.length > 0 && (
        <div id="talking-animation" className="space-y-4">
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
                  value={animationSpeed}
                  onChange={e => setAnimationSpeed(Number(e.target.value))}
                  className="w-20"
                  disabled={isAnimating}
                />
                <span className="text-sm text-gray-600 min-w-[3rem]">{animationSpeed}ms</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startAnimation}
                  disabled={isAnimating || talkingFrames.length === 0}
                  className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400"
                >
                  Play
                </button>
                <button
                  type="button"
                  onClick={stopAnimation}
                  disabled={!isAnimating}
                  className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-gray-400"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-[240px] items-center justify-center rounded border border-dashed border-gray-300 bg-white p-6">
            <div className="text-center">
              <div className="relative">
                <Image
                  src={talkingFrames[currentFrameRef.current]}
                  alt={`Talking frame ${currentFrameRef.current + 1}`}
                  width={120}
                  height={120}
                  className="mx-auto rounded shadow-sm"
                  unoptimized
                />
                {isAnimating && <div className="absolute inset-0 rounded bg-blue-500 opacity-20 animate-pulse"></div>}
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Frame {currentFrameRef.current + 1} of {talkingFrames.length}
                {isAnimating && " (Animating)"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {talkingFrames.map((frame, index) => (
              <div key={index} className="text-center">
                <Image
                  src={frame}
                  alt={`Talking frame ${index + 1}`}
                  width={80}
                  height={80}
                  className={`mx-auto rounded shadow-sm ${
                    index === currentFrameRef.current && isAnimating ? "ring-2 ring-blue-500" : ""
                  }`}
                  unoptimized
                />
                <p className="mt-1 text-xs text-gray-500">Frame {index + 1}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
