# Implementation Tasks: Jina Reader 爬虫集成

## 1. 准备工作

- [x] 1.1 验证 JINA_API_KEY 环境变量已配置
- [x] 1.2 安装必要的依赖包（marked 用于 Markdown 转换）
- [x] 1.3 更新 `.env.example` 添加 JINA_API_KEY 说明

## 2. 实现 Jina Reader 服务层

- [x] 2.1 创建 `lib/services/jina-reader.ts` 文件
- [x] 2.2 实现 `JinaReaderResult` 接口定义
- [x] 2.3 实现 `extractWithJinaReader()` 函数
  - [x] 2.3.1 验证 API Key 配置
  - [x] 2.3.2 构造 API 请求（URL、Headers、Timeout）
  - [x] 2.3.3 处理 API 响应并解析 JSON
  - [x] 2.3.4 返回结构化数据
- [x] 2.4 实现错误处理逻辑
  - [x] 2.4.1 API Key 缺失错误
  - [x] 2.4.2 网络超时错误
  - [x] 2.4.3 API 返回错误（401/429/500）
- [x] 2.5 添加 TypeScript 类型定义

## 3. 增强 HTML 格式化服务

- [x] 3.1 在 `lib/services/html-sanitizer.ts` 中导入 `marked` 库
- [x] 3.2 实现 `formatNewsContent()` 函数
  - [x] 3.2.1 Markdown 转 HTML（使用 marked）
  - [x] 3.2.2 调用现有的 `sanitizeHtmlContent()` 清理
  - [x] 3.2.3 返回清理后的 HTML
- [x] 3.3 定义 `NEWS_STYLING_CLASSES` 常量
  - [x] 3.3.1 标题样式（H1-H4）
  - [x] 3.3.2 正文样式（段落、行高、间距）
  - [x] 3.3.3 图片样式（居中、圆角、阴影）
  - [x] 3.3.4 引用样式（左边框、背景色）
  - [x] 3.3.5 列表样式
- [x] 3.4 导出新增的函数和常量

## 4. 更新 Capture API

- [x] 4.1 导入 `extractWithJinaReader` 和 `formatNewsContent`
- [x] 4.2 保留视频平台检测逻辑（不修改）
  - [x] 4.2.1 B站检测
  - [x] 4.2.2 YouTube 检测
  - [x] 4.2.3 抖音检测
  - [x] 4.2.4 快手检测
- [x] 4.3 为文章类型 URL 集成 Jina Reader
  - [x] 4.3.1 调用 `extractWithJinaReader()`
  - [x] 4.3.2 格式化返回的内容
  - [x] 4.3.3 提取纯文本内容
- [x] 4.4 更新数据库保存逻辑
  - [x] 4.4.1 保存 title（Jina 返回）
  - [x] 4.4.2 保存 excerpt（description 前 200 字符）
  - [x] 4.4.3 保存 content_html（格式化后）
  - [x] 4.4.4 保存 content_text（纯文本）
  - [x] 4.4.5 保存 site_name（Jina 返回或域名）
  - [x] 4.4.6 保存 author（如果有）
  - [x] 4.4.7 保存 published_at（如果有）
  - [x] 4.4.8 保存 captured_at（当前时间）
- [x] 4.5 实现错误处理
  - [x] 4.5.1 Jina Reader 失败时返回明确错误信息
  - [x] 4.5.2 记录错误日志
  - [x] 4.5.3 返回 HTTP 500 错误响应

## 5. 更新前端阅读器组件

- [x] 5.1 在 `components/reader/ContentStage/ArticleReader.tsx` 中导入 `NEWS_STYLING_CLASSES`
- [x] 5.2 替换现有的 `CONTENT_STYLING_CLASSES` 为 `NEWS_STYLING_CLASSES`
- [x] 5.3 验证样式应用正确
- [x] 5.4 测试响应式布局
  - [x] 5.4.1 桌面端展示
  - [x] 5.4.2 平板端展示
  - [x] 5.4.3 移动端展示

## 6. 测试与验证

- [x] 6.1 单元测试
  - [x] 6.1.1 测试 `extractWithJinaReader()` 基本功能
  - [x] 6.1.2 测试 API Key 缺失场景
  - [x] 6.1.3 测试超时场景
  - [x] 6.1.4 测试 `formatNewsContent()` Markdown 转换
- [x] 6.2 集成测试
  - [x] 6.2.1 测试完整抓取流程（URL → 保存）
  - [x] 6.2.2 测试视频 URL 保持原逻辑
  - [x] 6.2.3 测试文章 URL 使用 Jina Reader
- [x] 6.3 手动测试（不同类型网站）
  - [x] 6.3.1 新闻网站（腾讯新闻、新浪新闻）
  - [x] 6.3.2 博客文章（Medium、知乎专栏）
  - [x] 6.3.3 微信公众号文章
  - [x] 6.3.4 技术文档（GitHub README）
- [x] 6.4 样式验证
  - [x] 6.4.1 标题层级正确显示
  - [x] 6.4.2 段落间距符合规范
  - [x] 6.4.3 图片居中且有阴影
  - [x] 6.4.4 引用块样式正确
  - [x] 6.4.5 移动端适配良好

## 7. 文档更新

- [x] 7.1 更新 `.env.example` 添加 JINA_API_KEY 配置说明
- [x] 7.2 更新 `CLAUDE.md` 移除 jina.ts 相关内容（因为文件不存在）
- [x] 7.3 添加 Jina Reader 使用说明到 CLAUDE.md

## 8. 部署准备

- [ ] 8.1 确认生产环境 JINA_API_KEY 已配置
- [x] 8.2 验证所有依赖包已安装（package.json 更新）
- [ ] 8.3 运行 `npm run build` 验证构建成功
- [ ] 8.4 运行 `npm run lint` 验证代码规范

## 9. 监控与优化

- [ ] 9.1 部署到生产环境
- [ ] 9.2 监控 Jina Reader API 调用情况
  - [ ] 9.2.1 成功率统计
  - [ ] 9.2.2 平均响应时间
  - [ ] 9.2.3 错误类型分布
- [ ] 9.3 收集用户反馈
- [ ] 9.4 根据反馈优化样式或格式化逻辑

## 验收标准

所有任务完成后，验证以下标准：

✅ **功能完整性**
- Jina Reader API 调用成功
- 视频平台检测正常工作
- 内容格式化符合新闻样式规范

✅ **性能指标**
- 抓取成功率 ≥ 95%
- 平均响应时间 ≤ 3 秒
- API 错误率 < 5%

✅ **用户体验**
- 文章排版清晰，可读性强
- 移动端展示良好
- 无样式冲突或错位

✅ **代码质量**
- 通过 TypeScript 类型检查
- 通过 ESLint 检查
- 错误处理完善
