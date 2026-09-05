type R2ObjectLike = { body: ReadableStream<Uint8Array> | null };
type R2BucketLike = {
  get(key: string): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
};

type StorageGlobal = typeof globalThis & { __CAPITAO_R2__?: R2BucketLike };

const STORAGE_GLOBAL_KEY = '__CAPITAO_R2__';

function bucket(): R2BucketLike {
  const value = (globalThis as StorageGlobal)[STORAGE_GLOBAL_KEY];
  if (!value) {
    throw new Error('Armazenamento persistente do Cloudflare R2 não está conectado.');
  }
  return value;
}

export function hasStorage(): boolean {
  return Boolean((globalThis as StorageGlobal)[STORAGE_GLOBAL_KEY]);
}

export async function get(key: string) {
  const object = await bucket().get(key);
  if (!object?.body) return null;
  return { statusCode: 200, stream: object.body };
}

export async function put(
  key: string,
  value: string,
  options: { contentType?: string; cacheControlMaxAge?: number } = {},
): Promise<void> {
  const httpMetadata: { contentType?: string; cacheControl?: string } = {};

  if (options.contentType) httpMetadata.contentType = options.contentType;
  if (options.cacheControlMaxAge && options.cacheControlMaxAge > 0) {
    httpMetadata.cacheControl = `public, max-age=${Math.floor(options.cacheControlMaxAge)}`;
  }

  await bucket().put(key, value, { httpMetadata });
}
