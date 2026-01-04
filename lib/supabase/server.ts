/**
 * ============================================================================
 * Supabase Server Client (Supabase 服务端客户端)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 创建用于服务端环境的 Supabase 客户端实例。
 *
 * 使用场景：
 * ---------
 * - Server Components（React Server Components）
 * - Server Actions（表单提交、数据修改）
 * - API Routes（app/api 目录下的路由处理器）
 * - Route Handlers（GET/POST/PUT/DELETE 等处理器）
 *
 * 与客户端客户端的区别：
 * ---------------------
 * | 特性 | 客户端客户端 | 服务端客户端 |
 * |------|-------------|-------------|
 * | 位置 | lib/supabase/client.ts | lib/supabase/server.ts (本文件) |
 * | 使用环境 | 浏览器 | Node.js/Edge Runtime |
 * | Cookie 处理 | 自动从浏览器读取 | 需要手动从 cookies() 读取 |
 * | RLS | 自动使用用户身份 | 需要手动传递用户身份 |
 *
 * ⚠️ Fluid Compute 重要提示：
 * --------------------------
 * 如果你的应用部署在 Vercel Fluid Compute 或类似的无服务器环境中：
 * **绝对不要将 createClient() 的返回值缓存在全局变量中！**
 *
 * 原因：
 * - Fluid Compute 的容器可能会被复用
 * - 缓存的客户端会保留上一次请求的 cookies
 * - 导致用户 A 看到用户 B 的数据（严重的安全问题！）
 *
 * 正确用法：
 * ```ts
 * // ❌ 错误：全局缓存
 * let cachedClient: SupabaseClient;
 * export function getClient() {
 *   if (!cachedClient) cachedClient = createClient();
 *   return cachedClient;
 * }
 *
 * // ✅ 正确：每次调用都创建新实例
 * export async function getServerData() {
 *   const supabase = createClient(); // 每次都是新的
 *   const { data } = await supabase.from('notes').select('*');
 *   return data;
 * }
 * ```
 *
 * @module lib/supabase/server
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 创建 Supabase 服务端客户端
 *
 * 业务流程：
 * ---------
 * 1. 从 Next.js cookies() 读取当前请求的 cookies
 * 2. 创建 Supabase 客户端，配置 cookies 适配器
 * 3. 返回客户端实例
 *
 * Cookies 适配器说明：
 * ------------------
 * Supabase 需要读写 cookies 来管理会话。在服务端环境中，
 * 没有原生的 document.cookie API，所以需要提供适配器：
 *
 * - getAll(): 从 Next.js cookies() 读取所有 cookies
 * - setAll(): 将 cookies 写入 Next.js cookies()（但要注意异常处理）
 *
 * 为什么 setAll 有 try-catch？
 * --------------------------
 * 在 Server Component 中调用 set() 会抛出错误（因为 SC 是只读的）。
 * 这是正常的，因为：
 * 1. Server Component 不应该写入 cookies（那是 Server Action 的事）
 * 2. Supabase 会尝试刷新 token，但在 SC 中失败是可以接受的
 * 3. 只要在 middleware 中调用了 getClaims()，token 会被正确刷新
 *
 * 返回值：
 * -------
 * 返回一个 SupabaseClient 实例，可以用于所有 Supabase 操作：
 * - 数据库查询（.from() .select() .insert() 等）
 * - 认证操作（.auth.getUser() .auth.signInWithPassword() 等）
 * - Storage 操作（.storage.from() .upload() 等）
 *
 * @returns Promise<SupabaseClient> - Supabase 客户端实例
 *
 * @example
 * ```ts
 * // Server Component 中使用
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function Page() {
 *   const supabase = createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   if (!user) {
 *     return <div>请先登录</div>;
 *   }
 *
 *   const { data: notes } = await supabase
 *     .from('notes')
 *     .select('*')
 *     .eq('user_id', user.id);
 *
 *   return <div>{notes?.map(note => <NoteCard key={note.id} note={note} />)}</div>;
 * }
 * ```
 *
 * @example
 * ```ts
 * // API Route 中使用
 * import { createClient } from '@/lib/supabase/server';
 * import { NextResponse } from 'next/server';
 *
 * export async function POST(request: Request) {
 *   const supabase = createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   const { data } = await supabase
 *     .from('notes')
 *     .insert({ title: '新笔记', user_id: user.id })
 *     .select()
 *     .single();
 *
 *   return NextResponse.json(data);
 * }
 * ```
 */
export async function createClient() {
  // 从 Next.js 获取当前请求的 cookie store
  // cookies() 是 Next.js 提供的异步函数，返回当前请求的 cookies
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Supabase 读取 cookies 时调用
        // 返回当前请求中的所有 cookies（包括 session token）
        getAll() {
          return cookieStore.getAll();
        },

        // Supabase 写入 cookies 时调用
        // 例如：刷新 session token 后需要更新 cookie
        setAll(cookiesToSet) {
          try {
            // 尝试将每个 cookie 写入 cookie store
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 如果抛出错误，忽略它
            // 这通常发生在 Server Component 中（因为 SC 是只读的）
            //
            // ⚠️ 重要：如果你的应用使用了代理刷新功能（在 middleware 中），
            // 这里的错误可以忽略，因为 token 刷新会在 middleware 中处理。
            //
            // 如果没有代理刷新，你可能需要在 Server Action 中手动处理 token 刷新。
          }
        },
      },
    },
  );
}
