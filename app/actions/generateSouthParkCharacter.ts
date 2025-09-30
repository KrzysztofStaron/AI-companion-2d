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

const MODEL_ID = "google/gemini-2.5-flash-image-preview";

const SPRITE_REFERENCE_PATH = join(process.cwd(), "base", "sprite.png");
const SPRITE2_REFERENCE_PATH = join(process.cwd(), "base", "sprite2.png");
const SPRITE3_REFERENCE_PATH = join(process.cwd(), "base", "sprite3.png");
const STYLE_REFERENCE_PATH = join(process.cwd(), "base", "style.png");

const spriteReferenceCache = { value: null as string | null };
const sprite2ReferenceCache = { value: null as string | null };
const sprite3ReferenceCache = { value: null as string | null };
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

export async function generateSouthParkCharacter(payload: GenerateRequest): Promise<GenerateResult> {
  if (!payload || !(payload.image instanceof ArrayBuffer) || payload.image.byteLength === 0) {
    return { error: "missing-image", message: "Select an image to continue." };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { error: "missing-api-key", message: "Set OPENROUTER_API_KEY in your environment." };
  }

  if (payload.image.byteLength > 10 * 1024 * 1024) {
    return {
      error: "image-too-large",
      message: "Upload an image smaller than 10MB for best results.",
    };
  }

  const [spriteReference, sprite2Reference, sprite3Reference, styleReference] = await Promise.all([
    loadBase64Reference(SPRITE_REFERENCE_PATH, spriteReferenceCache),
    loadBase64Reference(SPRITE2_REFERENCE_PATH, sprite2ReferenceCache),
    loadBase64Reference(SPRITE3_REFERENCE_PATH, sprite3ReferenceCache),
    loadBase64Reference(STYLE_REFERENCE_PATH, styleReferenceCache),
  ]);

  const dataUrl = buildDataUrl(payload.image, payload.mimeType);

  const referenceImages = [
    {
      type: "text" as const,
      text: "Reference sprite sheet layout demonstrating pose alignment and spacing.",
    },
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
    {
      type: "text" as const,
      text: "Reference illustration showing desired shading, palette, and outline treatment.",
    },
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

  const requestBody = {
    model: MODEL_ID,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: 'Take the provided photo of this person and convert them into a South Park–style cartoon character. Keep the proportions, facial features, hair, and clothing recognizable but adapt them to the classic South Park art style (simple shapes, flat colors, thick outlines). Output a full sprite sheet asset with the following structure:\n\n"output": {\n  "background": "transparent",\n  "layout": {\n    "type": "grid",\n    "columns": 2,\n    "rows": 2,\n    "order": [\n      "front_neutral",\n      "side_left",\n      "side_right",\n      "back"\n    ]\n  }\n}\n\nPreserve consistent proportions across every pose, align each character to a shared baseline, and match the resolution and layout style of official South Park character sprite sheets so the result can be dropped directly into a 2D game pipeline. Use clean, production-ready rendering with transparent backgrounds behind each pose and ensure spacing between frames is even and grid-aligned.',
          },
          {
            type: "text",
            text: "Set the background to white.",
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
