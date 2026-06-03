// declarativeNetRequest 动态规则封装
//
// 用途：B 站等防盗链 CDN 直链需要带 Referer。fetch() 把 Referer 列为
// "forbidden header"，service worker 里手动 set header 会被静默剥离 →
// CDN 返回 403。
//
// 解决：在发起 fetch 前，用 chrome.declarativeNetRequest.updateDynamicRules
// 临时插入一条 modifyHeaders 规则，让浏览器在发请求时自动注入 Referer。
// fetch 完成后撤掉规则。
//
// 配套要求：
//   - manifest 里必须有 "declarativeNetRequestWithHostAccess" permission
//   - manifest 的 host_permissions 必须覆盖 targetHost（否则 DNR 不接管）

interface RefererRuleOpts {
  /** Referer 头要写入的值，例如 'https://www.bilibili.com/' */
  referer: string;
  /** 仅命中这个 host 的请求，避免误改其他流量 */
  targetHost: string;
}

// 固定 ID 段：1..99 留给常驻规则；10000..20000 用于 withRefererRule 临时规则
const RULE_ID_HDSLB_REFERER = 1;
const RULE_ID_MIN = 10_000;
const RULE_ID_MAX = 20_000;

/**
 * 常驻 DNR 规则：给 *.hdslb.com（B 站图片 CDN）注入 Referer，
 * 让弹窗预览 / dashboard / 详情页里的 B 站封面都能加载出来。
 * 不命中则会因 hotlink 反盗链返回 403。
 *
 * 调用约定：service worker 启动时调用一次（onInstalled + onStartup）。
 * 用固定 ID + removeRuleIds 同时 add 保证幂等。
 */
export async function installPersistentRules(): Promise<void> {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) return;
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE_ID_HDSLB_REFERER],
      addRules: [
        {
          id: RULE_ID_HDSLB_REFERER,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "Referer",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: "https://www.bilibili.com/",
              },
            ],
          },
          condition: {
            urlFilter: "||hdslb.com^",
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.IMAGE,
              chrome.declarativeNetRequest.ResourceType.MEDIA,
            ],
          },
        },
      ],
    });
  } catch (err) {
    console.warn("[dnr-rules] installPersistentRules failed", err);
  }
}

async function reserveRuleId(): Promise<number> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const used = new Set(existing.map((r) => r.id));
  for (let id = RULE_ID_MIN; id < RULE_ID_MAX; id++) {
    if (!used.has(id)) return id;
  }
  throw new Error("declarativeNetRequest: no free rule id in reserved range");
}

/**
 * 在 fn() 执行期间临时插入 Referer 改写规则；返回前清理。
 * fn() 抛出也会被 finally 兜底清理。
 */
export async function withRefererRule<T>(
  opts: RefererRuleOpts,
  fn: () => Promise<T>,
): Promise<T> {
  // Safari 等部分 MV3 实现可能没有 DNR；降级直接跑 fn（多半会 403，但不阻塞）
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    return fn();
  }

  const ruleId = await reserveRuleId();
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: ruleId,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: "Referer",
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: opts.referer,
            },
          ],
        },
        condition: {
          // ||host^  →  匹配该 host 上的所有请求，与子路径无关
          urlFilter: `||${opts.targetHost}^`,
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.MEDIA,
          ],
        },
      },
    ],
  });

  try {
    return await fn();
  } finally {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ruleId],
      });
    } catch (err) {
      console.warn("[dnr-rules] cleanup failed", err);
    }
  }
}
