# NewsBox 浏览器插件实施计划

> 状态：待确认  
> 范围：Phase 1 — Chrome + Edge 图文抓取  
> 预计模块：extension/ 目录 + 2 个服务端 API

---

## 一、总体架构

```
extension/                         # 插件独立目录（不打包进 Next.js）
├── src/
│   ├── background/
│   │   └── service-worker.ts      # Background SW：API 调用、右键菜单、快捷键
│   ├── content/
│   │   ├── extractor.ts           # DOM 内容提取引擎（核心）
│   │   └── index.ts               # Content Script 入口（接收消息、调用 extractor）
│   ├── popup/
│   │   ├── index.html             # Popup 入口 HTML
│   │   ├── App.tsx                # Popup 根组件
│   │   ├── components/
│   │   │   ├── LoginView.tsx      # 登录表单
│   │   │   ├── SaveView.tsx       # 保存预览（标题、摘要、封面图预览 + 文件夹/标签选择）
│   │   │   ├── SuccessView.tsx    # 保存成功反馈
│   │   │   ├── FolderPicker.tsx   # 文件夹选择器
│   │   │   └── TagPicker.tsx      # 标签选择器（多选 + 新建）
│   │   └── styles/
│   │       └── popup.css          # 从 NewsBox globals.css 提取的设计变量
│   ├── shared/
│   │   ├── api.ts                 # NewsBox API 客户端封装
│   │   ├── auth.ts                # Supabase Auth + token 存储/刷新
│   │   ├── storage.ts             # chrome.storage 封装（token、偏好设置）
│   │   ├── constants.ts           # API URL、Supabase 配置
│   │   ├── theme.ts               # 主题检测与切换
│   │   └── types.ts               # 共享 TypeScript 类型
│   └── icons/                     # 插件图标 16/32/48/128
├── manifest.json                  # Manifest V3
├── tsconfig.json
├── package.json
├── vite.config.ts                 # 构建配置（Vite + CRXJS 或自定义 Rollup）
└── README.md

app/api/extension/                 # 服务端新增 API（在 Next.js 项目内）
├── save/route.ts                  # POST: 接收插件内容，创建 note
└── meta/route.ts                  # GET: 返回用户的文件夹 + 标签列表
```

---

## 二、分步实施任务

### Phase 1-A：基础设施搭建

#### Task 1: 初始化插件工程
- 在项目根目录创建 `extension/` 目录
- 初始化 `package.json`（依赖：vite、@crxjs/vite-plugin 或 rollup-plugin-chrome-extension、typescript、react、tailwindcss）
- 配置 `tsconfig.json`（路径别名 `@shared/`、`@popup/`）
- 配置 `vite.config.ts`（多入口：background、content、popup）
- 配置 Tailwind CSS（复用 NewsBox 的设计变量）

#### Task 2: 编写 Manifest V3
```json
{
  "manifest_version": 3,
  "name": "NewsBox - 网页收藏助手",
  "version": "1.0.0",
  "description": "一键保存网页内容到 NewsBox 笔记库",
  "permissions": ["activeTab", "storage", "contextMenus"],
  "host_permissions": ["https://your-newsbox-domain.com/*"],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/index.ts"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
  },
  "commands": {
    "save-page": {
      "suggested_key": { "default": "Ctrl+Shift+S", "mac": "Command+Shift+S" },
      "description": "保存当前页面到 NewsBox"
    }
  },
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

#### Task 3: 服务端 Token 认证中间件
- 新增 `lib/auth/verify-token.ts`
- 逻辑：从 `Authorization: Bearer <token>` 提取 JWT
- 使用 Supabase Admin Client 验证 token：`supabase.auth.getUser(token)`
- 与现有 cookie 认证并存，API 路由优先检查 Bearer token，无则 fallback 到 cookie

```typescript
// lib/auth/verify-token.ts
export async function verifyExtensionAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createServiceClient(); // 使用 service_role_key
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) return data.user;
  }
  // fallback: cookie-based auth
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
```

---

### Phase 1-B：认证模块

#### Task 4: 插件端 Auth 模块 (`shared/auth.ts`)
- `login(email, password)`: 调用 Supabase Auth REST API (`/auth/v1/token?grant_type=password`)
- `refreshToken()`: 用 refresh_token 换取新 access_token
- `getToken()`: 从 chrome.storage.local 读取 token，如过期自动刷新
- `logout()`: 清除存储的 token
- `isLoggedIn()`: 检查是否有有效 token

```typescript
// 直接调用 Supabase Auth REST API（不依赖 @supabase/supabase-js 以减小体积）
const SUPABASE_URL = "https://xxx.supabase.co";
const SUPABASE_ANON_KEY = "xxx";

