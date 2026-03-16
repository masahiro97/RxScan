import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.S3_BUCKET_REGION ?? "ap-northeast-1",
  credentials: {
    accessKeyId: (process.env.APP_S3_KEY ?? process.env.AWS_ACCESS_KEY_ID)!,
    secretAccessKey: (process.env.APP_S3_SECRET ?? process.env.AWS_SECRET_ACCESS_KEY)!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);
  if (!response.Body) throw new Error(`S3オブジェクトが空です: ${key}`);
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}
