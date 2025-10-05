"use server";

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type GenerateRequest = {
  image: ArrayBuffer;
  mimeType?: string;
};

type OpenRouterImageChoice = {
  message?: {
    images?: Array<{
      type?: string;
      image_url?: {
        url?: string;
      };
    }>;
    content?:
      | string
      | Array<{
          type?: string;
          text?: string;
          image_url?: {
            url?: string;
          };
        }>;
  };
};

type OpenRouterTextChoice = {
  message?: {
    content?:
      | string
      | Array<{
          type?: string;
          text?: string;
        }>;
  };
};

const MODEL_ID = "google/gemini-2.5-flash-image-preview";

const SPRITE_REFERENCE_PATH = join(process.cwd(), "base", "sprite.png");
const SPRITE2_REFERENCE_PATH = join(process.cwd(), "base", "sprite2.png");
const SPRITE3_REFERENCE_PATH = join(process.cwd(), "base", "sprite3.png");
const SPRITE4_REFERENCE_PATH = join(process.cwd(), "base", "sprite4.png");
const STYLE_REFERENCE_PATH = join(process.cwd(), "base", "style.png");

const spriteReferenceCache = { value: null as string | null };
const sprite2ReferenceCache = { value: null as string | null };
const sprite3ReferenceCache = { value: null as string | null };
const sprite4ReferenceCache = { value: null as string | null };
const styleReferenceCache = { value: null as string | null };

type GenerateResult = {
  result?: string;
  error?: string;
  message?: string;
  status?: number;
};

async function loadBase64Reference(path: string, cache: { value: string | null }): Promise<string | null> {
  if (cache.value) {
    return cache.value;
  }

  try {
    const file = await readFile(path);
    const base64 = file.toString("base64");
    cache.value = `data:image/png;base64,${base64}`;
    return cache.value;
  } catch (error) {
    console.error(`Failed to load reference image at ${path}:`, error);
    return null;
  }
}

function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const { choices } = payload as { choices?: OpenRouterImageChoice[] };
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

function buildDataUrl(image: ArrayBuffer, mimeType?: string) {
  const safeMimeType = mimeType && mimeType.length > 0 ? mimeType : "image/png";
  const base64 = Buffer.from(image).toString("base64");
  return `data:${safeMimeType};base64,${base64}`;
}

function extractMessageText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const { choices } = payload as { choices?: OpenRouterTextChoice[] };
  if (!Array.isArray(choices)) {
    return null;
  }

  for (const choice of choices) {
    const { content } = choice.message ?? {};
    if (typeof content === "string" && content.trim().length > 0) {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const textSegments = content
        .map(segment => (typeof segment?.text === "string" ? segment.text.trim() : ""))
        .filter(segment => segment.length > 0);

      if (textSegments.length > 0) {
        return textSegments.join("\n").trim();
      }
    }
  }

  return null;
}

async function derivePromptFromImage(apiKey: string, imageDataUrl: string): Promise<string | null> {
  let response: Response;

  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "South Park Character Generator",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content:
              "You are a character prompt engineer who translates photographs into richly detailed South Park-style character briefs. Describe distinctive facial features, hairstyle, clothing, accessories, posture, and any notable props. Keep the tone direct and visual, 80-120 words.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this uploaded reference photo. Produce a single, descriptive prompt that captures the subject's ethnicity, facial structure, hairstyle, unique marks or accessories, outfit, palette cues, and overall vibe so the image can be reinterpreted as a South Park character. Be specific about directions like left/right for asymmetrical features.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          },
        ],
        provider: {
          order: ["cerebras", "groq"],
          allow_fallbacks: true,
        },
      }),
    });
  } catch (error) {
    console.error("Failed to derive prompt from image:", error);
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Prompt derivation failed", response.status, body);
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return extractMessageText(payload);
}

