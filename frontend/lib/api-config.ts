const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!configuredApiUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is required; refusing to guess a production API URL.",
  );
}

export const API_URL = configuredApiUrl.replace(/\/+$/, "");

export function apiRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: "include",
  });
}
