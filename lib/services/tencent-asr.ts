/**
 * ============================================================================
 * Tencent Cloud ASR Service (腾讯云语音识别服务层)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 封装腾讯云语音识别（ASR）API 的调用，提供音频/视频转写功能。
 *
 * 业务价值：
 * ---------
 * 为视频笔记提供"把视频当做文本来读"的能力：
 * 1. **语音转文字**：将视频/音频中的语音转换为文本
 * 2. **时间戳标注**：每句话都有开始和结束时间，支持跳转
 * 3. **说话人识别**：区分不同的说话人（主持人、嘉宾等）
 * 4. **卡拉OK式滚动**：视频播放时同步高亮对应的文字
 *
 * 架构位置：
 * ---------
 * 属于 Service 层，位于视频处理流程中：
 * Video Upload → Create ASR Task → Poll for Result → Save Transcript
 *
 * 腾讯云 ASR 产品：
 * ---------------
 * - 产品名称：录音文件识别
 * - API 文档：https://cloud.tencent.com/document/api/1093/37823
 * - 支持格式：MP3、M4A、WAV、FLAC、OGG、MP4 等
 * - 最大文件：5 小时，500 MB
 *
 * 计费说明：
 * ---------
 * - 按音频时长计费（元/小时）
 * - 免费额度：每月 2 小时（具体以官网为准）
 * - 建议实现缓存，避免重复转写同一文件
 *
 * ⚠️ Serverless 注意事项：
 * --------------------------
 * 本服务使用轮询方式（polling）等待结果。在 Serverless 环境（如 Vercel）
 * 中可能有以下风险：
 * 1. 函数执行超时（通常 10-60 秒）
 * 2. 长时间等待会消耗计算时间
 *
 * 生产环境建议使用 Webhook 回调模式，而不是轮询。
 *
 * @module lib/services/tencent-asr
 */

import * as tencentcloud from "tencentcloud-sdk-nodejs-asr";

// 创建腾讯云 ASR 客户端
const AsrClient = tencentcloud.asr.v20190614.Client;

// 客户端配置
const clientConfig = {
  credential: {
    // 从环境变量读取腾讯云密钥
    // 获取方式：https://console.cloud.tencent.com/cam/capi
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  // 区域选择：ap-shanghai（上海）
  // 可选区域：ap-guangzhou（广州）、ap-beijing（北京）等
  region: "ap-shanghai",
  profile: {
    httpProfile: {
      // API 端点：录音文件识别
      endpoint: "asr.tencentcloudapi.com",
    },
  },
};

// 创建全局客户端（可以复用）
const client = new AsrClient(clientConfig);

// ============================================================================
// Type Definitions (类型定义)
// ============================================================================

/**
 * ASR 错误信息
 */
export interface ASRError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
}

/**
 * ASR 识别片段（一句话）
 *
 * 包含文本内容和时间戳信息，用于卡拉OK式滚动显示。
 */
export interface ASRSegment {
  /** 开始时间（秒）*/
  start: number;
  /** 结束时间（秒）*/
  end: number;
  /** 识别的文本内容 */
  text: string;
  /** 说话人标识（可选）*/
  speaker?: string;
}

/**
 * ASR 识别结果
 *
 * 包含完整的转写文本和按时间分段的片段列表。
 */
export interface ASRResult {
  /** 完整的转写文本（所有段落拼接）*/
  fullText: string;
  /** 按时间分段的片段数组 */
  segments: ASRSegment[];
}

// ============================================================================
// Core Functions (核心函数)
// ============================================================================

