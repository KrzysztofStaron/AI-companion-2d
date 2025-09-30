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

export async function splitSpritesheet(
  spritesheet: string | HTMLImageElement,
  cols: number,
  rows: number
): Promise<string[]> {
  if (typeof window === "undefined") {
    throw new Error("splitSpritesheet can only be run in a browser environment.");
  }

  const image = typeof spritesheet === "string" ? await loadImage(spritesheet) : spritesheet;

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
      ctx.drawImage(image, col * frameWidth, row * frameHeight, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
      frames.push(canvas.toDataURL("image/png"));
    }
  }

  return frames;
}
