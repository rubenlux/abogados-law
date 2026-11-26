const viteEnv = (
  import.meta as { env?: Record<string, string | undefined> }
).env;

export const API_URL =
  viteEnv?.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:3000';

