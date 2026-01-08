# Jina Reader 爬虫集成提案

## 📋 提案概览

**Change ID**: `add-jina-reader-crawler`
**状态**: ✅ 已验证，等待批准
**预计工期**: 4-5 天

## 🎯 核心目标

将当前的基础爬虫（fetch + Cheerio）替换为 **Jina Reader API**，并实现统一的新闻详情页格式化展现。

## 💡 为什么需要这个改变？

| 当前问题 | Jina Reader 解决方案 |
|---------|-------------------|
| ❌ 成功率低（~70%） | ✅ 成功率 >95% |
| ❌ 无法抓取 SPA | ✅ 支持动态内容 |
| ❌ 易被反爬拦截 | ✅ 专业反爬处理 |
| ❌ 内容质量不稳定 | ✅ 智能内容提取 |
| ❌ 格式不统一 | ✅ 统一新闻样式 |

## 📦 交付内容

### 新增文件
- `lib/services/jina-reader.ts` - Jina Reader API 封装

### 修改文件
- `app/api/capture/route.ts` - 集成 Jina Reader
- `lib/services/html-sanitizer.ts` - 增强格式化功能
- `components/reader/ContentStage/ArticleReader.tsx` - 应用新样式

### 配置依赖
- ✅ `JINA_API_KEY` 已在 `.env.local` 配置
- 📦 需安装 `marked` 依赖（Markdown 转 HTML）

## 🎨 新闻样式规范

基于 `docs/tec-news-reader-style.md`，应用以下样式：

- **标题**: 28px bold（H1）, 20px semibold（H2）
- **正文**: 18px, 行高 1.8, 段落间距 24px
- **图片**: 居中 + 圆角 + 阴影
- **引用**: 左侧蓝色边框 + 浅蓝背景
- **响应式**: 移动端自动调整字号和间距

## 🔄 工作流程

```
用户提交 URL
    ↓
检测内容类型
    ├─ 视频 → 保留原逻辑（B站/YouTube/抖音/快手）
    └─ 文章 → Jina Reader API
        ↓
    Markdown → HTML 转换
        ↓
    应用新闻样式格式化
        ↓
    保存到数据库
```

## 📊 实施计划

### Phase 1: 核心功能（Day 1-2）
- ✅ 创建 Jina Reader 服务层
- ✅ 更新 Capture API
- ✅ 增强格式化功能

### Phase 2: 样式优化（Day 3）
- ✅ 定义新闻样式类
- ✅ 更新阅读器组件
- ✅ 测试响应式展示

### Phase 3: 部署监控（Day 4-5）
- ✅ 部署到生产环境
- ✅ 监控 API 调用
- ✅ 收集用户反馈

## 🎯 验收标准

| 指标 | 目标值 |
|------|--------|
| 抓取成功率 | ≥ 95% |
| 平均响应时间 | ≤ 3 秒 |
| API 错误率 | < 5% |
| 样式一致性 | 100% |

## 💰 成本估算

- **API 费用**: ~$20/月（基于 10000 次/月）
- **开发成本**: 4-5 天工作量
- **维护成本**: 极低（托管服务）

## 🚀 下一步行动

1. **批准提案** - 确认技术方案和实施计划
2. **安装依赖** - 运行 `npm install marked`
3. **开始实施** - 按照 `tasks.md` 逐项完成
4. **测试验证** - 确保所有验收标准达成
5. **部署上线** - 监控 API 调用情况

## 📚 相关文档

- `proposal.md` - 完整提案说明
- `design.md` - 技术设计文档
- `tasks.md` - 详细任务清单（58 项）
- `specs/capture/spec.md` - 规格变更说明

## ⚠️ 注意事项

- ✅ 视频平台检测逻辑**完全不变**
- ✅ 现有笔记**不受影响**，无需迁移
- ✅ 失败时仍保存 URL，可稍后重试
- ⚠️ 依赖外部 API（Jina Reader）
- ⚠️ 需要有效的 API Key（已配置）

## 🔧 故障排除

### API Key 配置验证
```bash
# 检查环境变量
cat .env.local | grep JINA_API_KEY
```

### 手动测试 API
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "X-Return-Format: markdown" \
     https://r.jina.ai/https://example.com
```

---

**状态**: ✅ 提案已通过 OpenSpec 严格验证
**验证命令**: `openspec validate add-jina-reader-crawler --strict`
**创建时间**: 2026-01-08
