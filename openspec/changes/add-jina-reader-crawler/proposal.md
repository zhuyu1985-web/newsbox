# Change: 使用 Jina Reader 替换基础爬虫并统一内容格式化

## Why

当前系统使用原生 fetch + Cheerio 的基础爬虫方案存在以下问题：

1. **成功率低**：只能处理静态 HTML，无法抓取 SPA（单页应用）和动态加载内容
2. **反爬能力弱**：容易被 Cloudflare、验证码等反爬机制拦截
3. **内容质量不稳定**：提取算法简单，经常包含广告、导航栏等噪音内容
4. **格式不统一**：不同网站的内容格式差异大，影响阅读体验

通过集成 Jina Reader API，可以：
- **提升成功率**：从约 70% 提升到 95%+
- **改善内容质量**：专业的阅读模式算法，自动过滤噪音
- **统一展现格式**：所有文章统一使用新闻详情页标准样式
- **降低维护成本**：无需维护复杂的抓取逻辑

## What Changes

### 核心变更

1. **替换爬虫引擎**
   - 移除当前 `app/api/capture/route.ts` 中的基础 fetch 抓取逻辑
   - 集成 Jina Reader API 作为主要抓取引擎
   - 保留视频平台检测逻辑（B站、YouTube、抖音、快手）

2. **新增 Jina Reader 服务层**
   - 创建 `lib/services/jina-reader.ts` 封装 Jina Reader API 调用
   - 支持配置化：API Key、超时时间、返回格式等
   - 实现错误处理和降级策略

3. **内容格式化增强**
   - 升级 `lib/services/html-sanitizer.ts`
   - 实现新闻样式格式化处理器
   - 统一应用 `docs/tec-news-reader-style.md` 中定义的样式规范

4. **阅读器样式优化**
   - 更新 `components/reader/ContentStage/ArticleReader.tsx`
   - 应用新闻详情页标准样式类
   - 支持响应式布局（PC/平板/手机）

### 受影响的文件

**新增：**
- `lib/services/jina-reader.ts` - Jina Reader API 封装
- `lib/styles/news-reader.css` - 新闻详情页样式（可选，如果不用 Tailwind）

**修改：**
- `app/api/capture/route.ts` - 替换爬虫逻辑
- `lib/services/html-sanitizer.ts` - 增强格式化功能
- `components/reader/ContentStage/ArticleReader.tsx` - 应用新样式
- `.env.example` - 添加 JINA_API_KEY 说明

**配置依赖：**
- 环境变量 `JINA_API_KEY` 已在 `.env.local` 配置

## Impact

### 受影响的规格
- **capture** (MODIFIED) - 更新内容抓取要求和实现方式

### 受影响的代码
- 内容抓取 API (`app/api/capture/route.ts`)
- HTML 清理服务 (`lib/services/html-sanitizer.ts`)
- 文章阅读器组件 (`components/reader/ContentStage/ArticleReader.tsx`)

### 用户体验改进
- ✅ 内容抓取成功率提升 25%（70% → 95%）
- ✅ 文章阅读体验统一，符合新闻详情页标准
- ✅ 减少噪音内容（广告、导航栏等）
- ✅ 响应式设计，适配各种设备

### 技术债务
- ⚠️ 引入外部 API 依赖（Jina Reader）
- ⚠️ 需要 API Key 管理（已配置）
- ⚠️ API 调用成本：约 $20/月（基于 10000 次/月预估）

### 兼容性
- ✅ 向后兼容：现有笔记不受影响
- ✅ 降级策略：Jina Reader 失败时仍保存 URL

### 风险与缓解
1. **风险**：Jina Reader API 不可用
   - **缓解**：保留基础爬虫作为降级方案

2. **风险**：API 调用超时
   - **缓解**：设置 15 秒超时，提示用户稍后重试

3. **风险**：API 配额耗尽
   - **缓解**：监控使用量，设置告警阈值

## Success Criteria

1. **功能完整性**
   - [ ] 成功集成 Jina Reader API
   - [ ] 视频平台检测正常工作（B站、YouTube 等）
   - [ ] 内容格式化符合新闻样式规范

2. **性能指标**
   - [ ] 抓取成功率 ≥ 95%
   - [ ] 平均响应时间 ≤ 3 秒
   - [ ] API 错误率 < 5%

3. **用户体验**
   - [ ] 文章排版清晰，可读性强
   - [ ] 移动端展示良好
   - [ ] 无样式冲突或错位

4. **代码质量**
   - [ ] 通过 TypeScript 类型检查
   - [ ] 代码符合项目规范
   - [ ] 错误处理完善

## Migration Plan

### 阶段 1：开发与测试（第 1 周）
1. 实现 Jina Reader 服务层
2. 更新 capture API
3. 增强内容格式化
4. 本地测试验证

### 阶段 2：部署与监控（第 2 周）
1. 部署到生产环境
2. 监控 API 调用情况
3. 收集用户反馈
4. 根据反馈优化

### 回滚计划
如果出现严重问题：
1. 回退 `app/api/capture/route.ts` 到旧版本
2. 禁用 Jina Reader 调用
3. 恢复基础爬虫逻辑

## Open Questions

无（需求已明确）
