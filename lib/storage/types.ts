/**
 * 多云对象存储抽象层 · 类型定义
 *
 * 设计要点：
 * - 所有 adapter 实现 StorageProvider 接口
 * - 仅 Tencent COS 额外暴露 MediaProcessingCapability（视频处理）
 * - 公开访问模式（public-read + 不可猜路径），暂不支持私有签名 URL
 *
 * 参考：docs/superpowers/specs/2026-05-12-video-and-storage-design.md §3
 */

export type StorageBackend = 'supabase' | 'tencent-cos' | 'volcengine-tos';

/** 业务上的文件分类，决定 key 的 {kind} 段 */
export type StorageKind =
  | 'images'
  | 'videos'
  | 'audios'
  | 'snapshots'
  | 'frames'
  | 'sprites'
  | 'covers';

export interface UploadInput {
  /** 完整对象 key，例如 "userId/videos/2026/05/12/abc123.mp4" */
  key: string;
  body: Buffer | ReadableStream | Blob;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

export interface UploadCredentialInput {
  key: string;
  contentType: string;
  /** 凭证有效期（秒），默认 3600 */
  expiresIn?: number;
}

export interface UploadCredential {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  publicUrl: string;
  expiresAt: number;
}

export interface StorageProvider {
  readonly name: StorageBackend;

  upload(input: UploadInput): Promise<UploadResult>;
  createUploadCredential(input: UploadCredentialInput): Promise<UploadCredential>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** 仅 Tencent COS（数据万象 CI）实现 */
export interface MediaProcessingCapability {
  probe(sourceKey: string): Promise<{
    durationSec: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string;
    sizeBytes: number;
  }>;

  generateSmartCover(input: {
    sourceKey: string;
    outputKey: string;
  }): Promise<{ key: string; url: string }>;

  extractFrames(input: {
    sourceKey: string;
    timestamps: number[];
    outputKeyPrefix: string;
  }): Promise<Array<{ timestamp: number; key: string; url: string }>>;

  generateSpriteSheet(input: {
    sourceKey: string;
    outputKey: string;
    rows: number;
    cols: number;
  }): Promise<{ key: string; url: string; vttKey?: string }>;

  submitTranscode(input: {
    sourceKey: string;
    outputKey: string;
    targetCodec: 'h264';
    /**
     * DASH 分轨场景：把外部音频 key 通过 COS CI <AudioMix> 合流到输出。
     * sourceKey 一般是纯视频（无音轨），audioMixSourceKey 提供音频。
     */
    audioMixSourceKey?: string;
  }): Promise<{ jobId: string }>;

  getTranscodeStatus(jobId: string): Promise<{
    status: 'pending' | 'running' | 'done' | 'failed';
    error?: string;
  }>;
}

/** 运行时探测 adapter 是否带 CI 能力 */
export function hasMediaProcessing(p: StorageProvider): p is StorageProvider & MediaProcessingCapability {
  return typeof (p as any).probe === 'function';
}
