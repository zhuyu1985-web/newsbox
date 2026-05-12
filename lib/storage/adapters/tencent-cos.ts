import COS from 'cos-nodejs-sdk-v5';
import type {
  StorageProvider,
  MediaProcessingCapability,
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

export class TencentCosAdapter implements StorageProvider, MediaProcessingCapability {
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

  // ── MediaProcessingCapability ──────────────────────────────────────────────

  async probe(sourceKey: string): Promise<{
    durationSec: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string;
    sizeBytes: number;
  }> {
    const data = await this.ciRequest({
      Key: sourceKey,
      Query: { 'ci-process': 'videoinfo' },
    });
    const info = data?.Response?.MediaInfo;
    if (!info) throw new Error('cos probe: empty MediaInfo');
    return {
      durationSec: Number(info.Format?.Duration ?? 0),
      width: Number(info.Stream?.Video?.Width ?? 0),
      height: Number(info.Stream?.Video?.Height ?? 0),
      videoCodec: String(info.Stream?.Video?.Codec_name ?? ''),
      audioCodec: String(info.Stream?.Audio?.Codec_name ?? ''),
      sizeBytes: Number(info.Format?.Size ?? 0),
    };
  }

  async generateSmartCover(input: {
    sourceKey: string;
    outputKey: string;
  }): Promise<{ key: string; url: string }> {
    const data = await this.ciRequest({
      Key: input.sourceKey,
      Query: { 'ci-process': 'snapshot', time: '0', format: 'jpg' },
    });
    const body = data?.Body;
    if (!body) throw new Error('cos snapshot: empty body');
    await this.upload({ key: input.outputKey, body: body as Buffer, contentType: 'image/jpeg' });
    return { key: input.outputKey, url: this.getPublicUrl(input.outputKey) };
  }

  async extractFrames(input: {
    sourceKey: string;
    timestamps: number[];
    outputKeyPrefix: string;
  }): Promise<Array<{ timestamp: number; key: string; url: string }>> {
    const results: Array<{ timestamp: number; key: string; url: string }> = [];
    for (const t of input.timestamps) {
      const data = await this.ciRequest({
        Key: input.sourceKey,
        Query: { 'ci-process': 'snapshot', time: String(t), format: 'jpg' },
      });
      const body = data?.Body;
      if (!body) throw new Error(`cos snapshot at ${t}s: empty body`);
      const outKey = `${input.outputKeyPrefix}-${String(t).padStart(6, '0')}.jpg`;
      await this.upload({ key: outKey, body: body as Buffer, contentType: 'image/jpeg' });
      results.push({ timestamp: t, key: outKey, url: this.getPublicUrl(outKey) });
    }
    return results;
  }

  async generateSpriteSheet(input: {
    sourceKey: string;
    outputKey: string;
    rows: number;
    cols: number;
  }): Promise<{ key: string; url: string; vttKey?: string }> {
    const data = await this.ciRequest({
      Key: input.sourceKey,
      Query: {
        'ci-process': 'videoprocess',
        operation: `sprite/${input.rows}x${input.cols}`,
        output: input.outputKey,
      },
    });
    const out = data?.Response?.OutputFile?.ObjectName ?? input.outputKey;
    const vtt = data?.Response?.OutputVttFile?.ObjectName;
    return {
      key: out,
      url: this.getPublicUrl(out),
      vttKey: vtt,
    };
  }

  private ciRequest(params: { Key: string; Query: Record<string, string> }): Promise<any> {
    return new Promise((resolve, reject) => {
      this.cos.request(
        {
          Bucket: this.env.bucket,
          Region: this.env.region,
          Method: 'GET',
          Key: params.Key,
          Query: params.Query,
          RawBody: true,
        } as any,
        (err: any, data: any) =>
          err ? reject(new Error(`cos CI failed: ${err.message || err}`)) : resolve(data)
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
