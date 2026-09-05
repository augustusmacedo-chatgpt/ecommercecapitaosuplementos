type R2ObjectLike = { body: ReadableStream<Uint8Array> | null };
type R2BucketLike = {
  get(key: string): Promise<R2ObjectLike | null>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
};

type StorageGlobal = typeof globalThis & { __CAPITAO_R2__?: R2BucketLike };

function bucket() {
  const value = (globalThis as StorageGlobal).__CAPITAO_R2__;
  if (!value) throw new Error('Armazenamento persistente do Cloudflare R2 não está conectado.');
  return value;
}

export function hasStorage() {
  return Boolean((globalThis as StorageGlobal).__CAPITAO_R2__);
}

export async function get(key: string) {
  const object = await bucket().get(key);
  if (!object?.body) return null;
  return { statusCode: 200, stream: object.body };
}

export async function put(key: string, value: string, options: { contentType?: string; cacheControlMaxAge?: number } = {}) {
  await bucket().put(key, value, {
    httpMetadata: {
      contentType: options.contentType,
      cacheControl: options.cacheControlMaxAge ? `public, max-age=${options.cacheControlMaxAge}` : undefined,
    },
  });
}
