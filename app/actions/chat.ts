"use server";

type Role = "user" | "assistant" | "system";
type Message = { role: Role; content: string };

export async function chatWithAI(messages: Message[]): Promise<{ content: string; error?: string }> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { content: "", error: "Missing messages" };
  }

  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    return { content: "", error: "Missing OPENROUTER_API_KEY" };
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b";

  let response: Response;

  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "South Park Chat",
      },
      body: JSON.stringify({
        model,
        messages,
        provider: {
          order: ["cerebras", "groq"],
          allow_fallbacks: true,
        },
      }),
    });
  } catch (error) {
    console.error("Failed to chat with AI:", error);
    return { content: "", error: String(error) };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Chat request failed", response.status, body);
    return { content: "", error: `OpenRouter error ${response.status}: ${body}` };
  }

  const payload = (await response.json().catch(() => null)) as any;
  const content: string = payload?.choices?.[0]?.message?.content ?? "";

  if (!content) {
    return { content: "", error: "No response from model" };
  }

  return { content };
}
