/**
 * Tingwu API HTTP client thin wrapper.
 *
 * 用 @alicloud/openapi-client 做签名 + HTTP 调用。
 * Tingwu 是 ROA 风格 OpenAPI：
 *   - PUT  /openapi/tingwu/v2/tasks         → 创建任务（action='put'）
 *   - GET  /openapi/tingwu/v2/tasks/{TaskId} → 查询任务（action=taskId）
 *
 * 隔离原因：方便 TingwuAdapter 测试时 vi.mock 整个 callTingwu，不必 mock SDK 细节。
 *
 * API 文档：https://help.aliyun.com/zh/tingwu/api-and-sdks
 */

import Client, { Config, Params, OpenApiRequest } from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';

let cachedClient: Client | null = null;
let cachedClientFor: string | null = null;

function getClient(): Client {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  const region = process.env.ALIBABA_CLOUD_REGION || 'cn-beijing';

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('Aliyun credentials missing (ALIBABA_CLOUD_ACCESS_KEY_ID / _SECRET)');
  }

  const cacheKey = `${accessKeyId}:${region}`;
  if (cachedClient && cachedClientFor === cacheKey) return cachedClient;

  const config = new Config({
    accessKeyId,
    accessKeySecret,
    endpoint: `tingwu.${region}.aliyuncs.com`,
  });
  cachedClient = new Client(config);
  cachedClientFor = cacheKey;
  return cachedClient;
}

/**
 * 测试用：清掉 client 缓存（让测试能改 env 再重新构造）
 */
export function _resetTingwuClientCache() {
  cachedClient = null;
  cachedClientFor = null;
}

/**
 * 调通义听悟 OpenAPI。
 *
 * @param action - 'put' 代表 PUT /tasks（创建任务）；其余字符串视为 taskId 走 GET /tasks/{taskId}
 * @param body   - PUT 时为任务参数；GET 时通常传空对象
 */
export async function callTingwu(action: string, body: Record<string, unknown>): Promise<any> {
  const client = getClient();
  const runtime = new RuntimeOptions({
    connectTimeout: 10_000,
    readTimeout: 30_000,
  });

  if (action === 'put') {
    const params = new Params({
      action: 'CreateTask',
      version: '2023-09-30',
      protocol: 'HTTPS',
      pathname: '/openapi/tingwu/v2/tasks',
      method: 'PUT',
      authType: 'AK',
      style: 'ROA',
      reqBodyType: 'json',
      bodyType: 'json',
    });
    const request = new OpenApiRequest({
      query: { type: 'offline' },
      body,
    });
    return await client.callApi(params, request, runtime);
  }

  // 其余作为 taskId 走 GET
  const taskId = action;
  const params = new Params({
    action: 'GetTaskInfo',
    version: '2023-09-30',
    protocol: 'HTTPS',
    pathname: `/openapi/tingwu/v2/tasks/${encodeURIComponent(taskId)}`,
    method: 'GET',
    authType: 'AK',
    style: 'ROA',
    reqBodyType: 'json',
    bodyType: 'json',
  });
  const request = new OpenApiRequest({});
  return await client.callApi(params, request, runtime);
}