async function login(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  // 存储 access_token, refresh_token, expires_at
  await chrome.storage.local.set({
    auth: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      user: { id: data.user.id, email: data.user.email },
    },
  });
}
```

#### Task 5: 插件 LoginView 组件
- 邮箱 + 密码输入框
- 登录按钮（loading 状态）
- 错误提示
- 样式：复用 NewsBox 的 CSS 变量（蓝色主色、圆角、毛玻璃效果）
- 底部：NewsBox logo + 跳转注册链接

---

### Phase 1-C：内容提取引擎

#### Task 6: DOM 提取引擎 (`content/extractor.ts`)

核心提取逻辑，不依赖任何外部库：

```typescript
export interface ExtractedContent {
  url: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  coverImageUrl: string | null;
  author: string | null;
  siteName: string | null;
  publishedAt: string | null;
  contentType: "article" | "video";
}

export function extractPageContent(): ExtractedContent {
  return {
    url: location.href,
    title: extractTitle(),
    excerpt: extractExcerpt(),
    contentHtml: extractMainContent(),
    contentText: extractPlainText(),
    coverImageUrl: extractCoverImage(),
    author: extractAuthor(),
    siteName: extractSiteName(),
    publishedAt: extractPublishedTime(),
    contentType: detectContentType(),
  };
}
```

**提取策略细节**：

| 字段 | 提取优先级 |
|------|-----------|
| title | `og:title` > `<title>` > 第一个 `<h1>` |
| excerpt | `og:description` > `meta[name=description]` > 正文前 200 字 |
| contentHtml | `<article>` > `<main>` > 可读性算法（最大文本密度块） |
| coverImage | `og:image` > `twitter:image` > 正文中第一张大图（宽>300px） |
| author | `meta[name=author]` > `[rel=author]` > `.author` 类名元素 |
| siteName | `og:site_name` > `meta[name=application-name]` > hostname |
| publishedAt | `article:published_time` > `datePublished` (JSON-LD) > `<time>` 标签 |
| contentType | URL 匹配视频平台 → "video"，否则 → "article" |

**可读性算法（简化版）**：
1. 遍历所有 `<div>`, `<section>`, `<article>` 块
2. 计算每个块的「文本密度」= 文本字符数 / (子标签数 + 1)
3. 移除明显的非正文区域（nav, footer, sidebar, ad 关键词）
4. 选择文本密度最高且文本量 > 200 字的块作为正文

#### Task 7: Content Script 入口 (`content/index.ts`)
- 监听来自 Background SW 的消息
- 收到 `EXTRACT_CONTENT` 消息时调用 extractor，返回结果
- 收到 `EXTRACT_SELECTION` 消息时返回选中文本

```typescript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_CONTENT") {
    const content = extractPageContent();
    sendResponse({ success: true, data: content });
  }
  if (msg.type === "EXTRACT_SELECTION") {
    const selection = window.getSelection()?.toString() || "";
    sendResponse({ success: true, data: selection });
  }
  return true; // 保持消息通道
});
```

---

### Phase 1-D：服务端 API

#### Task 8: 保存 API (`app/api/extension/save/route.ts`)

```typescript
// POST /api/extension/save
// Headers: Authorization: Bearer <access_token>
// Body:
{
  source_url: string;           // 必填
  title?: string;
  excerpt?: string;
  content_html?: string;
  content_text?: string;
  cover_image_url?: string;
  author?: string;
  site_name?: string;
  published_at?: string;
  content_type?: "article" | "video";
  folder_id?: string;           // 可选：目标文件夹
  tag_ids?: string[];           // 可选：标签 ID 列表
}

