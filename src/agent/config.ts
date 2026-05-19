export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_GEMINI_TEMPERATURE = 0.1;

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
}

export function resolveGeminiConfig(options: {
  cliModel?: string;
  env?: Partial<Pick<NodeJS.ProcessEnv, "GOOGLE_GENERATIVE_AI_API_KEY" | "DROPSCOUT_GEMINI_MODEL">>;
  temperature?: number;
}): GeminiConfig {
  const env = options.env ?? process.env;
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required for live Gemini agent benchmark runs.");
  }

  if (options.cliModel !== undefined && options.cliModel.trim() === "") {
    throw new Error("Gemini model name must not be empty.");
  }

  const model = options.cliModel?.trim() || env.DROPSCOUT_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!model) {
    throw new Error("Gemini model name must not be empty.");
  }

  const temperature = options.temperature ?? DEFAULT_GEMINI_TEMPERATURE;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error("Gemini temperature must be a finite number from 0 to 2.");
  }

  return {
    apiKey,
    model,
    temperature
  };
}
