import { createHmac, randomUUID } from "crypto";

/**
 * 对齐 Java URLCodec.encode(str, "UTF-8") / URLEncoder 行为。
 */
export function urlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, "+")
    .replace(/%21/g, "!")
    .replace(/%27/g, "'")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%7E/g, "~");
}

export interface SignedAuthParams {
  login_id: string;
  login_tid: string;
  accessKeyId: string;
  accessKeySecret: string;
  serviceKey: string;
  timestamp?: string;
  signatureNonce?: string;
}

/**
 * 按业务系统 Java Signature 样例生成带签名的 GET 请求 URL。
 *
 * 签名串：GET&%2F&{urlEncode(sortedKeyValuePairs)}
 * 算法：HMAC-SHA1(accessKeySecret + "&") → Base64
 */
export function buildSignedAuthUrl(
  baseUrl: string,
  input: SignedAuthParams
): string {
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signatureNonce = input.signatureNonce ?? randomUUID().replace(/-/g, "");

  const parameters: Record<string, string> = {
    login_id: input.login_id,
    login_tid: input.login_tid,
    AccessKeyId: input.accessKeyId,
    ServiceKey: input.serviceKey,
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    Timestamp: timestamp,
    SignatureVersion: "1.0",
    SignatureNonce: signatureNonce,
  };

  const sortedKeys = Object.keys(parameters).sort();
  const canonical = sortedKeys
    .map((key) => `${urlEncode(key)}=${urlEncode(parameters[key])}`)
    .join("&");

  const stringToSign = `GET&%2F&${urlEncode(canonical)}`;
  const signature = createHmac("sha1", `${input.accessKeySecret}&`)
    .update(stringToSign, "utf8")
    .digest("base64");

  parameters.Signature = signature;

  const query = Object.entries(parameters)
    .map(([key, value]) => `${key}=${urlEncode(value)}`)
    .join("&");

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${query}`;
}
