# Supabase 数据库迁移说明

## 迁移文件清单

### 001_initial_schema.sql
初始数据库架构，包含：
- ENUM 类型定义
- 所有核心表结构
- RLS 策略
- 索引和触发器

### 002_seed_data.sql
种子数据，用于开发和测试。

### 003_enhance_my_collections.sql
增强"我的收藏"功能的数据模型：
- 添加 `is_starred`、`captured_at`、`source_type` 等字段
- 支持手动笔记（无 URL）
- 添加文件上传相关字段

### 004_enhance_folder_management.sql
增强收藏夹管理功能：
- 添加 `parent_id`（层级收藏夹）
- 添加 `icon`（自定义图标）
- 添加 `archived_at`（归档功能）
- 更新唯一约束以支持同名收藏夹在不同父级下

### 005_enhance_list_filtering.sql
增强列表筛选和排序功能：
- 添加 `notes.archived_at` 字段（归档笔记）
- 添加 `idx_notes_user_id_title` 索引（按标题排序）
- 添加 `idx_notes_user_id_site_name` 索引（按网站排序）
- 添加 `idx_notes_user_id_updated_at` 索引（按更新时间排序）
- 添加 `idx_notes_user_id_archived_at` 索引（归档状态筛选）

### 006_add_tag_management.sql ⚠️ **需要立即执行**
添加标签管理功能：
- 添加 `tags.parent_id`（层级标签）
- 添加 `tags.position`（自定义排序）
- 添加 `tags.icon`（自定义图标）
- 添加 `tags.archived_at`（归档功能）
- 更新唯一约束以支持同名标签在不同父级下
- 添加循环引用检测约束

### 007_add_count_untagged_notes_function.sql ⚠️ **需要立即执行**
添加无标签笔记计数功能：
- 创建 `count_untagged_notes()` RPC 函数
- 用于统计当前用户没有任何标签的笔记数量
- 支持标签页"无标签"筛选功能

## 执行迁移

### 方式1: 使用 Supabase CLI（推荐）

```bash
# 安装 Supabase CLI
npm i supabase --save-dev

# 登录 Supabase
npx supabase login

# 链接到远程项目
npx supabase link --project-ref <your-project-ref>

# 推送迁移
npx supabase db push
```

### 方式2: 使用 Supabase Dashboard（手动）

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 SQL Editor
4. 依次复制并执行每个迁移文件的内容
5. 执行顺序：001 → 002 → 003 → 004 → 005 → **006 (必需)** → **007 (必需)**

### 方式3: 使用本地开发环境

```bash
# 重置本地数据库并应用所有迁移
npx supabase db reset

# 应用新的迁移
npx supabase db push
```

## 存储桶配置

### Storage Bucket 配置
用于存储用户上传的文件（图片、视频、音频）。

**创建步骤**：
1. 进入 Supabase Dashboard → Storage
2. 创建新桶：`zhuyu`（或你配置的 bucket 名称）
3. **重要**：配置 RLS 策略（见下方）
4. 配置最大文件大小和允许的文件类型

**推荐配置**：
- 最大文件大小：50MB
- 允许类型：`image/*`, `video/*`, `audio/*`, `application/pdf`
- RLS 策略：仅允许认证用户上传/访问自己的文件

**RLS 策略配置**：
请参考 `supabase/STORAGE_SETUP.md` 文件中的详细说明，或执行迁移文件 `009_add_storage_bucket_policies.sql`。

**注意**：如果遇到 "new row violates row-level security policy" 错误，请确保已正确配置 Storage bucket 的 RLS 策略。

## 数据模型更新

### enhance-list-filtering-views 功能更新

#### 新增字段
- `notes.archived_at`: 归档时间戳，非空表示已归档

#### 新增索引
- `idx_notes_user_id_title`: 支持按标题排序
- `idx_notes_user_id_site_name`: 支持按网站排序
- `idx_notes_user_id_updated_at`: 支持按更新时间排序
- `idx_notes_user_id_archived_at`: 优化归档状态筛选

#### 前端功能
- **筛选**: 归档状态（显示/隐藏已归档）、内容类型（文章/视频/音频）
- **排序**: 8 种排序模式（按创建/更新时间/标题/网站，正序/倒序）
- **视图**: 4 种视图模式（紧凑卡片、详情列表、紧凑列表、标题列表）
- **添加**: 圆形图标按钮，下拉菜单包含添加网址/速记/上传

#### API 查询参数
- `show_archived`: boolean（默认 false）
- `content_type`: "all" | "article" | "video" | "audio"（默认 "all"）
- `sort_by`: "created_at" | "updated_at" | "title" | "site_name"（默认 "created_at"）
- `sort_order`: "asc" | "desc"（默认 "desc"）

## 待办事项

- [ ] 扩展 `content_type` 枚举以支持更多类型（网页、片段、速记、图片、文件）
- [ ] 为既有数据迁移/重分类内容类型
- [ ] 实现智能列表的高级聚类算法
- [ ] 添加全文搜索优化和性能监控

## 故障排除

### 问题: npm EPERM 错误
**解决方案**: 使用 Supabase Dashboard 的 SQL Editor 手动执行迁移文件。

### 问题: 迁移顺序错误
**解决方案**: 确保按照文件名的数字前缀顺序执行（001 → 002 → ... → 005）。

### 问题: 唯一约束冲突
**解决方案**: 检查是否有重复数据，清理后重新执行迁移。
