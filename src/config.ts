import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} -- copy .env.example to .env and fill in values`
    );
  }
  return value;
}

export const config = {
  BOT_TOKEN: requireEnv("BOT_TOKEN"),
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  DEV_MODE: process.env.DEV_MODE === "true",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
} as const;
