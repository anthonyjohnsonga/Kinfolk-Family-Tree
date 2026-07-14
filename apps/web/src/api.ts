export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
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
