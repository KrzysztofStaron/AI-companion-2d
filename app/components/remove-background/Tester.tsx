"use client";

import { useMemo, useState } from "react";
import { removeBackgroud, type RemoveBackgroudOptions } from "@/app/pre-processing/removeBackgroud";

const DEFAULT_TOLERANCE = 5;

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(2)} ${units[exponent]}`;
};

export function RemoveBackgroundTester() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [alpha, setAlpha] = useState<number | undefined>(undefined);
  const [rgb, setRgb] = useState<[number, number, number] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const sourceInfo = useMemo(() => {
    if (!sourceFile) return null;
    return `${sourceFile.name} — ${formatSize(sourceFile.size)}`;
  }, [sourceFile]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSourceFile(file ?? null);
    if (file) {
      const url = URL.createObjectURL(file);
      setInputUrl(url);
      setOutputUrl(null);
      setError(null);
    } else {
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      setInputUrl(null);
      setOutputUrl(null);
    }
  };

  const handleRemove = async () => {
    if (!sourceFile && !inputUrl) {
      setError("Select an image first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let colorOverride: RemoveBackgroudOptions["backgroundColor"] | undefined;
      if (rgb) {
        colorOverride = [rgb[0], rgb[1], rgb[2], alpha ?? 255];
      } else if (alpha !== undefined) {
        colorOverride = [255, 255, 255, alpha];
      }

      const result = await removeBackgroud(sourceFile ?? (inputUrl as string), {
        tolerancePercent: tolerance,
        backgroundColor: colorOverride,
      });

      setOutputUrl(result);
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : "Could not remove background");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToleranceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (Number.isFinite(next)) {
      setTolerance(Math.max(0, Math.min(next, 30)));
    }
  };

  const handleRgbChange = (index: 0 | 1 | 2) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (nextValue === "") {
      const newRgb: [number, number, number] | undefined = rgb?.slice() as [number, number, number];
      if (newRgb) {
        newRgb[index] = 255;
        setRgb([...newRgb] as [number, number, number]);
      } else {
        setRgb(undefined);
      }
      return;
    }

    const numeric = Number(nextValue);
    if (Number.isFinite(numeric)) {
      const clamped = Math.max(0, Math.min(255, Math.round(numeric)));
      const base: [number, number, number] = rgb ?? [255, 255, 255];
      base[index] = clamped;
      setRgb([...base] as [number, number, number]);
    }
  };

  const handleAlphaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value === "" ? undefined : Number(event.target.value);
    if (next === undefined) {
      setAlpha(undefined);
      return;
    }

    if (Number.isFinite(next)) {
      setAlpha(Math.max(0, Math.min(255, Math.round(next))));
    }
  };

  const resetOverrides = () => {
    setRgb(undefined);
    setAlpha(undefined);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Remove Background Tester</h2>
        <p className="text-sm text-gray-600">
          Upload an AI-generated image with a white backdrop, adjust tolerance, and compare the before / after.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="remove-background-file" className="block text-sm font-medium text-gray-800">
              Image Source
            </label>
            <input
              id="remove-background-file"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring focus:ring-blue-200"
            />
            {sourceInfo && <p className="text-xs text-gray-500">{sourceInfo}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-800" htmlFor="tolerance">
              Bucket Tolerance (% of max color distance)
            </label>
            <input
              id="tolerance"
              type="range"
              min={0}
              max={30}
              value={tolerance}
              onChange={handleToleranceChange}
              className="w-full"
            />
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>0%</span>
              <input
                type="number"
                value={tolerance}
                min={0}
                max={30}
                onChange={handleToleranceChange}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-600 focus:outline-none focus:ring focus:ring-blue-200"
              />
              <span>30%</span>
            </div>
          </div>

          <fieldset className="space-y-2 rounded border border-gray-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Background Override
            </legend>

            <div className="grid grid-cols-3 gap-2">
              {(["R", "G", "B"] as const).map((label, idx) => (
                <div key={label} className="space-y-1 text-xs">
                  <label htmlFor={`rgb-${label}`} className="block text-gray-700">
                    {label}
                  </label>
                  <input
                    id={`rgb-${label}`}
                    type="number"
                    min={0}
                    max={255}
                    value={rgb ? rgb[idx] : ""}
                    placeholder="255"
                    onChange={handleRgbChange(idx)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-600 focus:outline-none focus:ring focus:ring-blue-200"
                  />
                </div>
              ))}
              <div className="space-y-1 text-xs">
                <label htmlFor="rgba-alpha" className="block text-gray-700">
                  Alpha
                </label>
                <input
                  id="rgba-alpha"
                  type="number"
                  min={0}
                  max={255}
                  value={alpha ?? ""}
                  placeholder="255"
                  onChange={handleAlphaChange}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-600 focus:outline-none focus:ring focus:ring-blue-200"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={resetOverrides}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Reset Overrides
            </button>
          </fieldset>

          <button
            type="button"
            onClick={handleRemove}
            disabled={isProcessing || (!sourceFile && !inputUrl)}
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isProcessing ? "Processing…" : "Remove Background"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="grid gap-4">
          <div className="rounded border border-dashed border-gray-300 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700">Original</h3>
            {inputUrl ? (
              <img src={inputUrl} alt="Original upload" className="mt-2 w-full rounded object-contain" />
            ) : (
              <p className="mt-2 text-sm text-gray-500">Select an image to preview it here.</p>
            )}
          </div>

          <div className="rounded border border-dashed border-gray-300 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700">Result</h3>
            {outputUrl ? (
              <img src={outputUrl} alt="Background removed" className="mt-2 w-full rounded object-contain" />
            ) : (
              <p className="mt-2 text-sm text-gray-500">Run the removal to see the transparent output.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