// 逻辑：
// 1. verifyExtensionAuth() 认证
// 2. 检查 source_url 是否已存在（UPSERT 语义：已存在则更新）
// 3. 插入/更新 note 记录
// 4. 如果 tag_ids 有值，写入 note_tags 关联表
// 5. 如果 content_html 为空或过短（<100字），异步触发 /api/capture 补充抓取
// 6. 返回 { success, noteId, isNew }
```

#### Task 9: 元数据 API (`app/api/extension/meta/route.ts`)

```typescript
// GET /api/extension/meta
// Headers: Authorization: Bearer <access_token>
// 返回：
{
  folders: [{ id, name, icon, color, parent_id }],
  tags: [{ id, name, color }],
  user: { id, email }
}
```

用于 Popup 打开时加载文件夹和标签列表供用户选择。

---

### Phase 1-E：Popup UI

#### Task 10: 主题系统 (`shared/theme.ts` + `popup/styles/popup.css`)

从 NewsBox 的 `globals.css` 提取 CSS 变量：

```css
/* popup.css */
:root {
  --background: 210 50% 99%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  --muted: 210 40% 96.1%;
  --border: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 1.25rem;
  --destructive: 0 84.2% 60.2%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --primary: 217.2 91.2% 59.8%;
  --secondary: 217.2 32.6% 17.5%;
  --border: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
}
```

主题检测逻辑：
```typescript
// shared/theme.ts
// 跟随系统主题 + 支持手动切换
function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
// 监听系统主题变化
mediaQuery.addEventListener("change", applyTheme);
```

#### Task 11: SaveView 组件（Popup 核心界面）

布局（宽 360px，高度自适应，最大 520px）：

```
┌────────────────────────────────────┐
│  NewsBox          [🌙/☀️ 主题切换]  │  ← Header
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │ 🖼️ 封面图预览               │  │  ← 封面图（如有）
│  └──────────────────────────────┘  │
│                                    │
│  标题（可编辑）                     │  ← 提取的标题
│  摘要预览（2行截断）                │  ← 提取的摘要
│  来源：siteName · author           │  ← 元信息
│                                    │
│  ┌──────────┐ ┌──────────────────┐ │
│  │ 📁 文件夹 │ │ 未分类        ▾ │ │  ← 文件夹选择
│  └──────────┘ └──────────────────┘ │
│                                    │
│  ┌──────────┐ ┌──────────────────┐ │
│  │ 🏷️ 标签  │ │ 点击添加标签    │ │  ← 标签选择（多选）
│  └──────────┘ └──────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐  │
│  │       保存到 NewsBox          │  │  ← 主操作按钮（蓝色毛玻璃）
│  └──────────────────────────────┘  │
│                                    │
│  [⌨️ Ctrl+Shift+S 快速保存]        │  ← 快捷键提示
└────────────────────────────────────┘
```

**组件样式要点**：
- 卡片：`rounded-[32px]` 大圆角、`backdrop-blur-2xl` 毛玻璃
- 按钮：`bg-blue-600/80 backdrop-blur-md border border-white/20`
- 输入框：`bg-card/30 backdrop-blur-sm border border-blue-200/50`
- 标签 chips：`bg-blue-50/80 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300`
- 动画：简单的 fade-in，不使用 Framer Motion（减小体积）

#### Task 12: FolderPicker 和 TagPicker 组件
- FolderPicker：下拉选择器，支持层级展示（parent_id 缩进）
- TagPicker：多选 chips，支持搜索过滤 + 行内新建标签
- 数据来源：打开 Popup 时调用 `GET /api/extension/meta`

#### Task 13: SuccessView 组件
- 保存成功后显示：绿色勾 + "已保存到 NewsBox"
- 可点击"查看笔记"跳转到 Web 端对应笔记页
- 2 秒后自动关闭 Popup

---

### Phase 1-F：Background Service Worker

#### Task 14: Background SW (`background/service-worker.ts`)

```typescript
// 1. 右键菜单注册
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-newsbox",
    title: "保存到 NewsBox",
    contexts: ["page", "link", "selection"],
  });
});

// 2. 右键菜单点击处理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-to-newsbox") {
    if (info.selectionText) {
      // 保存选中文本为快速笔记
      await saveQuickNote(info.selectionText, tab?.url);
    } else if (info.linkUrl) {
      // 保存链接（URL-only，触发服务端抓取）
      await saveByUrl(info.linkUrl);
    } else {
      // 保存当前页面
      await saveCurrentPage(tab);
    }
  }
});

// 3. 快捷键处理
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-page") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await saveCurrentPage(tab);
    // 通过 chrome.notifications 显示保存结果
  }
});

