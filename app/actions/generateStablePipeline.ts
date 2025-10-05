"use server";

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { generateSouthParkCharacter } from "./generateSouthParkCharacter";
import { generateTalkingFrames } from "./generateTalkingFrames";

const MODEL_ID = "google/gemini-2.5-flash-image-preview"; // alias: nano banana

interface StablePipelineRequest {
  image: ArrayBuffer;
  mimeType?: string;
  seed?: number;
}

interface StablePipelineResult {
  baseImageUrl?: string;
  talkingAnimationUrl?: string;
  baseFilePath?: string;
  talkingAnimationFilePath?: string;
  error?: string;
  message?: string;
  status?: number;
}

// Helper function to download image from URL and return as Buffer
async function downloadImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Helper function to save image buffer to file and return public URL
async function saveImageToFile(
  imageBuffer: Buffer,
  filename: string
): Promise<{ filePath: string; publicUrl: string }> {
  const publicDir = join(process.cwd(), "public");
  const filePath = join(publicDir, filename);

  // Ensure public directory exists
  await mkdir(publicDir, { recursive: true });

  // Save the file
  await writeFile(filePath, imageBuffer);

  // Return file path and public URL
  return {
    filePath,
    publicUrl: `/${filename}`,
  };
}

// Helper function to apply consistency fix to talking frames
async function applyConsistencyFix(talkingFramesUrl: string, baseFrameUrl: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  // Download both images
  const [talkingFramesBuffer, baseFrameBuffer] = await Promise.all([
    downloadImage(talkingFramesUrl),
    downloadImage(baseFrameUrl),
  ]);

  // Convert to data URLs
  const talkingFramesDataUrl = `data:image/png;base64,${talkingFramesBuffer.toString("base64")}`;
  const baseFrameDataUrl = `data:image/png;base64,${baseFrameBuffer.toString("base64")}`;

  const requestBody = {
    model: MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "fix character consistency between frames - make sure the character looks exactly the same in all frames except for the mouth movements. Fix any inconsistencies in pose, clothing, colors, or proportions between the frames.",
          },
          {
            type: "image_url",
            image_url: {
              url: talkingFramesDataUrl,
            },
          },
          {
            type: "image_url",
            image_url: {
              url: baseFrameDataUrl,
            },
          },
        ],
      },
    ],
    response_format: {
      type: "image",
    },
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
      "X-Title": process.env.OPENROUTER_SITE_NAME ?? "South Park Consistency Fix",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Consistency fix failed: ${response.status} ${message}`);
  }

  const result = (await response.json().catch(() => null)) as unknown;

  // Extract image URL from response (similar to existing function)
  function extractImageUrl(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const { choices } = payload as { choices?: Array<{ message?: any }> };
    if (!Array.isArray(choices)) {
      return null;
    }

    for (const choice of choices) {
      const images = choice.message?.images;
      if (Array.isArray(images)) {
        for (const image of images) {
          const urlCandidate = image?.image_url?.url;
          if (typeof urlCandidate === "string" && urlCandidate.length > 0) {
            return urlCandidate;
          }
        }
      }

      const content = choice.message?.content;
      if (Array.isArray(content)) {
        for (const segment of content) {
          const urlCandidate = segment?.image_url?.url;
          if (typeof urlCandidate === "string" && urlCandidate.length > 0) {
            return urlCandidate;
          }

          if (typeof segment?.text === "string" && segment.text.includes("data:image")) {
            const match = segment.text.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/);
            if (match && match[0]) {
              return match[0];
            }
          }
        }
      }

      if (typeof content === "string" && content.includes("data:image")) {
        const match = content.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/);
        if (match && match[0]) {
          return match[0];
        }
      }
    }

    return null;
  }

  const fixedImageUrl = extractImageUrl(result);

  if (!fixedImageUrl) {
    throw new Error("No image returned from consistency fix");
  }

  return fixedImageUrl;
}

export async function generateStablePipeline(payload: StablePipelineRequest): Promise<StablePipelineResult> {
  if (!payload || !(payload.image instanceof ArrayBuffer) || payload.image.byteLength === 0) {
    return { error: "missing-image", message: "Select an image to continue." };
  }

  try {
    console.log("🚀 Starting stable pipeline...");

    // Step 1: Generate base South Park character
    console.log("📝 Step 1: Generating base South Park character...");
    const baseCharacterResult = await generateSouthParkCharacter({
      image: payload.image,
      mimeType: payload.mimeType,
    });

    if (baseCharacterResult.error || !baseCharacterResult.result) {
      return {
        error: baseCharacterResult.error || "base-generation-failed",
        message: baseCharacterResult.message || "Failed to generate base character",
        status: baseCharacterResult.status,
      };
    }

    // Step 2: Download and save base image
    console.log("💾 Step 2: Saving base image...");
    const baseImageBuffer = await downloadImage(baseCharacterResult.result);
    const { filePath: baseFilePath, publicUrl: baseImageUrl } = await saveImageToFile(baseImageBuffer, "base.png");
    console.log(`✅ Base image saved to: ${baseFilePath}`);

    // Step 3: Generate talking frames (using the first frame of the sprite sheet as reference)
    console.log("🗣️ Step 3: Generating talking frames...");
    const talkingFramesResult = await generateTalkingFrames({
      firstFrame: baseCharacterResult.result,
      seed: payload.seed,
    });

    if (talkingFramesResult.error || !talkingFramesResult.result) {
      return {
        error: talkingFramesResult.error || "talking-generation-failed",
        message: talkingFramesResult.message || "Failed to generate talking frames",
        status: talkingFramesResult.status,
        baseImageUrl,
        baseFilePath,
      };
    }

    // Step 4: Apply consistency fix
    console.log("🔧 Step 4: Applying consistency fix...");
    const fixedTalkingFramesUrl = await applyConsistencyFix(talkingFramesResult.result, baseCharacterResult.result);
    console.log("✅ Consistency fix applied");

    // Step 5: Download and save talking animation
    console.log("💾 Step 5: Saving talking animation...");
    const talkingAnimationBuffer = await downloadImage(fixedTalkingFramesUrl);
    const { filePath: talkingAnimationFilePath, publicUrl: talkingAnimationUrl } = await saveImageToFile(
      talkingAnimationBuffer,
      "talkingAnimation.png"
    );
    console.log(`✅ Talking animation saved to: ${talkingAnimationFilePath}`);

    console.log("🎉 Pipeline completed successfully!");

    return {
      baseImageUrl,
      talkingAnimationUrl,
      baseFilePath,
      talkingAnimationFilePath,
    };
  } catch (error) {
    console.error("Pipeline error:", error);
    return {
      error: "pipeline-error",
      message: error instanceof Error ? error.message : "Unknown error occurred during pipeline execution",
    };
  }
}
