# RLS 错误分析：上传图片时 "new row violates row-level security policy"

## 错误信息
```
添加失败: new row violates row-level security policy
```

## 可能的原因分析

### 1. **Supabase 客户端 Session 问题** ⚠️ **最可能的原因**

**问题描述**：
- 代码使用 `createBrowserClient` 创建客户端
- RLS 策略使用 `auth.uid()` 检查用户身份
- 如果 Supabase 客户端没有正确的 session cookie，`auth.uid()` 会返回 `null`
- 导致 `auth.uid() = user_id` 检查失败

**检查方法**：
在浏览器控制台执行：
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log("Session:", session);
console.log("User ID:", session?.user?.id);
```

**解决方案**：
确保 Supabase 客户端正确配置了 cookie 处理。

### 2. **用户 ID 不匹配**

**问题描述**：
- `currentUser.id` 与 `auth.uid()` 返回的值不一致
- 可能是用户认证状态不同步

**检查方法**：
在插入前添加日志：
```javascript
const { data: { user: authUser } } = await supabase.auth.getUser();
console.log("currentUser.id:", currentUser.id);
console.log("authUser.id:", authUser?.id);
console.log("auth.uid() check:", await supabase.rpc('get_current_user_id')); // 如果存在
```

### 3. **RLS 策略配置问题**

**问题描述**：
- RLS 策略可能没有正确创建
- 策略可能被意外删除或修改

**检查方法**：
在 Supabase Dashboard SQL Editor 中执行：
```sql
-- 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'notes';

-- 检查 INSERT 策略
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes' AND cmd = 'INSERT';
```

### 4. **数据插入时的字段问题**

**问题描述**：
- 插入的数据可能包含不允许的字段值
- `user_id` 字段可能为 null 或格式不正确

**检查方法**：
查看代码中插入的数据：
```javascript
console.log("Insert data:", insertData);
// 确保 user_id 是有效的 UUID
console.log("user_id type:", typeof insertData.user_id);
console.log("user_id value:", insertData.user_id);
```

### 5. **唯一约束冲突（但错误信息不同）**

**问题描述**：
- 如果 `source_url` 已存在，可能触发唯一约束
- 但错误信息应该是 "duplicate key"，不是 RLS 错误

**检查方法**：
查看是否有相同的 `source_url` 已存在。

### 6. **Supabase 客户端初始化问题**

**问题描述**：
- `createBrowserClient` 可能没有正确初始化
- 环境变量可能缺失或错误

**检查方法**：
```javascript
console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("Supabase Key:", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20));
```

## 诊断步骤

### 步骤 1：检查 Session 状态
在浏览器控制台执行：
```javascript
// 在 dashboard-content.tsx 的 handleAddNote 函数开始处添加
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
console.log("Session:", session);
console.log("Session Error:", sessionError);
if (!session) {
  console.error("❌ 没有有效的 session！");
}
```

### 步骤 2：检查用户 ID
```javascript
const { data: { user }, error: userError } = await supabase.auth.getUser();
console.log("Auth User:", user);
console.log("User ID:", user?.id);
console.log("User Error:", userError);
```

### 步骤 3：验证 RLS 策略
在 Supabase Dashboard SQL Editor 中执行：
```sql
-- 测试 RLS 策略
SET ROLE authenticated;
SELECT auth.uid(); -- 应该返回当前用户 ID

-- 检查策略
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'notes' 
  AND cmd = 'INSERT';
```

### 步骤 4：测试插入权限
```sql
-- 使用当前用户 ID 测试插入（替换 YOUR_USER_ID）
INSERT INTO public.notes (user_id, source_url, content_type, source_type)
VALUES ('YOUR_USER_ID', 'test-url', 'article', 'upload')
RETURNING *;
```

## 推荐的修复方案

### 方案 1：确保 Session 正确传递（推荐）

修改 `lib/supabase/client.ts`：
```typescript
import { createBrowserClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  // 确保使用正确的 cookie 处理
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

### 方案 2：添加详细的错误日志

在插入前添加：
```typescript
// 验证认证状态
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (!session) {
  console.error("❌ 没有有效的 session");
  throw new Error("请重新登录");
}

const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
if (!authUser || userError) {
  console.error("❌ 无法获取用户信息", userError);
  throw new Error("无法获取用户信息，请重新登录");
}

console.log("✅ Session 验证通过");
console.log("✅ User ID:", authUser.id);
console.log("✅ 准备插入数据:", insertData);
```

### 方案 3：使用 Server Action（如果可能）

如果上传功能可以改为 Server Action，使用服务端 Supabase 客户端会更可靠。

## 临时解决方案

如果问题持续存在，可以临时禁用 RLS 进行测试（**仅用于调试，不要在生产环境使用**）：

```sql
-- ⚠️ 仅用于调试，不要在生产环境使用
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;
```

测试完成后立即重新启用：
```sql
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
```

## 下一步行动

1. ✅ 在浏览器控制台检查 session 状态
2. ✅ 验证 RLS 策略是否正确配置
3. ✅ 添加详细的错误日志
4. ✅ 检查 Supabase 客户端配置
5. ✅ 如果问题持续，考虑使用 Server Action

