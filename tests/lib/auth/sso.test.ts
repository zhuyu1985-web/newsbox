import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sanitizeRedirectPath } from "@/lib/auth/sso";
import {
  mobileToSystemEmail,
  parseCmcAuthResponse,
} from "@/lib/auth/sso/parse-response";
import { buildSignedAuthUrl, urlEncode } from "@/lib/auth/sso/signature";

const SAMPLE_CMC_RESPONSE = {
  code: 10000,
  message: "操作成功",
  data: {
    login_id: "a322c61bbc5503d4f56526972a4863c1",
    login_tid: "38085c4d1ad2723283e2da69f7415e71",
    login_name: "cmc96670a2d",
    user_info: {
      id: "3",
      login_name: "cmc96670a2d",
      user_nick: "开发人员",
      real_name: "开发",
      user_pic: "https://image.xadev.chinamcloud.cn/cmc/default/console/default_header.png",
      user_mobile: "18200121923",
      user_email: "",
    },
  },
};

describe("mobileToSystemEmail", () => {
  it("converts mobile to gmail.com email", () => {
    expect(mobileToSystemEmail("18200121923")).toBe("18200121923@gmail.com");
  });
});

describe("parseCmcAuthResponse", () => {
  it("parses CMC response with user_info node", () => {
    const user = parseCmcAuthResponse(
      SAMPLE_CMC_RESPONSE,
      "fallback-login-id"
    );

    expect(user.login_id).toBe("a322c61bbc5503d4f56526972a4863c1");
    expect(user.email).toBe("18200121923@gmail.com");
    expect(user.full_name).toBe("cmc96670a2d");
    expect(user.avatar_url).toBe(
      "https://image.xadev.chinamcloud.cn/cmc/default/console/default_header.png"
    );
  });

  it("accepts code 10000 as success", () => {
    expect(() =>
      parseCmcAuthResponse(SAMPLE_CMC_RESPONSE, "fallback")
    ).not.toThrow();
  });

  it("throws on non-success code", () => {
    expect(() =>
      parseCmcAuthResponse(
        { code: 401, message: "ticket expired", data: {} },
        "fallback"
      )
    ).toThrow("ticket expired");
  });

  it("falls back to login_id@domain when mobile is missing", () => {
    const user = parseCmcAuthResponse(
      {
        code: 10000,
        data: { login_id: "abc", user_info: { user_mobile: "" } },
      },
      "fallback"
    );
    expect(user.email).toBe("abc@sso.newsbox.local");
  });
});

describe("urlEncode", () => {
  it("matches Java URLEncoder style for common values", () => {
    expect(urlEncode("JSON")).toBe("JSON");
    expect(urlEncode("HMAC-SHA1")).toBe("HMAC-SHA1");
    expect(urlEncode("a b")).toBe("a+b");
  });
});

describe("buildSignedAuthUrl", () => {
  it("builds deterministic signed GET url", () => {
    const url = buildSignedAuthUrl("https://xxx/cmc/login/get-login-auth", {
      login_id: "6512f7335abd96545e1cad69308b036c",
      login_tid: "75a985d410fccf8cbe483e3667e1cab3",
      accessKeyId: "test-ak",
      accessKeySecret: "test-sk",
      serviceKey: "xcgk",
      timestamp: "1710000000",
      signatureNonce: "abc123nonce",
    });

    expect(url).toContain("Signature=");
  });
});

describe("sanitizeRedirectPath", () => {
  it("defaults to dashboard", () => {
    expect(sanitizeRedirectPath(undefined)).toBe("/dashboard");
  });
});

describe("fetchBusinessUserInfo", () => {
  beforeEach(() => {
    vi.stubEnv(
      "SSO_USER_INFO_API_URL",
      "https://biz.example.com/cmc/login/get-login-auth"
    );
    vi.stubEnv("SSO_ACCESS_KEY_ID", "test-ak");
    vi.stubEnv("SSO_ACCESS_KEY_SECRET", "test-sk");
    vi.stubEnv("SSO_SERVICE_KEY", "xcgk");
    vi.stubEnv("SSO_EMAIL_SUFFIX", "gmail.com");
    vi.stubEnv("SSO_API_TIMEOUT_MS", "5000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses signed GET request and parses CMC payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(SAMPLE_CMC_RESPONSE),
      })
    );

    const { fetchBusinessUserInfo } = await import("@/lib/auth/sso/business-client");
    const user = await fetchBusinessUserInfo({
      login_id: "a322c61bbc5503d4f56526972a4863c1",
      login_tid: "38085c4d1ad2723283e2da69f7415e71",
    });

    expect(user.email).toBe("18200121923@gmail.com");
    expect(user.full_name).toBe("cmc96670a2d");
  });
});