/**
 * 提交 ASR 转写任务
 *
 * 业务流程：
 * ---------
 * 1. 将音频/视频 URL 提交给腾讯云 ASR
 * 2. 腾讯云下载文件并进行识别
 * 3. 返回任务 ID（后续用于查询结果）
 *
 * 支持的音频来源：
 * ---------------
 * - 公网可访问的 URL（推荐）
 * - 腾讯云 COS URL（内网，更快）
 * - 本地文件需要先上传到 COS
 *
 * 引擎模型说明：
 * ---------------
 * - `16k_zh`: 中文普通话通用（默认）
 * - `16k_en`: 英语
 * - `16k_ca`: 粤语
 * - `8k_zh`: 8k 电话通话
 *
 * ⚠️ 注意事项：
 * -------------
 * - URL 必须是公网可访问的（内网 URL 会被拒绝）
 * - 文件大小不超过 500 MB，时长不超过 5 小时
 * - 提交后任务进入队列，需要轮询查询结果
 *
 * @param url - 音频/视频文件的公网 URL
 * @returns Promise<string> - 任务 ID（TaskId）
 * @throws {Error} - 当 API 调用失败或未返回 TaskId 时抛出
 *
 * @example
 * ```ts
 * import { createASRTask } from '@/lib/services/tencent-asr';
 *
 * try {
 *   const taskId = await createASRTask('https://example.com/video.mp4');
 *   console.log('任务已提交:', taskId);
 *   // 保存 taskId 到数据库，后续轮询查询结果
 *   await supabase.from('notes').update({ asr_task_id: taskId }).eq('id', noteId);
 * } catch (error) {
 *   console.error('提交任务失败:', error);
 * }
 * ```
 */
export async function createASRTask(url: string): Promise<string> {
  // 构造请求参数
  const params = {
    // 引擎模型类型
    // 16k_zh: 16k 中文普通话通用（适用于大多数场景）
    // 16k_zh_video: 16k 中文普通话通用（视频场景，支持视频音轨分离）
    EngineModelType: "16k_zh",
    // 声道数（1 = 单声道，2 = 双声道）
    ChannelNum: 1,
    // 结果返回格式
    // 0: 识别结果文本（含时间戳）
    // 1: 识别结果文本（不含时间戳）
    // 2: 识别结果文本（含词级时间戳）
    ResTextFormat: 0,
    // 数据来源
    // 0: URL（公网可访问的文件地址）
    // 1: COS Bucket（腾讯云对象存储）
    // 2: ECS 本地文件（仅内网）
    SourceType: 0,
    // 音频/视频 URL
    Url: url,
  };

  try {
    // 调用 CreateRecTask API
    // API 文档：https://cloud.tencent.com/document/api/1093/37823
    const data = await client.CreateRecTask(params);

    // 提取 TaskId
    if (data.Data?.TaskId) {
      return String(data.Data.TaskId);
    }

    // 如果没有返回 TaskId，说明请求失败
    throw new Error("Failed to create ASR task: No TaskId returned");
  } catch (err: any) {
    console.error("Tencent ASR Create Task Error:", err);
    throw err;
  }
}

/**
 * 查询 ASR 任务状态和结果
 *
 * 业务流程：
 * ---------
 * 1. 使用 TaskId 查询任务状态
 * 2. 根据状态决定下一步操作
 * 3. 如果完成，解析并返回结果
 *
 * 任务状态说明：
 * -------------
 * - `0`: 待任务（任务已提交，等待处理）
 * - `1`: 运行中（正在识别）
 * - `2`: 已完成（识别完成，可以获取结果）
 * - `3`: 失败（识别失败，查看 ErrorMessage）
 *
 * 轮询策略：
 * ---------
 * - 建议每隔 2-3 秒查询一次
 * - 最多轮询 30 次（约 1 分钟）
 * - 如果超过 1 分钟未完成，可能是文件过大或服务器繁忙
 *
 * 返回值结构：
 * -----------
 * - `status`: 任务状态（0/1/2/3）
 * - `result`: 识别结果（仅当 status=2 时有值）
 *   - `fullText`: 完整文本
 *   - `segments`: 分段结果（含时间戳）
 *
 * @param taskId - 任务 ID（由 createASRTask 返回）
 * @returns Promise<{ status: number; result?: ASRResult }> - 任务状态和结果
 * @throws {Error} - 当 API 调用失败时抛出
 *
 * @example
 * ```ts
 * import { getASRTaskResult } from '@/lib/services/tencent-asr';
 *
 * // 轮询查询结果
 * for (let i = 0; i < 30; i++) {
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *
 *   const { status, result } = await getASRTaskResult(taskId);
 *
 *   if (status === 2 && result) {
 *     console.log('识别完成:', result.fullText);
 *     break;
 *   }
 *
 *   if (status === 3) {
 *     console.error('识别失败');
 *     break;
 *   }
 * }
 * ```
 */
