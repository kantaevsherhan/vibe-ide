export function childEnv() {
  const env = { ...process.env };
  delete env.VIBEIDE_CHRONOS_TOKEN;
  delete env.VIBEIDE_API_KEY;
  delete env.VIBEIDE_OLLAMA_KEY;
  delete env.VIBEIDE_PASSWORD;
  delete env.VIBEIDE_SESSION_SECRET;
  return env;
}
