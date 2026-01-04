# AI 快照功能调试指南

## 问题排查步骤

### 1. 检查环境变量

确保 `.env.local` 中配置了 OpenAI API：

```bash
OPENAI_API_KEY=sk-xxxxx
OPENAI_API_BASE_URL=https://api.openai.com/v1  # 可选
OPENAI_MODEL=gpt-4o  # 可选
```

### 2. 测试基础图片生成

访问测试端点验证 `@vercel/og` 是否正常工作：

```bash
curl "http://localhost:3000/api/snapshot-test" -o test.png
file test.png  # 应该显示: PNG image data, 1200 x 1600
```

### 3. 测试完整 API

```bash
# 测试基本功能
curl "http://localhost:3000/api/snapshot?title=测试&content=这是测试内容&template=business" -o snapshot.png

# 查看详细错误（如果失败）
curl -v "http://localhost:3000/api/snapshot?title=测试&content=这是测试内容" 2>&1 | grep -E "(HTTP|Error|error)"
```

### 4. 查看服务器日志

在开发服务器终端查看以下日志：

```
Snapshot API: Generating AI analysis...
Snapshot API: AI analysis completed {one_liner: "...", ...}
Snapshot API: Rendering image...
```

## 常见错误及解决方案

### 错误 1: "OPENAI_API_KEY is not configured"

**原因**: 环境变量未配置或未正确加载

**解决**:
1. 检查 `.env.local` 文件是否存在
2. 确认文件中有 `OPENAI_API_KEY=xxx`
3. 重启开发服务器: `npm run dev`

### 错误 2: "Missing required parameter: content"

**原因**: API 调用缺少必要参数

**解决**:
- 确保传入了 `content` 或 `noteId` 参数
- 检查前端组件是否正确传递了 `note.content_text` 或 `note.content_html`

### 错误 3: "AI analysis failed"

**原因**: OpenAI API 调用失败

**解决**:
1. 检查 API Key 是否有效
2. 检查网络连接
3. 查看具体错误信息（在服务器日志中）
4. 确认 API 配额是否充足

### 错误 4: "Expected image, got: application/json"

**原因**: API 返回了错误 JSON 而不是图片

**解决**:
1. 查看浏览器控制台的错误详情
2. 检查服务器日志中的 AI 分析结果
3. 可能是 AI 返回的数据格式有问题

### 错误 5: 图片加载失败 / onError 触发

**原因**: 
- 图片生成过程中出错
- `ImageResponse` 渲染失败
- 数据结构不匹配

**解决**:
1. 检查 `cardData` 结构是否包含所有必需字段:
   - `one_liner` (string)
   - `bullet_points` (string[])
   - `sentiment` (string)
   - `key_stat` (string, 可选)

2. 在 API 路由中添加数据验证:
```typescript
if (!cardData.one_liner || !cardData.bullet_points) {
  throw new Error("Invalid card data structure");
}
```

## 调试技巧

### 1. 启用详细日志

在 `app/api/snapshot/route.tsx` 中添加更多 console.log:

```typescript
console.log("Request params:", { noteId, title: title?.substring(0, 50), contentLength: content?.length });
console.log("Card data:", JSON.stringify(cardData, null, 2));
```

### 2. 使用简化的 AI 响应

如果 OpenAI API 不可用，可以临时使用模拟数据测试图片生成:

```typescript
// 在 generateSnapshotData 函数中
if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DATA === 'true') {
  return {
    one_liner: "这是测试标题",
    bullet_points: ["要点1", "要点2", "要点3"],
    sentiment: "💡 深度",
    key_stat: "测试数据",
  };
}
```

### 3. 分步测试

1. **测试 AI 分析**: 单独调用 `generateSnapshotData` 并打印结果
2. **测试图片渲染**: 使用固定的 mock 数据测试 `ImageResponse`
3. **集成测试**: 完整流程测试

## 性能优化建议

1. **缓存快照**: 为同一篇文章缓存生成的快照，避免重复调用 AI
2. **异步生成**: 考虑将 AI 分析改为后台任务，先返回加载状态
3. **CDN 缓存**: 生成的图片可以上传到 CDN，通过 URL 分享

## 快速修复清单

- [ ] `.env.local` 包含 `OPENAI_API_KEY`
- [ ] 开发服务器已重启
- [ ] 测试端点 `/api/snapshot-test` 返回 200
- [ ] 浏览器控制台没有 CORS 错误
- [ ] 服务器日志显示 "AI analysis completed"
- [ ] `content` 参数不为空且长度 > 10
- [ ] 网络可以访问 OpenAI API

## 联系支持

如果以上步骤都无法解决问题:
1. 导出完整的服务器日志
2. 截图浏览器控制台的错误信息
3. 记录复现步骤
