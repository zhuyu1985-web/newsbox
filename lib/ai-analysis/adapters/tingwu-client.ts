/**
 * Tingwu API HTTP client thin wrapper.
 *
 * 这里用 ROA 风格的 OpenAPI 调用：
 * - 主入口 https://tingwu.cn-beijing.aliyuncs.com/openapi/tingwu/v2/tasks/{action}
 * - signature 由 @alicloud/openapi-client 自动处理
 *
 * 隔离原因：方便测试时 mock 整个 callTingwu，不用 mock OpenAPI SDK 细节。
 */
import Credential from '@alicloud/credentials';
// 注意：实际 SDK 用法以阿里云官方文档为准，这里给最小可行版本
// 如果文档要求别的 client class，构造方式按文档调整

export async function callTingwu(action: string, body: Record<string, unknown>): Promise<any> {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  const region = process.env.ALIBABA_CLOUD_REGION || 'cn-beijing';

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('Aliyun credentials missing');
  }

  // 简化的 HTTP 调用（生产应使用阿里云 SDK 的 RPCClient/ROAClient）
  const url = `https://tingwu.${region}.aliyuncs.com/openapi/tingwu/v2/tasks/${action}`;
  // 签名细节：实际接入时使用 @alicloud/openapi-client 的 Client.callApi()
  // 此处仅占位；TingwuAdapter 测试 mock 了 callTingwu 整体，故无需 mock 签名

  // TODO(spike): 用 @alicloud/openapi-client 构造 Client，调 client.callApi()
  throw new Error('callTingwu HTTP body not implemented; use @alicloud/openapi-client Client.callApi at integration time');
}