export async function generateSouthParkCharacter(payload: GenerateRequest): Promise<GenerateResult> {
  if (!payload || !(payload.image instanceof ArrayBuffer) || payload.image.byteLength === 0) {
    return { error: "missing-image", message: "Select an image to continue." };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { error: "missing-api-key", message: "Set OPENROUTER_API_KEY in your environment." };
  }
  /*
  if (payload.image.byteLength > 10 * 1024 * 1024) {
    return {
      error: "image-too-large",
      message: "Upload an image smaller than 10MB for best results.",
    };
  }
*/
  const [spriteReference, sprite2Reference, sprite3Reference, sprite4Reference, styleReference] = await Promise.all([
    loadBase64Reference(SPRITE_REFERENCE_PATH, spriteReferenceCache),
    loadBase64Reference(SPRITE2_REFERENCE_PATH, sprite2ReferenceCache),
    loadBase64Reference(SPRITE3_REFERENCE_PATH, sprite3ReferenceCache),
    loadBase64Reference(SPRITE4_REFERENCE_PATH, sprite4ReferenceCache),
    loadBase64Reference(STYLE_REFERENCE_PATH, styleReferenceCache),
  ]);

  const dataUrl = buildDataUrl(payload.image, payload.mimeType);

  const derivedPrompt = await derivePromptFromImage(apiKey, dataUrl);
  const subjectDescription =
    derivedPrompt ??
    "Describe the subject's facial features, hairstyle, skin tone, clothing, accessories, and overall vibe so it can be reinterpreted as a South Park-style character. Be specific about asymmetrical details.";

  const referenceImages = [
    spriteReference
      ? {
          type: "image_url" as const,
          image_url: { url: spriteReference },
        }
      : null,
    sprite2Reference
      ? {
          type: "image_url" as const,
          image_url: { url: sprite2Reference },
        }
      : null,
    sprite3Reference
      ? {
          type: "image_url" as const,
          image_url: { url: sprite3Reference },
        }
      : null,
    sprite4Reference
      ? {
          type: "image_url" as const,
          image_url: { url: sprite4Reference },
        }
      : null,
    styleReference
      ? {
          type: "image_url" as const,
          image_url: { url: styleReference },
        }
      : null,
  ].filter(Boolean) as Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image_url";
        image_url: {
          url: string;
        };
      }
  >;

  const jsonSpec = {
    task: "create_south_park_style_sprite_sheet",
    subject_description: subjectDescription,
    style: {
      franchise: "South Park",
      rendering: {
        outlines: "thick black",
        colors: "flat",
        shading: "minimal",
      },
    },
    sprite_sheet: {
      background: "#FFFFFF",
      layout: {
        type: "grid",
        columns: 2,
        rows: 2,
        frame_order: ["front_neutral", "side_left", "side_right", "back"],
      },
      alignment: {
        baseline: "consistent across frames",
        horizontal: "character centered per frame",
        spacing: "even and grid-aligned",
      },
      frame_labels: "none",
      overlays: "none",
      margins: 0,
      padding: 0,
    },
    constraints: {
      no_text_anywhere: true,
      no_labels_under_frames: true,
      no_watermarks_or_logos: true,
      no_borders_or_drop_shadows: true,
      production_ready: true,
    },
    output: {
      usage: "direct_asset",
      format: "png",
      transparency: false,
      color_profile: "sRGB",
      notes:
        "This image will be used directly as an in-game asset. Do not add captions, labels, or decorative elements outside the character frames.",
    },
    references: {
      sprite_sheet_examples: true,
      style_reference: true,
    },
  };

  const requestBody = {
    model: MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify(jsonSpec, null, 2),
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
          ...referenceImages,
        ],
      },
    ],
    response_format: {
      type: "image",
    },
  };

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "South Park Character Generator",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    return {
      error: "network-error",
      message: error instanceof Error ? error.message : "Failed to reach OpenRouter.",
    };
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return {
      error: "request-failed",
      status: response.status,
      message,
    };
  }

  const result = (await response.json().catch(() => null)) as unknown;
  const generatedImageUrl = extractImageUrl(result);

  if (!generatedImageUrl) {
    return {
      error: "no-image-returned",
      message: "The model did not provide an image. Check response_debug.json for details.",
    };
  }

  return { result: generatedImageUrl };
}
