/**
 * ============================================================================
 * Supabase Browser Client (Supabase 客户端客户端)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 创建用于浏览器环境的 Supabase 客户端实例。
 *
 * 使用场景：
 * ---------
 * - Client Components（标记为 "use client" 的 React 组件）
 * - 事件处理器（onClick、onChange 等）
 * - useEffect hooks（客户端数据获取）
 * - 浏览器 API 调用
 *
 * 与服务端客户端的区别：
 * ---------------------
 * | 特性 | 客户端客户端 (本文件) | 服务端客户端 |
 * |------|---------------------|-------------|
 * | 位置 | lib/supabase/client.ts | lib/supabase/server.ts |
 * | 使用环境 | 浏览器 | Node.js/Edge Runtime |
 * | Cookie 处理 | 自动从 document.cookie 读取 | 需要手动从 cookies() 读取 |
 * | 创建函数 | createBrowserClient() | createServerClient() |
 * | 实例复用 | 可以全局缓存（单例模式） | 必须每次创建新实例 |
 *
 * 为什么客户端可以缓存？
 * --------------------
 * 在浏览器中，createBrowserClient() 内部使用单例模式：
 * - 多次调用 createClient() 返回的是同一个实例
 * - 这避免了创建多个 subscription（实时订阅）
 * - 减少内存占用和网络连接
 *
 * 注意事项：
 * ---------
 * 1. **不要在 Server Component 中使用**：会导致 "document is not defined" 错误
 * 2. **不要在 API Route 中使用**：API Route 运行在服务端，应该用 server.ts
 * 3. **RLS 自动生效**：因为客户端会自动附上用户的 session token
 *
 * @module lib/supabase/client
 */

import { createBrowserClient } from "@supabase/ssr";

/**
 * 创建 Supabase 客户端客户端
 *
 * 业务流程：
 * ---------
 * 1. 从环境变量读取 Supabase URL 和密钥
 * 2. 调用 createBrowserClient() 创建客户端实例
 * 3. 返回客户端（内部自动缓存为单例）
 *
 * 客户端特性：
 * -----------
 * 1. **自动 Cookie 管理**：
 *    - 自动从 document.cookie 读取 session token
 *    - 自动在请求中附上 Authorization header
 *    - 自动刷新过期的 token
 *
 * 2. **Realtime 订阅**：
 *    - 支持 .channel().on() 订阅数据库变更
 *    - 自动管理 WebSocket 连接
 *
 * 3. **Auth 状态同步**：
 *    - 支持 onAuthStateChange() 监听登录/登出事件
 *    - 自动更新 UI 状态
 *
 * 4. **Row Level Security (RLS)**：
 *    - 自动使用当前用户的身份执行查询
 *    - 确保用户只能访问自己的数据
 *
 * ⚠️ 常见错误及解决方案：
 * -----------------------
 *
 * 错误 1: "document is not defined"
 * 原因：在 Server Component 中使用了客户端客户端
 * 解决：
 * ```ts
 * // ❌ 错误：Server Component
 * export default async function Page() {
 *   const supabase = createClient(); // 报错！
 *   return <div>...</div>;
 * }
 *
 * // ✅ 正确：改为 Server Component 使用 server.ts
 * import { createClient as createServerClient } from '@/lib/supabase/server';
 * export default async function Page() {
 *   const supabase = createServerClient();
 *   return <div>...</div>;
 * }
 *
 * // ✅ 正确：或改为 Client Component
 * "use client";
 * import { createClient } from '@/lib/supabase/client';
 * export default function Page() {
 *   const supabase = createClient();
 *   return <div>...</div>;
 * }
 * ```
 *
 * 错误 2: RLS 不生效（能看到其他用户的数据）
 * 原因：可能是在 Server Component 中使用了客户端客户端，但用户未登录
 * 解决：确保使用 server.ts，并在 middleware 中验证用户身份
 *
 * @returns SupabaseClient - Supabase 客户端实例（单例）
 *
 * @example
 * ```ts
 * // Client Component 中使用
 * "use client";
 * import { createClient } from '@/lib/supabase/client';
 * import { useEffect, useState } from 'react';
 *
 * export default function NoteList() {
 *   const [notes, setNotes] = useState([]);
 *   const supabase = createClient();
 *
 *   useEffect(() => {
 *     // 客户端查询：自动使用当前用户的身份
 *     supabase
 *       .from('notes')
 *       .select('*')
 *       .then(({ data }) => setNotes(data));
 *   }, []);
 *
 *   // 实时订阅：当数据库有变更时自动更新
 *   useEffect(() => {
 *     const channel = supabase
 *       .channel('notes-changes')
 *       .on('postgres_changes', {
 *         event: '*',
 *         schema: 'public',
 *         table: 'notes',
 *         filter: `user_id=eq.${supabase.auth.getUser().data.user?.id}`
 *       }, (payload) => {
 *         console.log('变更:', payload);
 *       })
 *       .subscribe();
 *
 *     return () => {
 *       supabase.removeChannel(channel);
 *     };
 *   }, [supabase]);
 *
 *   return <div>{notes.map(note => <NoteCard key={note.id} note={note} />)}</div>;
 * }
 * ```
 *
 * @example
 * ```ts
 * // 事件处理器中使用
 * "use client";
 * import { createClient } from '@/lib/supabase/client';
 *
 * export function DeleteButton({ noteId }: { noteId: string }) {
 *   const supabase = createClient();
 *
 *   const handleClick = async () => {
 *     const { error } = await supabase
 *       .from('notes')
 *       .delete()
 *       .eq('id', noteId);
 *
 *     if (error) {
 *       alert('删除失败: ' + error.message);
 *     } else {
 *       alert('删除成功');
 *       // 触发页面刷新或更新状态
 *       window.location.reload();
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>删除</button>;
 * }
 * ```
 */
export function createClient() {
  // createBrowserClient() 内部使用单例模式
  // 多次调用 createClient() 会返回同一个实例
  //
  // 单例的好处：
  // 1. 避免创建多个 Realtime 连接（每个连接都会消耗资源）
  // 2. 确保 Auth 状态在整个应用中一致
  // 3. 减少内存占用
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
