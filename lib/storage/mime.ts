// 上传统一的 MIME 兜底：浏览器 File.type 在某些场景（剪贴板上传、未注册的 MIME）会返回空字符串。
// 这时 fallback 到 application/octet-stream 会让 COS 把对象 Content-Type 存为 octet-stream，
// 后续直接访问 URL 时浏览器只会触发下载，无法内嵌播放 → 视频笔记打不开。
// 解决方案：按文件扩展名兜底，确保 COS 存的 Content-Type 正确。

const EXT_MIME: Record<string, string> = {
  // 视频
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  // 音频
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  // 图片
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  // 文档
  pdf: 'application/pdf',
};

/**
 * 优先用浏览器给的 MIME，空时按扩展名映射；都没有时 fallback 到 octet-stream。
 *
 * @param browserType  File.type / form 字段里的 MIME（可空）
 * @param filename     文件名或 key（用于取扩展名）
 */
export function resolveContentType(browserType: string | null | undefined, filename: string): string {
  if (browserType && browserType !== 'application/octet-stream') return browserType;
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

export function mimeFromExt(ext: string): string {
  return EXT_MIME[ext.toLowerCase().replace(/^\./, '')] ?? 'application/octet-stream';
}
