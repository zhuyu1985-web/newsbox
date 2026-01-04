# Storage Bucket RLS 策略配置指南（Dashboard UI 方式）

## 问题说明

如果遇到 `must be owner of table objects` 错误，说明没有权限通过 SQL 直接修改 `storage.objects` 表的策略。需要使用 Supabase Dashboard 的 UI 界面来配置。

## 配置步骤（推荐方式）

### 方法 1：使用 Supabase Dashboard UI（最简单）

#### 步骤 1：进入 Storage 页面
1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 **Storage**

#### 步骤 2：选择或创建 Bucket
1. 在 Storage 页面，找到名为 `zhuyu` 的 bucket
2. 如果不存在，点击 **New bucket** 创建：
   - Name: `zhuyu`
   - Public bucket: **取消勾选**（使用 RLS 策略控制访问）
   - File size limit: 50MB（或根据需要）
   - Allowed MIME types: `image/*,video/*,audio/*,application/pdf`

#### 步骤 3：配置 RLS 策略
1. 点击 `zhuyu` bucket 名称进入详情页
2. 点击 **Policies** 标签页
3. 点击 **New Policy** 按钮

#### 步骤 4：创建 INSERT 策略（上传文件）
1. 选择 **Create a policy from scratch** 或使用模板
2. 配置如下：
   - **Policy name**: `Users can upload files to their own folder`
   - **Allowed operation**: `INSERT`
   - **Target roles**: `authenticated`
   - **Policy definition**: 选择 **Custom policy**
   - **USING expression**: 留空（INSERT 不需要 USING）
   - **WITH CHECK expression**: 粘贴以下内容：
     ```sql
     bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
     ```
3. 点击 **Review** 然后 **Save policy**

#### 步骤 5：创建 SELECT 策略（读取文件）
1. 再次点击 **New Policy**
2. 配置如下：
   - **Policy name**: `Users can read their own files`
   - **Allowed operation**: `SELECT`
   - **Target roles**: `authenticated`
   - **USING expression**: 粘贴以下内容：
     ```sql
     bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
     ```
   - **WITH CHECK expression**: 留空（SELECT 不需要 WITH CHECK）
3. 点击 **Review** 然后 **Save policy**

#### 步骤 6：创建 UPDATE 策略（更新文件）
1. 再次点击 **New Policy**
2. 配置如下：
   - **Policy name**: `Users can update their own files`
   - **Allowed operation**: `UPDATE`
   - **Target roles**: `authenticated`
   - **USING expression**: 粘贴以下内容：
     ```sql
     bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
     ```
   - **WITH CHECK expression**: 粘贴相同内容：
     ```sql
     bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
     ```
3. 点击 **Review** 然后 **Save policy**

#### 步骤 7：创建 DELETE 策略（删除文件）
1. 再次点击 **New Policy**
2. 配置如下：
   - **Policy name**: `Users can delete their own files`
   - **Allowed operation**: `DELETE`
   - **Target roles**: `authenticated`
   - **USING expression**: 粘贴以下内容：
     ```sql
     bucket_id = 'zhuyu' AND (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
     ```
   - **WITH CHECK expression**: 留空（DELETE 不需要 WITH CHECK）
3. 点击 **Review** 然后 **Save policy**

### 方法 2：使用 SQL（需要服务角色）

如果你有 Supabase 项目的服务角色密钥，可以使用以下方式：

⚠️ **注意**：服务角色密钥拥有完全权限，请妥善保管，不要提交到代码仓库。

```sql
-- 使用服务角色执行（在 Supabase Dashboard 的 SQL Editor 中）
-- 注意：需要使用服务角色密钥，而不是匿名密钥

-- 确保 RLS 已启用
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Users can upload files to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- 创建新策略
CREATE POLICY "Users can upload files to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);

CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);

CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
)
WITH CHECK (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'zhuyu' AND
  (name LIKE auth.uid()::text || '/%' OR name = auth.uid()::text || '/')
);
```

## 验证配置

配置完成后，可以通过以下方式验证：

### 1. 在 Dashboard 中查看策略
- 进入 Storage → `zhuyu` bucket → Policies
- 应该看到 4 条策略（INSERT, SELECT, UPDATE, DELETE）

### 2. 测试上传功能
- 刷新页面
- 尝试上传图片
- 查看浏览器控制台的日志输出

### 3. 检查策略表达式
确保策略表达式正确：
- INSERT: `WITH CHECK` 表达式检查路径是否以 `{user_id}/` 开头
- SELECT/UPDATE/DELETE: `USING` 表达式检查路径是否以 `{user_id}/` 开头

## 常见问题

### Q: 为什么不能通过 SQL 直接修改？
A: `storage.objects` 是 Supabase 的系统表，只有服务角色或超级用户才能修改。普通用户需要通过 Dashboard UI 或使用服务角色密钥。

### Q: 策略表达式中的 `auth.uid()` 是什么？
A: `auth.uid()` 是 Supabase 的内置函数，返回当前认证用户的 UUID。在 RLS 策略中使用它来确保用户只能访问自己的文件。

### Q: 路径格式是什么？
A: 代码中使用的路径格式是 `{user_id}/{timestamp}-{filename}`，例如：
- `36f6b591-cd24-4c54-800f-0a93180d14ac/1767018910982-IMG_0492.JPG`

策略表达式 `name LIKE auth.uid()::text || '/%'` 会匹配所有以用户 ID 开头的路径。

### Q: 如果策略仍然不工作怎么办？
A: 
1. 检查 bucket 名称是否正确（应该是 `zhuyu`）
2. 检查用户是否已登录（查看浏览器控制台的认证日志）
3. 检查文件路径格式是否正确（应该以 `{user_id}/` 开头）
4. 尝试使用更宽松的策略进行测试（仅用于调试）

## 临时测试策略（仅用于调试）

如果标准策略仍然不工作，可以临时创建一个更宽松的策略来测试：

```sql
-- ⚠️ 仅用于测试，允许所有认证用户上传到 zhuyu bucket
-- 在 Dashboard UI 中创建：
-- Policy name: Test: Allow all authenticated uploads
-- Operation: INSERT
-- Roles: authenticated
-- WITH CHECK: bucket_id = 'zhuyu'
```

测试完成后，删除这个策略并使用更严格的策略。















