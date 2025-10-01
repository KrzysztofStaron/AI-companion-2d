"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MODEL_ID = "google/gemini-2.5-flash-image-preview"; // alias: nano banana

// Server-side caches to avoid repeated disk reads
const spriteReferenceCache = { value: null as string | null };
const sprite2ReferenceCache = { value: null as string | null };
const sprite3ReferenceCache = { value: null as string | null };
const sprite4ReferenceCache = { value: null as string | null };
const styleReferenceCache = { value: null as string | null };

// Reference image paths (absolute via process.cwd())
const SPRITE_REFERENCE_PATH = join(process.cwd(), "base", "sprite.png");
const SPRITE2_REFERENCE_PATH = join(process.cwd(), "base", "sprite2.png");
const SPRITE3_REFERENCE_PATH = join(process.cwd(), "base", "sprite3.png");
const SPRITE4_REFERENCE_PATH = join(process.cwd(), "base", "sprite4.png");
const STYLE_REFERENCE_PATH = join(process.cwd(), "base", "style.png");

interface GenerateTalkingFramesRequest {
  firstFrame: string; // Base64 image URL of the first frame
  seed?: number; // For consistent results
}

interface GenerateTalkingFramesResult {
  result?: string;
  error?: string;
  message?: string;
  status?: number;
}

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

export async function generateTalkingFrames(
  payload: GenerateTalkingFramesRequest
): Promise<GenerateTalkingFramesResult> {
  if (!payload || !payload.firstFrame) {
    return { error: "missing-frame", message: "First frame is required to generate talking animation." };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { error: "missing-api-key", message: "Set OPENROUTER_API_KEY in your environment." };
  }

  const [spriteReference, sprite2Reference, sprite3Reference, sprite4Reference, styleReference] = await Promise.all([
    loadBase64Reference(SPRITE_REFERENCE_PATH, spriteReferenceCache),
    loadBase64Reference(SPRITE2_REFERENCE_PATH, sprite2ReferenceCache),
    loadBase64Reference(SPRITE3_REFERENCE_PATH, sprite3ReferenceCache),
    loadBase64Reference(SPRITE4_REFERENCE_PATH, sprite4ReferenceCache),
    loadBase64Reference(STYLE_REFERENCE_PATH, styleReferenceCache),
  ]);

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
    task: "create_talking_animation_frames",
    base_character: {
      description: "Use the provided first frame as the base character reference",
      focus: "mouth_animation_keyframes",
    },
    animation_specification: {
      type: "mouth_talking_cycle",
      frames: [
        {
          name: "mouth_open_talking1",
          description: "Character with mouth slightly open in first talking position",
          mouth_state: "open_talking1",
          expression: "talking_subtle",
        },
        {
          name: "mouth_open_talking2",
          description: "Character with mouth more widely open in second talking position, showing teeth/tongue",
          mouth_state: "open_talking2",
          expression: "talking_emphasized",
        },
        {
          name: "mouth_open_talking3",
          description: "Blend between mouth_open_talking1 and mouth_open_talking2, make sure all frames are different",
          mouth_state: "open_talking3",
          expression: "talking_emphasized",
        },
      ],
      transitions: {
        timing: "smooth",
        loop: true,
      },
    },
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
        columns: 3,
        rows: 1,
        frame_order: ["mouth_open_talking1", "mouth_open_talking2", "mouth_open_talking3"],
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
      maintain_character_consistency: true,
    },
    output: {
      usage: "direct_asset",
      format: "png",
      transparency: false,
      color_profile: "sRGB",
      notes:
        "This sprite sheet will be used for character mouth animation with three different talking positions. Focus only on mouth movement variations while keeping the rest of the character identical to the base frame.",
    },
    references: {
      base_character_frame: true,
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
              url: payload.firstFrame,
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
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "South Park Talking Frames Generator",
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
