"use client";

import Image from "next/image";
import { useState, useTransition, useEffect } from "react";
import { generateStablePipeline } from "./actions/generateStablePipeline";
import { splitSpritesheet, useFrameExtractor } from "./pre-processing/split";
import { TalkingAnimation } from "./components/TalkingAnimation";
import { Character } from "./components/Character";

type GenerateState = {
  baseImageUrl?: string;
  talkingAnimationUrl?: string;
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
  const [animationSpeed, setAnimationSpeed] = useState(500); // milliseconds
  const [currentFrame, setCurrentFrame] = useState(0);

  // Use the frame extractor hook for easy frame management
  const frameExtractor = useFrameExtractor();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setState(initialState);
    setSpriteFrames([]);
    setTalkingFrames([]);
    setCurrentFrame(0);
  };

  const handleGenerate = () => {
    if (!selectedFile) {
      setState({ error: "missing-image", message: "Select an image to continue." });
      return;
    }

    startTransition(async () => {
      try {
        const imageBuffer = await selectedFile.arrayBuffer();
        const result = await generateStablePipeline({
          image: imageBuffer,
          mimeType: selectedFile.type,
          seed: Date.now(), // Use timestamp as seed for consistent results
        });

        if (result.error) {
          setState(result);
        } else {
          setState(result);

          // Split the base image into sprite frames using the enhanced extractor
          if (result.baseImageUrl) {
            try {
              const frames = await frameExtractor.extractFrames(result.baseImageUrl, 2, 2, "base-sprite");
              setSpriteFrames(frames);
            } catch (splitError) {
              console.error("Failed to split base sprite sheet:", splitError);
            }
          }

          // Split the talking animation into frames using the enhanced extractor
          if (result.talkingAnimationUrl) {
            try {
              const talkingSpriteFrames = await frameExtractor.extractFrames(
                result.talkingAnimationUrl,
                3,
                1,
                "talking-animation"
              );
              setTalkingFrames(talkingSpriteFrames);
              setCurrentFrame(0);
            } catch (talkingSplitError) {
              console.error("Failed to split talking frames:", talkingSplitError);
            }
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
          {isPending ? "Generating Pipeline..." : "Generate Base + Talking Animation"}
        </button>
      </div>

      <div id="result" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Results</h2>
          {state.baseImageUrl && (
            <div className="flex gap-2">
              <a
                href={state.baseImageUrl}
                download="base.png"
                className="inline-flex items-center rounded border border-green-600 px-3 py-1 text-sm font-medium text-green-700 transition hover:bg-green-600 hover:text-white"
              >
                Download Base
              </a>
              {state.talkingAnimationUrl && (
                <a
                  href={state.talkingAnimationUrl}
                  download="talkingAnimation.png"
                  className="inline-flex items-center rounded border border-blue-600 px-3 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-600 hover:text-white"
                >
                  Download Animation
                </a>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base Character */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Base Character</h3>
            <div className="flex min-h-[240px] items-center justify-center rounded border border-dashed border-gray-300 bg-white p-6">
              {state.baseImageUrl ? (
                <div className="text-center">
                  <Image
                    src={state.baseImageUrl}
                    alt="Generated South Park character base"
                    width={200}
                    height={200}
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

          {/* Talking Animation */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Talking Animation</h3>
            <div className="flex min-h-[240px] items-center justify-center rounded border border-dashed border-gray-300 bg-white p-6">
              {state.talkingAnimationUrl ? (
                <div className="text-center">
                  <Image
                    src={state.talkingAnimationUrl}
                    alt="Generated talking animation frames"
                    width={300}
                    height={100}
                    className="mx-auto rounded shadow-sm"
                    unoptimized
                  />
                </div>
              ) : state.error ? (
                <div className="text-center text-sm text-red-600">
                  <p className="font-medium">Animation generation failed</p>
                  <p className="mt-1 text-xs text-red-500">{state.message ?? "Please try again."}</p>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500">
                  Talking animation will appear here after generation.
                </div>
              )}
            </div>
          </div>
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
        <TalkingAnimation
          frames={talkingFrames}
          animSpeed={animationSpeed}
          currentFrame={currentFrame}
          onFrameChange={setCurrentFrame}
        />
      )}

      {/* Enhanced Character Component with Animation Manager */}
      {spriteFrames.length > 0 && talkingFrames.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Enhanced Character Animation</h2>
            <p className="text-sm text-gray-600">
              Cache: {frameExtractor.cacheSize} | Frames: Base({spriteFrames.length}) Talking({talkingFrames.length})
            </p>
          </div>

          <div className="flex min-h-[300px] items-center justify-center rounded border border-dashed border-gray-300 bg-white p-6">
            {(() => {
              const characterComponent = Character({
                baseFrames: spriteFrames,
                talkingFrames: talkingFrames,
                initialAnimation: "idle",
                width: 250,
                height: 250,
                className: "enhanced-character-demo",
              });
              return characterComponent.render();
            })()}
          </div>

          <div className="text-sm text-gray-600">
            <p>
              <strong>Frame Extractor Features:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Caching: Frames are cached for performance</li>
              <li>Easy Access: Get individual frames by index</li>
              <li>Multiple Sprite Sheets: Handle different animation types</li>
              <li>React Hook: useFrameExtractor() for easy integration</li>
            </ul>
            <p className="mt-2">
              <strong>Character Manager Features:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Animation States: playing, paused, stopped</li>
              <li>Multiple Animations: idle, talking, walking, dancing</li>
              <li>Frame Control: playAnimation(), pauseAnimation(), etc.</li>
              <li>React Integration: Both component and hook versions</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
