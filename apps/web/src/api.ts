export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  // Only announce a JSON body when one is actually sent. Fastify rejects a
  // bodyless request that still claims Content-Type: application/json with
  // 400 FST_ERR_CTP_EMPTY_JSON_BODY, which broke sign-out and every DELETE.
  const headers = options?.body
    ? { 'Content-Type': 'application/json', ...options.headers }
    : options?.headers;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error(
      'Cannot reach the Kinfolk server. Check that Docker services are running and try again.',
    );
  }
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && !url.startsWith('/api/auth/'))
      window.dispatchEvent(new Event('kinfolk:unauthorized'));
    throw new Error(body.message || `The server returned an error (${response.status}).`);
  }
  return response.json();
}
