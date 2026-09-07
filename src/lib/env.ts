/**
 * Environment access.
 *
 * Every getter is lazy: nothing throws at module-evaluation time, so
 * `next build` succeeds on a machine (or CI runner) that has no Supabase or AI
 * credentials configured. Missing configuration is surfaced at request time as
 * a controlled error instead of a build failure or a blank page.
 */

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

function readPublicSupabaseEnv(): Partial<SupabaseEnv> {
  // Both must be referenced as static property accesses so Next.js can inline
  // them into the client bundle at build time.
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = readPublicSupabaseEnv();
  return Boolean(url && anonKey);
}

export function getSupabaseEnv(): SupabaseEnv {
  const { url, anonKey } = readPublicSupabaseEnv();
  if (!url || !anonKey) {
    throw new ConfigurationError(
      "Supabase の接続設定がありません。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。",
    );
  }
  return { url, anonKey };
}

export type AiProviderName = "anthropic" | "openai" | "disabled";

export interface AiConfig {
  provider: AiProviderName;
  apiKey: string;
  model: string;
}

/**
 * Returns the AI configuration, or `null` when the deployment has not been
 * given an API key. Callers must treat `null` as "run the rule engine only" —
 * never as a fatal error.
 */
export function getAiConfig(): AiConfig | null {
  const provider = (process.env.AI_PROVIDER ?? "anthropic").trim().toLowerCase();

  if (provider === "disabled") return null;

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      provider: "openai",
      apiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    provider: "anthropic",
    apiKey,
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5",
  };
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}
