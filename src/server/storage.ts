type R2ObjectLike = {
  body: ReadableStream<Uint8Array> | null;
  etag?: string;
  httpEtag?: string;
};

type R2Conditional = {
  etagMatches?: string;
  etagDoesNotMatch?: string;
  uploadedBefore?: Date;
  uploadedAfter?: Date;
};

type R2BucketLike = {
  get(key: string, options?: { onlyIf?: R2Conditional }): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>,
    options?: {
      onlyIf?: R2Conditional;
      httpMetadata?: { contentType?: string; cacheControl?: string };
    },
  ): Promise<{ etag?: string; httpEtag?: string } | null>;
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
  return { statusCode: 200, stream: object.body, etag: object.etag || object.httpEtag || '' };
}

function metadata(options: { contentType?: string; cacheControlMaxAge?: number } = {}) {
  const httpMetadata: { contentType?: string; cacheControl?: string } = {};

  if (options.contentType) httpMetadata.contentType = options.contentType;
  if (options.cacheControlMaxAge && options.cacheControlMaxAge > 0) {
    httpMetadata.cacheControl = `public, max-age=${Math.floor(options.cacheControlMaxAge)}`;
  }

  return httpMetadata;
}

export async function put(
  key: string,
  value: string,
  options: { contentType?: string; cacheControlMaxAge?: number } = {},
): Promise<void> {
  await bucket().put(key, value, { httpMetadata: metadata(options) });
}

export async function putConditional(
  key: string,
  value: string,
  options: {
    contentType?: string;
    cacheControlMaxAge?: number;
    onlyIf: R2Conditional;
  },
): Promise<{ etag: string } | null> {
  const result = await bucket().put(key, value, {
    onlyIf: options.onlyIf,
    httpMetadata: metadata(options),
  });
  if (!result) return null;
  return { etag: result.etag || result.httpEtag || '' };
}
