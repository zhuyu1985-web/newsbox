# 划词功能调试指南

## 🐛 问题描述

用户反馈：划词批注只在 header 中有效，在 article 正文部分选中文字后没有反应。

## 🔍 已实施的修复

### 1. 添加延迟处理

**文件：** `components/reader/SelectionMenu.tsx`

```typescript
// 使用 setTimeout 确保选择完成后再处理
setTimeout(() => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  // ...
}, 10);
```

**原因：** 确保 DOM 选择事件完全完成后再获取选中文本。

### 2. 防止图片点击冲突

**文件：** `components/reader/ContentStage/ArticleReader.tsx`

```typescript
const handleImageClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.tagName === "IMG" && target.closest(".prose")) {
    // 检查是否有文本选择，如果有则不打开图片查看器
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }
    // ...
  }
};
```

**原因：** 避免图片点击事件干扰文本选择。

### 3. 添加可选择标记

**文件：** `components/reader/ContentStage/ArticleReader.tsx`

```tsx
<div
  data-selectable="true"
  className={cn(
    "prose prose-slate dark:prose-invert max-w-none select-text",
    // ...
  )}
>
```

**原因：** 明确标记内容区域可选择，添加 `select-text` 类确保文本可选。

### 4. 添加调试日志

**文件：** `components/reader/SelectionMenu.tsx`

```typescript
console.log("Selection event:", {
  text,
  hasSelection: !!selection,
  rangeCount: selection?.rangeCount || 0,
  target: (e.target as HTMLElement)?.tagName,
});
```

**原因：** 帮助诊断选择事件是否正常触发。

## 🧪 测试步骤

### 1. 打开浏览器控制台

```
Chrome: Cmd+Option+J (Mac) / Ctrl+Shift+J (Windows)
```

### 2. 访问笔记详情页

```
http://localhost:3000/notes/[id]
```

### 3. 测试选择功能

#### 测试 A：Header 区域
1. 选中标题中的文字
2. 查看控制台输出
3. 验证划词菜单是否弹出

#### 测试 B：正文区域
1. 选中正文段落中的文字
2. 查看控制台输出
3. 验证划词菜单是否弹出

#### 测试 C：不同元素
1. 选中普通段落 `<p>`
2. 选中标题 `<h2>`, `<h3>`
3. 选中列表 `<li>`
4. 选中引用 `<blockquote>`
5. 选中代码 `<code>`

### 4. 检查控制台输出

**正常输出示例：**
```javascript
Selection event: {
  text: "这是选中的文字",
  hasSelection: true,
  rangeCount: 1,
  target: "P"
}

Menu position: {
  top: 450,
  left: 600,
  rect: DOMRect { ... }
}
```

**异常输出示例：**
```javascript
Selection event: {
  text: "",
  hasSelection: true,
  rangeCount: 0,
  target: "DIV"
}
```

## 🔧 可能的问题和解决方案

### 问题 1：CSS 禁用了文本选择

**检查：**
```css
/* 查找是否有这些样式 */
user-select: none;
-webkit-user-select: none;
```

**解决：**
```css
.prose {
  user-select: text;
  -webkit-user-select: text;
}
```

### 问题 2：事件冒泡被阻止

**检查：**
```javascript
// 查找是否有 stopPropagation
element.addEventListener('mouseup', (e) => {
  e.stopPropagation(); // 这会阻止事件冒泡
});
```

**解决：**
移除或条件性地调用 `stopPropagation`。

### 问题 3：Z-index 层级问题

**检查：**
划词菜单的 z-index 是否足够高。

**当前设置：**
```tsx
className="fixed z-[100] bg-popover border rounded-lg shadow-lg"
```

### 问题 4：dangerouslySetInnerHTML 内容不可选

**检查：**
使用 `dangerouslySetInnerHTML` 渲染的内容是否可选。

**当前实现：**
```tsx
<div
  data-selectable="true"
  className="prose select-text"
  dangerouslySetInnerHTML={{ __html: processContentHtml(note.content_html) || "" }}
/>
```

## 📊 调试检查清单

- [ ] 打开浏览器控制台
- [ ] 选中 header 中的文字，查看控制台输出
- [ ] 选中正文中的文字，查看控制台输出
- [ ] 对比两者的输出差异
- [ ] 检查是否有 `user-select: none` 样式
- [ ] 检查事件是否被阻止
- [ ] 检查 z-index 层级
- [ ] 检查 `dangerouslySetInnerHTML` 内容是否可选
- [ ] 尝试在不同浏览器测试（Chrome、Safari、Firefox）

## 🎯 预期行为

1. **选中文字**：用户在正文任意位置选中文字
2. **触发事件**：`mouseup` 事件被触发
3. **获取选择**：`window.getSelection()` 返回选中的文本
4. **计算位置**：根据选中区域的 `getBoundingClientRect()` 计算菜单位置
5. **显示菜单**：划词菜单出现在选中文字上方
6. **用户操作**：用户可以点击高亮、批注、AI等按钮

## 📝 下一步行动

如果问题仍然存在，请提供以下信息：

1. **控制台输出**：选中正文文字时的完整控制台输出
2. **浏览器信息**：浏览器类型和版本
3. **屏幕截图**：显示选中文字但没有菜单的截图
4. **HTML 结构**：正文区域的 HTML 结构（从开发者工具复制）

---

**更新时间：** 2024-12-29  
**状态：** 🟡 调试中

