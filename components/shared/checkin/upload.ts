// POST a FormData with upload progress. fetch() cannot report how much of the request body has
// been sent, XMLHttpRequest can (xhr.upload.onprogress), so a 100 KB selfie on a 2G connection shows
// a moving ring instead of a spinner that looks frozen. Never throws: a dropped connection, a
// timeout or an abort resolves to null (the caller maps that to "offline" copy), the same shape
// postJson() in app/m/check-in-card.tsx already used.

export interface UploadEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; fields?: Record<string, string>; details?: Record<string, unknown> };
}

export interface UploadOutcome<T> {
  status: number;
  json: UploadEnvelope<T>;
}

export function postFormWithProgress<T>(
  url: string,
  form: FormData,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<UploadOutcome<T> | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'text';
    xhr.timeout = options.timeoutMs ?? 30_000;
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => {
      options.onProgress?.(1);
      let json: UploadEnvelope<T> = {};
      try {
        json = JSON.parse(xhr.responseText) as UploadEnvelope<T>;
      } catch {
        // A non-JSON body (a proxy error page) still has a status the caller can map.
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => resolve(null);
    xhr.ontimeout = () => resolve(null);
    xhr.onabort = () => resolve(null);

    const onAbort = () => xhr.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        resolve(null);
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }
    xhr.send(form);
  });
}
