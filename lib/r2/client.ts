import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const R2_ACCOUNT_ID = required("R2_ACCOUNT_ID");
const R2_BUCKET = required("R2_BUCKET");
const R2_ACCESS_KEY_ID = required("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = required("R2_SECRET_ACCESS_KEY");
const R2_KEY_PREFIX = (process.env.R2_KEY_PREFIX || "").replace(/^\/+|\/+$/g, "");

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function withPrefix(key: string): string {
  return R2_KEY_PREFIX ? `${R2_KEY_PREFIX}/${key}` : key;
}

/**
 * Store JSON in R2 under the given key.
 */
export async function r2PutJSON<T extends object | unknown>(key: string, data: T): Promise<void> {
  const body = Buffer.from(JSON.stringify(data));
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: withPrefix(key),
      Body: body,
      ContentType: "application/json",
      CacheControl: "no-cache",
    })
  );
}

/**
 * Store plain text (default: NDJSON) in R2 under the given key.
 */
export async function r2PutText(
  key: string,
  text: string,
  contentType: string = "application/x-ndjson"
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: withPrefix(key),
      Body: Buffer.from(text),
      ContentType: contentType,
      CacheControl: "no-cache",
    })
  );
}
