"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { generateSouthParkCharacter } from "./actions/generateSouthParkCharacter";

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setState(initialState);
  };

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
    </div>
  );
}
