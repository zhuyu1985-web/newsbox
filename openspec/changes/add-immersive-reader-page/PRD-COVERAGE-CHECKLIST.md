# PRD 功能覆盖对照清单

本文档对照 `docs/prd-detail.md` 逐项检查所有功能需求是否已包含在OpenSpec提案中。

## ✅ = 已包含 | ⚠️ = 部分实现 | ❌ = 未包含

---

## 1. 核心理念与布局

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 多态路由（图文/视频自动切换） | ✅ | reader-page: Requirement "多态内容路由" |
| 三栏式布局 | ✅ | reader-page: Requirement "三栏响应式阅读布局" |
| 全屏禅模式 | ✅ | reader-page: Scenario "启用禅模式隐藏侧栏" |
| 响应式适配（移动端） | ✅ | reader-page: Scenario "移动端自适应单栏布局" |

---

## 2. 全局顶部导航栏

### 2.1 左侧：导航与路径

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 返回按钮 | ✅ | tasks.md 2.3.2 |
| 面包屑导航（分类路径） | ✅ | tasks.md 2.3.2 |
| 阅读进度条（顶部边缘） | ✅ | reader-page: Requirement "阅读进度追踪" + tasks.md 2.3.3 |

### 2.2 中间：视图切换

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 沉浸阅读（默认） | ✅ | reader-page: Scenario "默认显示沉浸阅读视图" |
| 原始网页（iframe） | ✅ | reader-page: Scenario "切换到原始网页视图" |
| AI速览（结构化事实卡片） | ✅ | reader-page: Scenario "切换到AI速览视图" |
| 网页存档 | ✅ | reader-page: Scenario "切换到网页存档视图" |

### 2.3 右侧：工具箱

#### A. 阅读器样式（Appearance）

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 图文模式：字号调节 | ✅ | reader-page: Scenario "调整图文模式字号" |
| 图文模式：页边距 | ✅ | tasks.md 12.2.2 |
| 图文模式：行高 | ✅ | reader-page: Scenario "调整图文模式行高" |
| 图文模式：主题色（亮/暗/护眼/跟随） | ✅ | reader-page: Scenario "切换主题色" |
| 图文模式：字体（衬线/无衬线/系统） | ✅ | reader-page: Scenario "切换字体" |
| 视频模式：字幕大小 | ✅ | reader-page: Scenario "调整视频模式字幕大小" |
| 视频模式：字幕背景透明度 | ✅ | tasks.md 12.2.3 |
| 视频模式：播放器背景（黑边/模糊） | ✅ | tasks.md 12.2.3 |

#### B. 更多操作（Actions）

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| **分享** | | |
| - 生成卡片或公开链接 | ✅ | reader-page: Scenario "分享笔记生成公开链接" |
| **访问原网页** | | |
| - 跳转浏览器 | ✅ | tasks.md 14.1.3 |
| **复制链接** | | |
| - 复制原链接 | ✅ | reader-page: Scenario "复制原链接" |
| - 复制Markdown链接 | ✅ | reader-page: Scenario "复制Markdown链接" |
| **复制内容** | | |
| - 复制纯文本 | ✅ | reader-page: Scenario "复制内容为纯文本" |
| - 复制Markdown | ✅ | reader-page: Scenario "复制内容为Markdown" |
| - 复制HTML | ✅ | reader-page: Scenario "复制内容为HTML" |
| - **复制为引用格式**（核心） | ✅ | reader-page: Scenario "复制为引用格式" |
| - 复制ASR逐字稿（视频） | ✅ | reader-page: Scenario "复制ASR逐字稿（视频专用）" |
| - **复制快照为HTML** | ✅ | reader-page: Scenario "复制快照为HTML" |
| **导出** | | |
| - PDF（打印优化） | ✅ | reader-page: Scenario "导出为PDF" |
| - Markdown | ✅ | reader-page: Scenario "导出为Markdown" |
| - TXT | ✅ | reader-page: Scenario "导出为TXT" |
| - SRT字幕（视频） | ✅ | reader-page: Scenario "导出SRT字幕（视频专用）" |
| - **视频关键帧打包** | ✅ | reader-page: Scenario "导出视频关键帧打包" |
| - 导出网页存档HTML | ✅ | reader-page: Scenario "导出网页存档HTML" |
| **整理** | | |
| - 设为星标 | ✅ | reader-page: Scenario "设为星标" |
| - 移动文件夹 | ✅ | reader-page: Scenario "移动到文件夹" |
| - 编辑元信息（标题/标签/摘要） | ✅ | reader-page: Scenario "编辑元信息" |
| - 归档 | ✅ | reader-page: Scenario "归档笔记" |
| - **稍后读** | ✅ | reader-page: Scenario "标记为稍后读" |
| - **读了一半退出自动记录进度** | ✅ | reader-page: Scenario "读到一半自动保存进度" |
| - **读完手动归档** | ✅ | reader-page: Scenario "归档笔记" |

