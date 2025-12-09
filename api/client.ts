import { BASE_URL } from "../constants/config";

/**
 * Base GET request wrapper
 */
export async function apiGet(path: string, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  return handleResponse(response);
}

/**
 * Base POST request wrapper
 */
export async function apiPost(path: string, body?: any, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  return handleResponse(response);
}

/**
 * Standard response handler → avoids crashes
 */
async function handleResponse(res: Response) {
  let text = "";

  try {
    text = await res.text();
  } catch {}

  if (!res.ok) {
    throw new Error(
      `API Error ${res.status}: ${text || res.statusText || "Unknown error"}`
    );
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
