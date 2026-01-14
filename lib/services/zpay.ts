/**
 * z-pay 支付服务
 * 集成 z-pay 聚合支付（支付宝 + 微信）
 */

import { createHash } from "crypto";

// ============================================================================
// 类型定义
// ============================================================================

export type PayType = "alipay" | "wxpay";

export interface ZPayConfig {
  pid: string;
  key: string;
  notifyUrl: string;
  returnUrl: string;
  submitUrl?: string;
}

export interface CreateOrderParams {
  outTradeNo: string;
  name: string;
  money: string;
  type: PayType;
  param?: string;
}

export interface ZPayParams {
  pid: string;
  name: string;
  money: string;
  type: PayType;
  out_trade_no: string;
  notify_url: string;
  return_url: string;
  param?: string;
  sign?: string;
  sign_type?: string;
}

export interface ZPayNotifyParams {
  pid: string;
  name: string;
  money: string;
  out_trade_no: string;
  trade_no: string;
  param?: string;
  trade_status: string;
  type: PayType;
  sign: string;
  sign_type: string;
}

// ============================================================================
// 环境配置
// ============================================================================

const DEFAULT_SUBMIT_URL = "https://z-pay.cn/submit.php";

function getConfig(): ZPayConfig {
  const pid = process.env.ZPAY_PID;
  const key = process.env.ZPAY_PKEY; // 注意是 PKEY 不是 KEY
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!pid || !key) {
    throw new Error("Missing ZPAY_PID or ZPAY_PKEY environment variables");
  }

  return {
    pid,
    key,
    notifyUrl: `${baseUrl}/api/payment/notify`,
    returnUrl: `${baseUrl}/api/payment/return`,
    submitUrl: DEFAULT_SUBMIT_URL,
  };
}

// ============================================================================
// 签名函数
// ============================================================================

/**
 * 生成签名字符串
 * 按 ASCII 顺序排序参数，拼接成 a=b&c=d 格式
 */
function buildSignString(params: Record<string, string | undefined>): string {
  const sortedKeys = Object.keys(params)
    .filter(
      (key) =>
        key !== "sign" &&
        key !== "sign_type" &&
        params[key] !== undefined &&
        params[key] !== ""
    )
    .sort();

  return sortedKeys.map((key) => `${key}=${params[key]}`).join("&");
}

/**
 * 生成 MD5 签名
 */
export function generateSign(
  params: Record<string, string | undefined>,
  key: string
): string {
  const signString = buildSignString(params);
  const signSource = signString + key;
  return createHash("md5").update(signSource).digest("hex").toLowerCase();
}

/**
 * 验证签名
 */
export function verifySign(
  params: Record<string, string | undefined>,
  sign: string,
  key: string
): boolean {
  const expectedSign = generateSign(params, key);
  return expectedSign === sign.toLowerCase();
}

// ============================================================================
// 支付 URL 生成
// ============================================================================

/**
 * 生成支付 URL
 */
export function generatePaymentUrl(params: CreateOrderParams): string {
  const config = getConfig();

  const payParams: ZPayParams = {
    pid: config.pid,
    name: params.name,
    money: params.money,
    type: params.type,
    out_trade_no: params.outTradeNo,
    notify_url: config.notifyUrl,
    return_url: config.returnUrl,
  };

  if (params.param) {
    payParams.param = params.param;
  }

  const sign = generateSign(
    payParams as unknown as Record<string, string>,
    config.key
  );

  const signedParams = {
    ...payParams,
    sign,
    sign_type: "MD5",
  };

  const queryString = Object.entries(signedParams)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join("&");

  return `${config.submitUrl}?${queryString}`;
}

// ============================================================================
// 回调验证
// ============================================================================

/**
 * 验证支付回调通知
 */
export function verifyNotify(params: ZPayNotifyParams): {
  valid: boolean;
  error?: string;
} {
  const config = getConfig();

  // 检查必要参数
  if (!params.sign) {
    return { valid: false, error: "Missing sign parameter" };
  }

  if (!params.out_trade_no) {
    return { valid: false, error: "Missing out_trade_no parameter" };
  }

  // 验证签名
  const paramsForSign: Record<string, string | undefined> = {
    pid: params.pid,
    name: params.name,
    money: params.money,
    out_trade_no: params.out_trade_no,
    trade_no: params.trade_no,
    trade_status: params.trade_status,
    type: params.type,
  };

  if (params.param) {
    paramsForSign.param = params.param;
  }

  if (!verifySign(paramsForSign, params.sign, config.key)) {
    return { valid: false, error: "Invalid signature" };
  }

  // 检查支付状态
  if (params.trade_status !== "TRADE_SUCCESS") {
    return { valid: false, error: `Invalid trade status: ${params.trade_status}` };
  }

  return { valid: true };
}

/**
 * 验证同步跳转参数
 */
export function verifyReturn(params: Record<string, string>): {
  valid: boolean;
  error?: string;
} {
  const config = getConfig();

  if (!params.sign) {
    return { valid: false, error: "Missing sign parameter" };
  }

  const paramsForSign: Record<string, string | undefined> = { ...params };
  delete paramsForSign.sign;
  delete paramsForSign.sign_type;

  if (!verifySign(paramsForSign, params.sign, config.key)) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成唯一订单号
 * 格式：日期时间 + 随机数
 */
export function generateOutTradeNo(): string {
  const now = new Date();
  const dateStr = now
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `${dateStr}${random}`;
}

/**
 * 获取 z-pay 配置（仅在服务端使用）
 */
export function getZPayConfig(): ZPayConfig {
  return getConfig();
}