#### C. AI阅读

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 点击后展开右侧面板并选中[AI解读]Tab | ✅ | tasks.md 2.3.6 |
| 尚未生成→触发流式生成 | ✅ | ai-summaries: Scenario "点击生成AI解读" |
| 已生成→直接展示 | ✅ | ai-summaries: Scenario "已有AI解读直接展示" |

#### D. 内容批注

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 点击后展开右侧面板并选中[批注列表]Tab | ✅ | tasks.md 2.3.6 |
| 按钮右上角显示数字角标(Badge) | ✅ | library: Scenario "显示批注数量徽章" |

---

## 3. 中间区域：自适应核心舞台

### 场景A：图文模式

#### 元信息头

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 标题 | ✅ | tasks.md 3.2.2 |
| **来源媒体（Icon+名称）** | ✅ | reader-page: Scenario "显示元信息头" |
| 作者 | ✅ | tasks.md 3.2.2 |
| **发布时间** | ✅ | reader-page: Scenario "显示元信息头" |
| **抓取时间** | ✅ | reader-page: Scenario "显示元信息头" |
| 标签区（快速增删） | ✅ | tasks.md 3.2.2 |
| 阅读预估："约X分钟读完" | ✅ | reader-page: Scenario "计算预估阅读时间" |

#### 正文交互

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 纯净渲染（去广告） | ✅ | reader-page: Requirement "图文阅读模式纯净渲染" |
| 保留代码块高亮 | ✅ | reader-page: Scenario "渲染保留代码高亮和图片" |
| **多媒体增强** | | |
| - Lightbox图片放大/旋转/下载 | ✅ | reader-page: Requirement "Lightbox图片查看器" |
| - **图注保留** | ✅ | reader-page: Scenario "保留图片说明文字" |
| **划词气泡菜单** | | |
| - 高亮色块 | ✅ | reader-page: Scenario "点击高亮创建高亮标记" |
| - 写批注 | ✅ | reader-page: Scenario "点击批注打开批注输入框" |
| - AI解释 | ✅ | reader-page: Scenario "点击AI解释调用AI分析" |
| - 搜索 | ✅ | reader-page: Scenario "选中文字显示气泡菜单" |
| - 复制 | ✅ | reader-page: Scenario "点击复制提供多种格式" |

### 场景B：视频模式

#### 智能播放器容器

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| **自适应画幅** | | |
| - 横屏(16:9)：居中，黑色背景 | ✅ | reader-page: Scenario "自适应横屏视频显示" |
| - 竖屏(9:16)：居中，高斯模糊填充 | ✅ | reader-page: Scenario "自适应竖屏视频显示" |
| **控制增强** | | |
| - 倍速：0.5x - 3.0x | ✅ | reader-page: Scenario "倍速播放控制" |
| - 循环区间(Loop) | ✅ | reader-page: Scenario "循环区间播放" |
| - 一键截帧 | ✅ | reader-page: Scenario "一键截帧保存" |
| - 画中画(PiP) | ✅ | reader-page: Scenario "画中画模式" |
| - 静音阅读模式 | ✅ | reader-page: Scenario "静音阅读模式" |

---

## 4. 左侧区域：智能导航

### 图文模式：智能大纲

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 提取H1-H3标签 | ✅ | reader-page: Scenario "提取H1-H3标题作为大纲" |
| 若无标签，AI自动提炼关键段落标题 | ✅ | reader-page: Scenario "无标题时AI生成大纲" |
| 点击跳转 | ✅ | reader-page: Scenario "点击大纲项跳转到对应位置" |
| 滚动时高亮当前章节 | ✅ | reader-page: Scenario "滚动时高亮当前章节" |
| 短文章自动隐藏 | ✅ | reader-page: Scenario "短文章自动隐藏大纲" |

### 视频模式：智能章节

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| AI自动分段（语义/画面转场） | ✅ | reader-page: Scenario "基于逐字稿AI生成章节" |
| 点击章节→视频跳转+右侧逐字稿跳转 | ✅ | reader-page: Scenario "点击章节同步跳转" |

---

## 5. 右侧区域：智库面板

