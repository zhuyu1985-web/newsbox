import COS from 'cos-nodejs-sdk-v5';
import type {
  StorageProvider,
  UploadInput,
  UploadResult,
  UploadCredential,
  UploadCredentialInput,
} from '../types';

interface CosEnv {
  secretId: string;
  secretKey: string;
  region: string;
  bucket: string;
  customDomain?: string;
}

function loadEnv(): CosEnv {
  const required = ['TENCENT_COS_SECRET_ID', 'TENCENT_COS_SECRET_KEY', 'TENCENT_COS_REGION', 'TENCENT_COS_BUCKET'];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`${k} is required for TencentCosAdapter`);
  }
  return {
    secretId: process.env.TENCENT_COS_SECRET_ID!,
    secretKey: process.env.TENCENT_COS_SECRET_KEY!,
    region: process.env.TENCENT_COS_REGION!,
    bucket: process.env.TENCENT_COS_BUCKET!,
    customDomain: process.env.TENCENT_COS_CUSTOM_DOMAIN,
  };
}

export class TencentCosAdapter implements StorageProvider {
  readonly name = 'tencent-cos' as const;
  private cos: COS;
  private env: CosEnv;

  constructor() {
    this.env = loadEnv();
    this.cos = new COS({ SecretId: this.env.secretId, SecretKey: this.env.secretKey });
  }

  upload(input: UploadInput): Promise<UploadResult> {
    const body = toBuffer(input.body);
    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.env.bucket,
          Region: this.env.region,
          Key: input.key,
          Body: body,
          ContentType: input.contentType,
        },
        (err, data) => {
          if (err) return reject(new Error(`cos putObject failed: ${err.message || err}`));
          resolve({
            url: this.getPublicUrl(input.key),
            key: input.key,
            size: body.byteLength,
          });
        }
      );
    });
  }

  createUploadCredential(input: UploadCredentialInput): Promise<UploadCredential> {
    const expires = input.expiresIn ?? 3600;
    return new Promise((resolve, reject) => {
      this.cos.getObjectUrl(
        {
          Bucket: this.env.bucket,
          Region: this.env.region,
          Key: input.key,
          Method: 'PUT',
          Sign: true,
          Expires: expires,
        },
        (err, data) => {
          if (err) return reject(new Error(`cos signing failed: ${err.message || err}`));
          resolve({
            uploadUrl: data.Url,
            method: 'PUT',
            headers: { 'Content-Type': input.contentType },
            publicUrl: this.getPublicUrl(input.key),
            expiresAt: Date.now() + expires * 1000,
          });
        }
      );
    });
  }

  getPublicUrl(key: string): string {
    if (this.env.customDomain) {
      return `https://${this.env.customDomain}/${key}`;
    }
    return `https://${this.env.bucket}.cos.${this.env.region}.myqcloud.com/${key}`;
  }

  delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cos.deleteObject(
        { Bucket: this.env.bucket, Region: this.env.region, Key: key },
        (err) => (err ? reject(new Error(`cos delete failed: ${err.message || err}`)) : resolve())
      );
    });
  }

  exists(key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.cos.headObject(
        { Bucket: this.env.bucket, Region: this.env.region, Key: key },
        (err) => {
          if (!err) return resolve(true);
          if ((err as any).statusCode === 404) return resolve(false);
          reject(new Error(`cos headObject failed: ${(err as any).message || (err as any).statusCode}`));
        }
      );
    });
  }
}

function toBuffer(body: Buffer | ReadableStream | Blob): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    throw new Error('Blob upload not supported in Node-side adapter; convert to Buffer first');
  }
  throw new Error('ReadableStream upload requires multipart implementation; not in MVP scope');
}
