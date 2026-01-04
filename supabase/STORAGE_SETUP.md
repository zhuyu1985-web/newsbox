# Storage Bucket RLS 策略配置指南

## 问题说明

如果遇到 "new row violates row-level security policy" 错误，通常是因为 Storage bucket 的 RLS 策略未正确配置。

**重要**：如果遇到 `must be owner of table objects` 错误，说明没有权限通过 SQL 直接修改策略，必须使用 Dashboard UI 方式（见下方）。

## 配置步骤

### ⚠️ 推荐方式：使用 Supabase Dashboard UI

由于 `storage.objects` 是系统表，普通 SQL 用户无法直接修改策略，**必须使用 Dashboard UI**。

详细步骤请参考：`supabase/STORAGE_POLICY_SETUP_GUIDE.md`

#### 快速步骤：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 进入 **Storage** → 选择 `zhuyu` bucket → **Policies** 标签页
3. 点击 **New Policy** 创建以下 4 个策略：

**策略 1: INSERT（上传文件）**
- Policy name: `Users can upload files to their own folder`
- Operation: `INSERT`
- Roles: `authenticated`
- WITH CHECK: `bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')`

**策略 2: SELECT（读取文件）**
- Policy name: `Users can read their own files`
- Operation: `SELECT`
- Roles: `authenticated`
- USING: `bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')`

**策略 3: UPDATE（更新文件）**
- Policy name: `Users can update their own files`
- Operation: `UPDATE`
- Roles: `authenticated`
- USING 和 WITH CHECK: `bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')`

**策略 4: DELETE（删除文件）**
- Policy name: `Users can delete their own files`
- Operation: `DELETE`
- Roles: `authenticated`
- USING: `bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')`

### 方式 B: 使用 SQL Editor（需要服务角色）

⚠️ **注意**：如果遇到权限错误，请使用上面的 UI 方式。

在 Supabase Dashboard 的 **SQL Editor** 中执行以下 SQL：

```sql
-- 1. 确保 bucket 存在（如果不存在，需要在 Dashboard 中先创建）
-- 2. 创建 RLS 策略

-- 策略：允许认证用户上传文件到自己的文件夹
CREATE POLICY IF NOT EXISTS "Users can upload files to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 策略：允许认证用户读取自己的文件
CREATE POLICY IF NOT EXISTS "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 策略：允许认证用户更新自己的文件
CREATE POLICY IF NOT EXISTS "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 策略：允许认证用户删除自己的文件
CREATE POLICY IF NOT EXISTS "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**注意**：将 `'zhuyu'` 替换为你实际的 bucket 名称。

### 3. 验证配置

配置完成后，尝试上传文件。如果仍然遇到错误，请检查：

1. **Bucket 名称是否正确**：确保代码中的 `STORAGE_BUCKET` 常量与 Supabase 中的 bucket 名称一致
2. **用户是否已认证**：确保用户已登录
3. **文件路径格式**：代码中使用的路径格式为 `{user_id}/{timestamp}-{filename}`，确保与 RLS 策略匹配

### 4. 调试技巧

如果问题仍然存在，可以在浏览器控制台查看详细的错误信息：

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页
3. 尝试上传文件
4. 查看控制台输出的详细错误信息

代码中已添加了详细的日志输出，包括：
- 用户 ID
- 插入的数据
- 错误详情

## 常见问题

### Q: 为什么 Storage bucket 需要 RLS 策略？

A: RLS（Row-Level Security）策略确保用户只能访问和操作自己的文件，这是安全性的重要保障。

### Q: 我可以将 bucket 设置为 Public 吗？

A: 可以，但不推荐。如果设置为 Public，所有文件都可以被任何人访问（只要知道 URL）。建议使用 RLS 策略来保护用户隐私。

### Q: 如何修改 bucket 名称？

A: 
1. 在 Supabase Dashboard 中创建新的 bucket
2. 更新代码中的 `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` 环境变量
3. 更新 RLS 策略中的 `bucket_id` 值

