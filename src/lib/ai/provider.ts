import { type AiConfig, getAiConfig } from "@/lib/env";

export interface CompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
  /** Abort the upstream call after this many milliseconds. */
  timeoutMs: number;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

interface Provider {
  readonly name: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<string>;
}

/**
 * Minimal provider interface deliberately implemented with `fetch` instead of a
 * vendor SDK: it keeps the serverless bundle small, works on Vercel's Node
 * runtime without native dependencies, and makes swapping models a config
 * change rather than a code change.
 *
 * Both implementations run server-side only — the API key never leaves the
 * server and is never inlined into the client bundle.
 */
function createAnthropicProvider(config: AiConfig): Provider {
  return {
    name: "anthropic",
    model: config.model,
    async complete({ system, user, maxTokens, timeoutMs }) {
      const response = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            temperature: 0,
            system,
            messages: [{ role: "user", content: user }],
          }),
        },
        timeoutMs,
      );

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new AiProviderError(`AIプロバイダがエラーを返しました (HTTP ${response.status})`);
      }

      const text = extractAnthropicText(payload);
      if (!text) throw new AiProviderError("AIプロバイダの応答を解釈できませんでした。");
      return text;
    },
  };
}

function createOpenAiProvider(config: AiConfig): Provider {
  return {
    name: "openai",
    model: config.model,
    async complete({ system, user, maxTokens, timeoutMs }) {
      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            max_completion_tokens: maxTokens,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        },
        timeoutMs,
      );

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new AiProviderError(`AIプロバイダがエラーを返しました (HTTP ${response.status})`);
      }

      const text = extractOpenAiText(payload);
      if (!text) throw new AiProviderError("AIプロバイダの応答を解釈できませんでした。");
      return text;
    },
  };
}

/** Returns `null` when no API key is configured — never throws. */
export function getProvider(): Provider | null {
  const config = getAiConfig();
  if (!config) return null;
  return config.provider === "openai"
    ? createOpenAiProvider(config)
    : createAnthropicProvider(config);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiProviderError("AIの応答がタイムアウトしました。");
    }
    // Deliberately generic: upstream error objects can embed request headers.
    throw new AiProviderError("AIプロバイダに接続できませんでした。");
  } finally {
    clearTimeout(timer);
  }
}

function extractAnthropicText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      parts.push((block as { text: string }).text);
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

function extractOpenAiText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" && content.length > 0 ? content : null;
}