export async function getASRTaskResult(taskId: string): Promise<{ status: number; result?: ASRResult }> {
  // 构造请求参数
  const params = {
    // 任务 ID（需要转换为数字）
    TaskId: parseInt(taskId),
  };

  try {
    // 调用 DescribeTaskStatus API
    // API 文档：https://cloud.tencent.com/document/api/1093/37822
    const data = await client.DescribeTaskStatus(params);

    // 获取任务状态
    // 默认为 3（失败），如果 API 返回异常则认为失败
    const status = data.Data?.Status || 3;

    // 如果识别完成（status = 2），解析结果
    if (status === 2) {
      // 完整文本（所有段落拼接）
      const fullText = data.Data?.Result || "";

      // 解析详细结果（分段 + 时间戳）
      // ResultDetail 字段包含更详细的信息：
      // - 结构化数组（不同 SDK 版本格式不同）
      // - 文本格式（每行一段，含时间戳）
      let segments: ASRSegment[] = [];

      if (data.Data?.ResultDetail) {
        try {
          const rawDetail = data.Data.ResultDetail;
          segments = parseTencentSegments(rawDetail);
        } catch (e) {
          console.warn("Failed to parse ASR ResultDetail:", e);
        }
      }

      return {
        status,
        result: {
          fullText,
          segments,
        },
      };
    }

    // 其他状态（待处理、运行中、失败）只返回状态
    return { status };
  } catch (err: any) {
    console.error("Tencent ASR Get Result Error:", err);
    throw err;
  }
}

/**
 * 解析腾讯云 ASR 结果详情
 *
 * 业务意图：
 * ---------
 * 腾讯云 ASR 的 ResultDetail 字段格式不统一，需要兼容多种格式：
 * 1. 结构化数组（推荐）：[{ StartTime, EndTime, Text, SpeakerId }, ...]
 * 2. 文本格式：`[0:0.000,0:2.440]  你好世界\n[0:2.440,0:5.000]  欢迎使用`
 * 3. 其他格式：兜底处理
 *
 * 解析逻辑：
 * ---------
 * 1. 优先按结构化数组解析
 * 2. 如果是字符串，尝试正则匹配时间戳
 * 3. 都失败则返回纯文本（start=0, end=0）
 *
 * 边界条件：
 * ---------
 * - 空数组/空字符串：返回空数组
 * - 字段名大小写不一致：兼容多种命名（StartTime/start_time/Start）
 * - 时间戳格式不一致：支持 `[分:秒,分:秒]` 和纯秒数
 *
 * @param detail - 原始的 ResultDetail 数据
 * @returns ASRSegment[] - 解析后的片段数组
 */