### 面板结构

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| **Split View (分屏)** 或 **Tabs (标签页)** 切换 | ✅ | reader-page: Scenario "右侧面板标签页切换" + "右侧面板分屏模式" |

### 6.1 批注列表 (Annotations)

#### 卡片结构

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 引用(Quote)：图文显示被划线文字 | ✅ | annotations: Requirement "视频批注功能" |
| 引用(Quote)：视频显示截帧图片或台词 | ✅ | annotations: Scenario "视频批注卡片显示截帧" |
| 笔记(Note)：用户输入内容 | ✅ | annotations: existing requirement |
| 锚点：图文→正文滚动并闪烁 | ✅ | annotations: existing scenario |
| 锚点：视频→跳转到对应秒数 | ✅ | annotations: Scenario "点击视频批注跳转到对应时刻" |

#### 操作

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 改色 | ✅ | annotations: Scenario "修改已有高亮的颜色" |
| 复制 | ✅ | annotations: existing scenario |
| 删除 | ✅ | annotations: existing scenario |

#### 特色功能：浮顶

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 点击"图钉"图标 | ✅ | annotations: Requirement "浮顶批注卡片" |
| 卡片脱离列表，变为全局悬浮窗 | ✅ | annotations: Scenario "点击图钉浮顶批注" |
| 跨文章漫游时依然可见 | ✅ | annotations: Scenario "浮顶卡片跨页面保持显示" |

### 6.2 AI解读 (AI Analysis)

#### 多视角分析

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 摘要(TL;DR) | ✅ | ai-summaries: existing scenario |
| 记者视点（消息源可靠性、利益相关方） | ✅ | ai-summaries: Scenario "生成记者视点分析" |
| 时间线（梳理事件脉络） | ✅ | ai-summaries: Scenario "生成事件时间线" |
| 视频特有：视觉摘要 | ✅ | ai-summaries: Scenario "生成视频视觉摘要" |
| 视频特有：Deepfake预警 | ✅ | ai-summaries: Scenario "Deepfake检测预警" |

#### AI追问

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 底部输入框，RAG问答 | ✅ | ai-summaries: Requirement "AI追问对话功能" |

### 6.3 视频特有模块：听记 (Transcript)

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| ASR逐字稿：显示全视频文本 | ✅ | reader-page: Requirement "ASR逐字稿系统" |
| 说话人识别(Diarization) | ✅ | reader-page: Scenario "说话人识别和重命名" |
| 卡拉OK式高亮 | ✅ | reader-page: Scenario "卡拉OK式高亮滚动" |
| 双向交互：点击文字→视频跳转 | ✅ | reader-page: Scenario "点击逐字稿跳转视频" |
| 校对模式：修改识别错误 | ✅ | reader-page: Scenario "校对模式编辑逐字稿" |

---

## 6. 边缘情况与特殊处理

| 功能点 | 状态 | Spec位置 |
|--------|------|----------|
| 混合内容：图文中嵌入视频，提供"提取为视频笔记"按钮 | ✅ | reader-page: Scenario "检测图文中嵌入的视频" |
| 未保存保护：编辑批注时关闭页面，弹出Alert | ✅ | reader-page: Scenario "编辑批注时关闭页面提示" |
| 原始链接失效：提示查看"网页存档" | ✅ | reader-page: Scenario "原链接失效时提示" |
| 引用格式化：无论在哪里复制，都提供"复制为引用格式"选项 | ✅ | reader-page: Scenario "复制为引用格式" |

---

## 总结

✅ **所有PRD功能已完整覆盖，包括：**

1. 核心布局与导航（三栏、禅模式、面包屑、进度条）
2. 视图切换器（4种模式）
3. 阅读器样式设置（图文/视频双模式）
4. 完整的更多操作功能（分享、复制、导出、整理）
5. AI阅读与批注（带数字角标）
6. 图文模式（元信息头、纯净渲染、划词菜单、Lightbox）
7. 视频模式（智能播放器、自适应画幅、高级控制）
8. 智能导航（图文大纲、视频章节）
9. 右侧面板（分屏/Tabs、批注列表、AI解读、视频听记）
10. 边缘情况处理（混合内容、未保存保护、链接失效）

**特别补充的PRD明确要求但容易遗漏的功能：**
- ✅ 复制快照为HTML
- ✅ 视频关键帧打包导出
- ✅ 图注保留
- ✅ 稍后读功能
- ✅ 读到一半自动保存进度
- ✅ 发布时间+抓取时间双时间戳
- ✅ 来源媒体Icon+名称显示
- ✅ 右侧面板Split View（分屏）支持

---

**验证状态：** OpenSpec validate --strict ✅ 通过

