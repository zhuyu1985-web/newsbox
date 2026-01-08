# 平台特定爬虫实施总结

## 实施日期
2026-01-08

## 实施目标
针对主流中文新闻平台（腾讯新闻、微信公众号、今日头条）实现定制化爬虫逻辑，优先保障这些平台的内容抓取质量。

---

## 一、已完成工作

### ✅ 1. 创建平台特定爬虫服务
**文件**: `lib/services/platform-crawlers.ts` (新增)

#### 核心功能
- **平台检测**: `detectPlatform(url)` - 自动识别 URL 所属平台
- **腾讯新闻爬虫**: `crawlTencentNews(html)`
  - 标题: `#article-title`
  - 正文: `#article-content`
  - 作者/时间: `#article-author`
  - 站点名称: "腾讯新闻"

- **微信公众号爬虫**: `crawlWeixinArticle(html)`
  - 标题: `#activity-name` 或 `h1.rich_media_title`
  - 正文: `#js_content`
  - 作者/时间: `#meta_content`
  - **防盗链处理**: 自动为所有图片添加 `referrerpolicy="no-referrer"`
  - **延迟加载处理**: 处理微信的 `data-src` 属性
  - 站点名称: "微信公众号"

- **今日头条爬虫**: `crawlToutiaoArticle(html)`
  - 标题: `h1`
  - 正文: `article.syl-article-base` 或 `article.tt-article-content`
  - 作者/时间: `.article-meta`
  - 站点名称: "今日头条"

#### 技术实现
- **时间解析**: `parsePublishTime()` - 支持多种中文日期格式
  - `2026-01-08 12:34:56`
  - `2026年01月08日 12:34`
  - `01-08 12:34`（当年）
- **统一接口**: `PlatformCrawlResult` - 标准化返回数据结构
- **类型安全**: 完整的 TypeScript 类型定义

---

### ✅ 2. 集成到 Capture API
**文件**: `app/api/capture/route.ts` (修改)

#### 爬虫优先级策略（三层回退机制）
```
1. 平台特定爬虫（腾讯/微信/头条）
   ↓ 失败
2. Jina Reader API（通用高质量爬虫）
   ↓ 失败
3. 基础爬虫（fetch + Cheerio）
```

#### 核心逻辑
```typescript
// 检测平台
const platform = detectPlatform(targetUrl);
const isPlatformSupported = isSupportedPlatform(targetUrl);

// 策略1: 支持的平台优先使用平台爬虫
if (isPlatformSupported) {
  try {
    html = await fetch(targetUrl);
    const platformResult = crawlPlatformContent(targetUrl, html);
    // 使用平台爬虫结果
  } catch (platformError) {
    // 回退到 Jina Reader
    const jinaResult = await extractWithJinaReader(targetUrl);
    // 使用 Jina Reader 结果
  }
} else {
  // 策略2: 非平台网站直接使用 Jina Reader
  const jinaResult = await extractWithJinaReader(targetUrl);
}

// 策略3: 如果都失败，使用基础爬虫（原有逻辑）
```

---

### ✅ 3. 数据库时间字段处理
**验证结果**: 数据库已包含所有必要字段 ✅

#### 时间字段说明
| 字段 | 含义 | 来源 | 显示优先级 |
|------|------|------|-----------|
| `published_at` | 源文章发布时间 | 网页提取 | **最高** |
| `captured_at` | 内容抓取时间 | 系统生成 | 中 |
| `created_at` | 笔记创建时间 | 数据库默认 | 最低 |
| `updated_at` | 最后修改时间 | 触发器自动更新 | - |

#### 实现细节
- **published_at**: 由平台爬虫或 Jina Reader 从网页元数据中提取
- **captured_at**: 在 Capture API 中设置为当前时间 `new Date().toISOString()`
- **created_at**: 数据库默认值 `NOW()`
- **updated_at**: 由 PostgreSQL 触发器自动更新

---

### ✅ 4. 文档更新
**文件**: `CLAUDE.md` (修改)

#### 更新内容
1. **项目架构** - 添加 `platform-crawlers.ts` 到服务层
2. **服务层说明** - 详细说明三个平台的爬虫实现
3. **数据库说明** - 添加时间字段的详细说明和显示优先级
4. **环境变量** - JINA_API_KEY 文档保持最新

---

## 二、技术要点

### 1. 微信公众号防盗链处理
```typescript
// 关键代码
contentDiv.find("img").each((_, img) => {
  const $img = $(img);
  $img.attr("referrerpolicy", "no-referrer");  // 绕过防盗链

  // 处理延迟加载
  const dataSrc = $img.attr("data-src");
  if (dataSrc && !$img.attr("src")) {
    $img.attr("src", dataSrc);
  }
});
```