function parseTencentSegments(detail: unknown): ASRSegment[] {
  // ========================================================================
  // 情况 1: 结构化数组（推荐格式）
  // ========================================================================

  // SDK 版本或返回格式可能导致字段名不同
  // 兼容的字段名：
  // - 时间：StartTime/start_time/Start
  // - 文本：Text/text/Sentence
  // - 说话人：SpeakerId/speaker_id/Speaker
  if (Array.isArray(detail)) {
    return (detail as any[])
      .map((s) => {
        const start = Number(s?.StartTime ?? s?.start_time ?? s?.Start ?? 0);
        const end = Number(s?.EndTime ?? s?.end_time ?? s?.End ?? 0);
        const text = String(s?.Text ?? s?.text ?? s?.Sentence ?? "").trim();
        const speaker = s?.SpeakerId != null ? String(s.SpeakerId) : undefined;
        return { start, end, text, speaker } as ASRSegment;
      })
      .filter((s) => s.text); // 过滤空文本
  }

  // ========================================================================
  // 情况 2: 文本格式（常见格式）
  // ========================================================================

  // 格式示例：
  // [0:0.000,0:2.440]  你好世界
  // [0:2.440,0:5.000]  欢迎使用腾讯云ASR
  //
  // 正则解析：
  // - (\d+): 匹配分钟数
  // - (\d+\.\d+): 匹配秒数（带小数）
  // - (.+): 匹配文本内容
  if (typeof detail === "string") {
    const lines = detail.split("\n").filter((l) => l.trim());
    return lines
      .map((line) => {
        const match = line.match(/\[(\d+):(\d+\.\d+),(\d+):(\d+\.\d+)\]\s+(.*)/);
        if (match) {
          const startMin = parseInt(match[1]);
          const startSec = parseFloat(match[2]);
          const endMin = parseInt(match[3]);
          const endSec = parseFloat(match[4]);
          const text = match[5];

          return {
            start: startMin * 60 + startSec,
            end: endMin * 60 + endSec,
            text: text.trim(),
          } as ASRSegment;
        }
        // 如果没有匹配到时间戳格式，返回纯文本（时间戳为 0）
        return { start: 0, end: 0, text: line } as ASRSegment;
      })
      .filter((s) => s.text);
  }

  // ========================================================================
  // 情况 3: 兜底处理（无法解析的结构）
  // ========================================================================

  try {
    const text = detail == null ? "" : JSON.stringify(detail);
    return text ? [{ start: 0, end: 0, text }] : [];
  } catch {
    return [];
  }
}

/**
 * 一键触发并等待 ASR 结果（长轮询）
 *
 * 业务意图：
 * ---------
 * 封装完整的 ASR 转写流程，包括提交任务和轮询等待结果。
 * 适用于简单的同步场景。
 *
 * ⚠️ Serverless 环境风险：
 * --------------------------
 * 这个函数使用轮询方式（polling）等待结果，可能在 Serverless 环境
 * （如 Vercel）中遇到以下问题：
 * 1. 函数执行超时（通常 10-60 秒）
 * 2. 长时间等待消耗计算时间
 * 3. 成本增加（按执行时间计费）
 *
 * 生产环境建议：
 * ---------------
 * 1. **Webhook 模式**：使用腾讯云的回调通知，不用轮询
 * 2. **异步处理**：在后台任务中轮询，前端通过轮询 API 查询状态
 * 3. **队列系统**：使用 Bull/Redis 等队列管理长时间任务
 *
 * 轮询策略：
 * ---------
 * - 每 2 秒查询一次
 * - 最多轮询 30 次（约 60 秒）
 * - 如果超时或失败，抛出错误
 *
 * @param url - 音频/视频文件的 URL
 * @param maxRetries - 最大轮询次数（默认 30 次）
 * @returns Promise<ASRResult> - 识别结果
 * @throws {Error} - 当任务超时或失败时抛出
 *
 * @example
 * ```ts
 * import { transcribeAudio } from '@/lib/services/tencent-asr';
 *
 * try {
 *   const result = await transcribeAudio('https://example.com/video.mp4');
 *   console.log('转写完成:', result.fullText);
 *   console.log('分段数:', result.segments.length);
 * } catch (error) {
 *   console.error('转写失败:', error);
 * }
 * ```
 */
export async function transcribeAudio(url: string, maxRetries = 30): Promise<ASRResult> {
  // Step 1: 提交 ASR 任务
  const taskId = await createASRTask(url);

  // Step 2: 轮询查询结果
  for (let i = 0; i < maxRetries; i++) {
    // 等待 2 秒后再次查询
    // 避免频繁调用 API（腾讯云有 QPS 限制）
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { status, result } = await getASRTaskResult(taskId);

    // 如果识别完成，返回结果
    if (status === 2 && result) {
      return result;
    }

    // 如果识别失败，抛出错误
    if (status === 3) {
      throw new Error("ASR task failed");
    }
  }

  // 轮询超时
  throw new Error("ASR task timed out");
}
