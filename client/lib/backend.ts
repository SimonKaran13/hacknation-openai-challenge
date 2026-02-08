const DEPLOYED_BACKEND_URL = "https://hacknation-openai-challenge.onrender.com";
const LOCAL_BACKEND_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 7_000;

const getBaseUrls = () => {
  const configured = process.env.BACKEND_URL?.trim();
  return Array.from(
    new Set([configured, DEPLOYED_BACKEND_URL, LOCAL_BACKEND_URL].filter(Boolean) as string[])
  );
};

export const fetchFromBackend = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const baseUrls = getBaseUrls();
  const errors: string[] = [];

  for (const baseUrl of baseUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      if (response.status === 404 || response.status >= 500) {
        errors.push(`${baseUrl}${path} -> HTTP ${response.status}`);
        continue;
      }

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${baseUrl}${path} -> ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`All task backends failed. ${errors.join(" | ")}`);
};
