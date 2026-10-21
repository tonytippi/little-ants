/** Error from the Little Ants API, with the HTTP status and the JSON body (field issues, blockers ...). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { message?: string | string[]; issues?: { path: string; message: string }[]; [key: string]: unknown },
  ) {
    super(Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? `Request failed (${status})`));
  }

  /** True when the request failed because the user is not signed in. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T = void>(path: string): Promise<T>;
  baseUrl: string;
}

/** JSON client for the API. Sends the session cookie on every request. */
export function createApiClient(baseUrl: string): ApiClient {
  const root = baseUrl.replace(/\/$/, '');
  async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${root}/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) throw new ApiError(response.status, (data ?? {}) as ApiError['body']);
    return data as T;
  }
  return {
    baseUrl: root,
    get: (path) => send('GET', path),
    post: (path, body) => send('POST', path, body ?? {}),
    put: (path, body) => send('PUT', path, body ?? {}),
    patch: (path, body) => send('PATCH', path, body ?? {}),
    del: (path) => send('DELETE', path),
  };
}

/** Upload a file with the two-step signed-URL flow (works for R2 and the local development store). */
export async function uploadAsset(
  api: ApiClient,
  file: File,
  options: { replacesId?: string; onProgress?: (fraction: number) => void } = {},
): Promise<{ id: string }> {
  const start = await api.post<{ assetId: string; uploadUrl: string; headers: Record<string, string> }>('/assets/upload-url', {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    replacesId: options.replacesId,
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', start.uploadUrl);
    for (const [name, value] of Object.entries(start.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, { message: 'Upload failed' })));
    xhr.onerror = () => reject(new ApiError(0, { message: 'Upload failed (network)' }));
    xhr.send(file);
  });
  await api.post(`/assets/${start.assetId}/complete`);
  return { id: start.assetId };
}