### 2. 时间解析兼容性
支持多种中文日期格式，确保在不同场景下都能正确提取发布时间：
- ISO 格式: `2026-01-08 12:34:56`
- 中文格式: `2026年01月08日 12:34`
- 短格式: `01-08 12:34`（自动补全年份）

### 3. 容错机制
- **平台爬虫失败** → 自动回退到 Jina Reader
- **Jina Reader 失败** → 自动回退到基础爬虫
- **多层保障**: 确保即使所有高级爬虫失败，仍能抓取到基础内容

---

## 三、文件变更清单

### 新增文件
| 文件路径 | 说明 | 行数 |
|---------|------|------|
| `lib/services/platform-crawlers.ts` | 平台特定爬虫服务 | ~500 |

### 修改文件
| 文件路径 | 主要变更 |
|---------|---------|
| `app/api/capture/route.ts` | 集成平台爬虫优先级逻辑 |
| `CLAUDE.md` | 更新架构文档和时间字段说明 |

---

## 四、测试建议

### 手动测试用例

#### 腾讯新闻测试
```bash
# 测试 URL
https://news.qq.com/rain/a/20260107A07EHC00
https://news.qq.com/rain/a/20260107A07EHH00
https://news.qq.com/rain/a/20260108A035KI00
```

**验证点**:
- ✅ 标题正确提取
- ✅ 正文完整显示
- ✅ 作者信息显示
- ✅ 发布时间正确（published_at 字段）
- ✅ 站点名称显示为"腾讯新闻"

#### 微信公众号测试
```bash
# 测试 URL
https://mp.weixin.qq.com/s/JbSgMyU2q7bMs-R3e0QAMw
https://mp.weixin.qq.com/s/YvGvhovfjq-LWA6Wuupj3A
https://mp.weixin.qq.com/s/jQe7WIgdxZW5ict6369aeQ
```

**验证点**:
- ✅ 标题正确提取
- ✅ 正文完整显示
- ✅ 图片正常加载（无防盗链问题）
- ✅ 作者信息显示
- ✅ 发布时间正确
- ✅ 站点名称显示为"微信公众号"

#### 今日头条测试
```bash
# 测试 URL
https://www.toutiao.com/article/7592873668117414452/
https://www.toutiao.com/article/7592802960543908395/
```

**验证点**:
- ✅ 标题正确提取
- ✅ 正文完整显示
- ✅ 作者信息显示
- ✅ 发布时间正确
- ✅ 站点名称显示为"今日头条"

---

## 五、兼容性考虑

### PC 端 vs 移动端
当前实现主要针对 **PC 端**网页结构。

**扩展建议**:
```typescript
// 未来可以通过 User-Agent 检测移动端
const isMobile = /mobile|android|iphone/i.test(headers['user-agent']);

// 为移动端使用不同的选择器
if (isMobile) {
  // 使用移动端特定的 DOM 选择器
}
```

### 格式变化的容错
如果平台更新 DOM 结构，现有逻辑会：
1. 平台爬虫返回 `null`
2. 自动回退到 Jina Reader
3. 再回退到基础爬虫

**多层保障确保不会因平台改版而完全失效**。

---

## 六、部署检查清单

### 开发环境 ✅
- [x] 代码编译通过
- [x] TypeScript 类型检查通过
- [x] 新增文件已创建
- [x] 文档已更新

### 生产环境
- [ ] JINA_API_KEY 已配置
- [ ] 数据库时间字段验证
- [ ] 部署后测试三个平台 URL
- [ ] 监控日志确认爬虫优先级正确

---

## 七、后续优化建议

### 1. 移动端适配
- 检测 User-Agent
- 为移动端添加特定的 DOM 选择器
- 测试主流移动浏览器

### 2. 性能优化
- 添加平台爬虫结果缓存
- 实现并发爬取（多个 URL 同时处理）
- 添加超时控制细化

### 3. 监控和统计
- 记录各平台爬虫成功率
- 统计回退到 Jina Reader 的频率
- 监控平均响应时间

### 4. 扩展支持平台
- 新浪新闻
- 网易新闻
- 搜狐新闻
- 知乎专栏
- 简书文章

---

## 八、联系方式

如有问题，请查看：
- 实施代码: `lib/services/platform-crawlers.ts`
- 集成代码: `app/api/capture/route.ts`
- 项目文档: `CLAUDE.md`

---

**实施完成时间**: 2026-01-08
**编译状态**: ✅ 成功
**测试状态**: ⏳ 待手动测试
