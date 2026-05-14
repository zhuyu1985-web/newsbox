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
  //
  // 实现说明：COS 数据万象 CI 通过 query param `?ci-process=...` 走 GET。
  // 桶配置为公有读，所以 GET 不需要签名，直接 fetch 公开 URL 即可。
  // SDK 的 cos.request + RawBody 在 CI 场景下会把 XML 当二进制返回且没默认超时，
  // 我们改走原生 fetch + AbortSignal.timeout(60s) 更稳。

  async probe(sourceKey: string): Promise<{
    durationSec: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string;
    sizeBytes: number;
  }> {
    const url = this.getPublicUrl(sourceKey) + '?ci-process=videoinfo';
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`cos probe ${res.status}: ${await res.text().catch(() => '')}`);
    const xml = await res.text();
    const fmt = pickTag(xml, 'Format');
    const stream = pickTag(xml, 'Stream');
    const videoStream = pickTag(stream, 'Video');
    const audioStream = pickTag(stream, 'Audio');
    return {
      durationSec: Number(pickField(fmt, 'Duration') ?? 0),
      sizeBytes: Number(pickField(fmt, 'Size') ?? 0),
      width: Number(pickField(videoStream, 'Width') ?? 0),
      height: Number(pickField(videoStream, 'Height') ?? 0),
      videoCodec: String(pickField(videoStream, 'CodecName') ?? ''),
      audioCodec: String(pickField(audioStream, 'CodecName') ?? ''),
    };
  }

  async generateSmartCover(input: {
    sourceKey: string;
    outputKey: string;
  }): Promise<{ key: string; url: string }> {
    const buf = await this.fetchSnapshot(input.sourceKey, 0);
    await this.upload({ key: input.outputKey, body: buf, contentType: 'image/jpeg' });
    return { key: input.outputKey, url: this.getPublicUrl(input.outputKey) };
  }

  async extractFrames(input: {
    sourceKey: string;
    timestamps: number[];
    outputKeyPrefix: string;
  }): Promise<Array<{ timestamp: number; key: string; url: string }>> {
    const results: Array<{ timestamp: number; key: string; url: string }> = [];
    for (const t of input.timestamps) {
      const buf = await this.fetchSnapshot(input.sourceKey, t);
      const outKey = `${input.outputKeyPrefix}-${String(t).padStart(6, '0')}.jpg`;
      await this.upload({ key: outKey, body: buf, contentType: 'image/jpeg' });
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
    const url =
      this.getPublicUrl(input.sourceKey) +
      `?ci-process=videoprocess&operation=sprite/${input.rows}x${input.cols}` +
      `&output=${encodeURIComponent(input.outputKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`cos sprite ${res.status}: ${await res.text().catch(() => '')}`);
    const xml = await res.text();
    const out = pickField(xml, 'ObjectName') ?? input.outputKey;
    return {
      key: out,
      url: this.getPublicUrl(out),
    };
  }

  private async fetchSnapshot(sourceKey: string, timeSec: number): Promise<Buffer> {
    const url =
      this.getPublicUrl(sourceKey) +
      `?ci-process=snapshot&time=${timeSec}&format=jpg`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new Error(`cos snapshot ${res.status} at ${timeSec}s: ${await res.text().catch(() => '')}`);
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0) throw new Error(`cos snapshot at ${timeSec}s: empty body`);
    return Buffer.from(ab);
  }
}

/** 极简 XML tag/field 提取（COS CI 的 videoinfo / sprite 响应只有简单嵌套，不引入 xml2js）*/
function pickTag(xml: string | undefined, tagName: string): string | undefined {
  if (!xml) return undefined;
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
  const m = xml.match(re);
  return m?.[1];
}

function pickField(xml: string | undefined, tagName: string): string | undefined {
  return pickTag(xml, tagName)?.trim();
}

function toBuffer(body: Buffer | ReadableStream | Blob): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    throw new Error('Blob upload not supported in Node-side adapter; convert to Buffer first');
  }
  throw new Error('ReadableStream upload requires multipart implementation; not in MVP scope');
}
