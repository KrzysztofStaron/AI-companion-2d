"use client";

export type RemoveBackgroudOptions = {
  tolerancePercent?: number;
  backgroundColor?: [number, number, number, number];
};

const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = error => reject(error);
    img.src = src;
  });
};

const sampleBackgroundColor = (
  imageData: ImageData,
  override: RemoveBackgroudOptions["backgroundColor"]
): [number, number, number, number] => {
  if (override) {
    return override;
  }

  const { data, width, height } = imageData;
  if (width === 0 || height === 0) {
    return [255, 255, 255, 255];
  }

  type Bucket = {
    count: number;
    sumR: number;
    sumG: number;
    sumB: number;
    sumA: number;
  };

  const quantize = (value: number, step: number) => Math.floor(value / step);
  const buckets = new Map<string, Bucket>();

  const registerPixel = (index: number) => {
    if (index < 0 || index + 3 >= data.length) {
      return;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    const key = `${quantize(r, 16)}-${quantize(g, 16)}-${quantize(b, 16)}-${quantize(a, 32)}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.count += 1;
      bucket.sumR += r;
      bucket.sumG += g;
      bucket.sumB += b;
      bucket.sumA += a;
    } else {
      buckets.set(key, {
        count: 1,
        sumR: r,
        sumG: g,
        sumB: b,
        sumA: a,
      });
    }
  };

  const registerCoordinate = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    registerPixel((y * width + x) * 4);
  };

  for (let x = 0; x < width; x++) {
    registerCoordinate(x, 0);
    registerCoordinate(x, Math.min(1, height - 1));
    registerCoordinate(x, height - 1);
    registerCoordinate(x, Math.max(height - 2, 0));
  }

  for (let y = 0; y < height; y++) {
    registerCoordinate(0, y);
    registerCoordinate(Math.min(1, width - 1), y);
    registerCoordinate(width - 1, y);
    registerCoordinate(Math.max(width - 2, 0), y);
  }

  if (buckets.size === 0) {
    return [255, 255, 255, 255];
  }

  let dominantBucket: Bucket | null = null;

  for (const bucket of buckets.values()) {
    if (!dominantBucket || bucket.count > dominantBucket.count) {
      dominantBucket = bucket;
    }
  }

  if (!dominantBucket) {
    return [255, 255, 255, 255];
  }

  const { count, sumR, sumG, sumB, sumA } = dominantBucket;
  return [Math.round(sumR / count), Math.round(sumG / count), Math.round(sumB / count), Math.round(sumA / count)];
};

const withinTolerance = (
  data: Uint8ClampedArray,
  index: number,
  backgroundColor: [number, number, number, number],
  toleranceThreshold: number
) => {
  const dr = data[index] - backgroundColor[0];
  const dg = data[index + 1] - backgroundColor[1];
  const db = data[index + 2] - backgroundColor[2];
  const da = data[index + 3] - backgroundColor[3];
  const distanceSquared = dr * dr + dg * dg + db * db + da * da;
  return distanceSquared <= toleranceThreshold;
};

export async function removeBackgroud(input: string | Blob, options: RemoveBackgroudOptions = {}): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("removeBackgroud requires a browser environment");
  }

  const { tolerancePercent = 5, backgroundColor } = options;
  const clampedTolerance = clamp(tolerancePercent, 0, 100) / 100;

  const objectUrl = typeof input === "string" ? null : URL.createObjectURL(input);
  const source = typeof input === "string" ? input : objectUrl!;
  const image = await loadImage(source);

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is not available");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  const background = sampleBackgroundColor(imageData, backgroundColor);
  const { data, width, height } = imageData;
  const maxDistanceSq = 4 * 255 * 255;
  const toleranceThreshold = maxDistanceSq * clampedTolerance * clampedTolerance;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const neighborOffsets: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  const pushPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    const dataIndex = pixelIndex * 4;
    if (withinTolerance(data, dataIndex, background, toleranceThreshold)) {
      queue.push(dataIndex);
      visited[pixelIndex] = 1;
    }
  };

  for (let x = 0; x < width; x++) {
    pushPixel(x, 0);
    pushPixel(x, height - 1);
  }

  for (let y = 1; y < height - 1; y++) {
    pushPixel(0, y);
    pushPixel(width - 1, y);
  }

  while (queue.length) {
    const current = queue.pop()!;
    data[current + 3] = 0;

    const pixelIndex = current / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    for (const [dx, dy] of neighborOffsets) {
      pushPixel(x + dx, y + dy);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