// 4. 消息路由（Popup ↔ Background ↔ Content Script）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SAVE_PAGE") handleSavePage(msg, sendResponse);
  if (msg.type === "GET_META") handleGetMeta(sendResponse);
  if (msg.type === "LOGIN") handleLogin(msg, sendResponse);
  if (msg.type === "LOGOUT") handleLogout(sendResponse);
  return true;
});
```

#### Task 15: API 客户端 (`shared/api.ts`)

```typescript
const BASE_URL = process.env.NEWSBOX_API_URL; // 编译时注入

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = await getToken(); // 自动刷新
  if (!token) throw new Error("NOT_AUTHENTICATED");
  
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export const api = {
  savePage: (data: SavePageRequest) =>
    apiRequest("/api/extension/save", { method: "POST", body: JSON.stringify(data) }),
  
  getMeta: () =>
    apiRequest("/api/extension/meta"),
};
```

---

### Phase 1-G：构建与发布

#### Task 16: 构建配置
- Vite 多入口打包：background、content、popup 分别输出
- 环境变量：NEWSBOX_API_URL、SUPABASE_URL、SUPABASE_ANON_KEY
- 生产构建：`npm run build` 输出到 `extension/dist/`
- 开发模式：`npm run dev` 支持 HMR（popup 部分）

#### Task 17: Chrome/Edge 打包
- Chrome：`dist/` 目录直接加载或打包为 `.crx`
- Edge：同一份产物，提交到 Microsoft Edge Add-ons
- 构建脚本：`npm run build:chrome`（输出 zip 供商店提交）

---

## 三、实施顺序与依赖关系

```
Task 1 (工程初始化)
  ↓
Task 2 (Manifest)
  ↓
┌─────────────────┬─────────────────┐
│                 │                 │
Task 3 (服务端认证)  Task 6 (提取引擎)
│                 │
Task 4 (插件认证)   Task 7 (Content Script)
│                 │
└────────┬────────┘
         ↓
Task 8 (保存 API) + Task 9 (元数据 API)
         ↓
Task 10 (主题系统)
         ↓
Task 5 (LoginView) + Task 11 (SaveView) + Task 12 (Pickers) + Task 13 (SuccessView)
         ↓
Task 14 (Background SW) + Task 15 (API Client)
         ↓
Task 16 (构建配置) + Task 17 (打包)
```

---

## 四、关键设计决策记录

| # | 决策 | 选项 | 结论 |
|---|------|------|------|
| 1 | 认证方式 | A:内嵌登录 / B:OAuth 弹窗 | **A: 内嵌登录表单** |
| 2 | 内容提取 | A:仅 URL / B:DOM+URL 双通道 / C:仅 DOM | **B: 双通道** |
| 3 | Safari | 同步 / 延后 | **延后到 Phase 2/3** |
| 4 | UI 风格 | 简洁版 / 一致版 | **与 NewsBox 一致：蓝色主色、毛玻璃、亮暗主题** |
| 5 | 保存目标 | 仅默认 / 可选文件夹标签 | **支持文件夹+标签选择** |
| 6 | 插件框架 | 原生 / WXT / Plasmo | 待定（见下方讨论） |

---

## 五、技术选型待讨论

### 插件开发框架

| 选项 | 优点 | 缺点 |
|------|------|------|
| **原生 Manifest V3 + Vite** | 最轻量、无黑盒、完全可控 | 需要手动处理 HMR、多入口 |
| **WXT Framework** | 专为浏览器插件设计、自动 HMR、类型安全 | 额外抽象层、社区相对小 |
| **Plasmo** | React 友好、自动 Manifest 生成、支持多浏览器 | 较重、黑盒度高 |

建议：**原生 Manifest V3 + Vite + React**，保持轻量可控。

---

## 六、Phase 2 展望（视频抓取）

- Content Script 检测视频平台（B站、YouTube、抖音）
- 提取视频 ID、标题、缩略图、时长、UP主信息
- 生成 embed URL 存入 media_url
- Popup 中显示视频缩略图预览
- 复用现有 capture API 的视频处理逻辑

## 七、Phase 3 展望（Safari）

- 使用 `xcrun safari-web-extension-converter` 转换
- 需要 Apple Developer 账号 + Xcode 工程
- 测试 Safari 特有的 API 差异（storage、permissions）
