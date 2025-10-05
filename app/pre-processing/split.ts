import { useRef, useCallback } from "react";

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadBase64Reference(path: string, cache: Map<string, string>): Promise<string | null> {
  if (cache.has(path)) {
    return cache.get(path)!;
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      console.warn(`Failed to load reference image: ${path}`);
      return null;
    }

    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise(resolve => {
      reader.onload = () => {
        const result = reader.result as string;
        cache.set(path, result);
        resolve(result);
      };
      reader.onerror = () => {
        console.warn(`Failed to read reference image: ${path}`);
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Error loading reference image ${path}:`, error);
    return null;
  }
}

// Enhanced frame extractor with caching and easy access
export class FrameExtractor {
  private cache = new Map<string, string[]>();
  private imageCache = new Map<string, HTMLImageElement>();

  async extractFrames(
    spritesheet: string | HTMLImageElement,
    cols: number,
    rows: number,
    cacheKey?: string
  ): Promise<string[]> {
    if (typeof window === "undefined") {
      throw new Error("FrameExtractor can only be run in a browser environment.");
    }

    const key = cacheKey || (typeof spritesheet === "string" ? spritesheet : "inline-image");

    // Return cached frames if available
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const image = typeof spritesheet === "string" ? await this.loadImage(spritesheet) : spritesheet;

    const frameWidth = Math.floor(image.width / cols);
    const frameHeight = Math.floor(image.height / rows);
    const frames: string[] = [];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        ctx.clearRect(0, 0, frameWidth, frameHeight);
        ctx.drawImage(
          image,
          col * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight,
          0,
          0,
          frameWidth,
          frameHeight
        );
        frames.push(canvas.toDataURL("image/png"));
      }
    }

    // Cache the result
    this.cache.set(key, frames);
    return frames;
  }

  private async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Get a specific frame by index
  getFrame(spritesheet: string, frameIndex: number): string | null {
    const frames = this.cache.get(spritesheet);
    return frames ? frames[frameIndex] || null : null;
  }

  // Get all frames for a spritesheet
  getAllFrames(spritesheet: string): string[] | null {
    return this.cache.get(spritesheet) || null;
  }

  // Clear cache for a specific spritesheet or all cache
  clearCache(spritesheet?: string): void {
    if (spritesheet) {
      this.cache.delete(spritesheet);
    } else {
      this.cache.clear();
    }
  }

  // Get cache size for debugging
  getCacheSize(): number {
    return this.cache.size;
  }
}

// Legacy function for backward compatibility
export async function splitSpritesheet(
  spritesheet: string | HTMLImageElement,
  cols: number,
  rows: number
): Promise<string[]> {
  const extractor = new FrameExtractor();
  return extractor.extractFrames(spritesheet, cols, rows);
}

// React hook for easy frame extraction
export function useFrameExtractor() {
  const extractorRef = useRef(new FrameExtractor());

  const extractFrames = useCallback(
    async (
      spritesheet: string | HTMLImageElement,
      cols: number,
      rows: number,
      cacheKey?: string
    ): Promise<string[]> => {
      return extractorRef.current.extractFrames(spritesheet, cols, rows, cacheKey);
    },
    []
  );

  const getFrame = useCallback((spritesheet: string, frameIndex: number): string | null => {
    return extractorRef.current.getFrame(spritesheet, frameIndex);
  }, []);

  const getAllFrames = useCallback((spritesheet: string): string[] | null => {
    return extractorRef.current.getAllFrames(spritesheet);
  }, []);

  const clearCache = useCallback((spritesheet?: string) => {
    extractorRef.current.clearCache(spritesheet);
  }, []);

  return {
    extractFrames,
    getFrame,
    getAllFrames,
    clearCache,
    cacheSize: extractorRef.current.getCacheSize(),
  };
}
