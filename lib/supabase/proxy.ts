/**
 * ============================================================================
 * Supabase Middleware Proxy (Supabase 中间件代理)
 * ============================================================================
 *
 * 模块职责：
 * ---------
 * 作为 Next.js Middleware，在每个请求到达页面或 API Route 之前执行，
 * 负责：
 * 1. 刷新用户会话（避免过期）
 * 2. 保护需要认证的路由（重定向未登录用户）
 * 3. 防止已登录用户访问登录/注册页面（重定向到工作台）
 *
 * 架构位置：
 * ---------
 * 位于 Next.js 请求链的最前端，执行顺序：
 * Browser Request → Middleware → Server Components/API Routes → Response
 *
 * 关键设计点：
 * -------------
 * 1. **Fluid Compute 兼容**：不缓存 Supabase 客户端，每次请求都创建新实例
 * 2. **Cookie 同步**：确保服务端的 session 变更能传递到浏览器
 * 3. **会话持久化**：使用 getClaims() 而不是 getUser()，避免随机登出问题
 *
 * 配置位置：
 * ---------
 * 在 `middleware.ts` 中调用：
 * ```ts
 * export { middleware as GET, middleware as POST } from '@/lib/supabase/proxy';
 * export const middleware = updateSession;
 * ```
 *
 * @module lib/supabase/proxy
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

/**
 * 中间件主函数：更新会话并处理路由保护
 *
 * 业务流程：
 * ---------
 * 1. 创建 Supabase 服务端客户端（读取请求中的 cookies）
 * 2. 调用 getClaims() 刷新会话并获取用户信息
 * 3. 检查当前路径是否需要认证
 * 4. 如果用户未登录且访问受保护路径 → 重定向到登录页
 * 5. 如果用户已登录且访问认证页面 → 重定向到工作台
 * 6. 返回带有更新后 cookies 的响应
 *
 * 为什么必须调用 getClaims()？
 * -----------------------------
 * - getUser() 不会刷新会话，可能导致用户在 token 过期后突然登出
 * - getClaims() 会自动刷新 access token（如果接近过期）
 * - 这是 Supabase SSR 官方推荐的最佳实践
 *
 * ⚠️ 重要注意事项：
 * ---------------
 * - 必须返回 supabaseResponse 对象，不能创建新的响应（除非复制 cookies）
 * - 不能在 createServerClient 和 getClaims() 之间插入业务逻辑
 * - 不要修改或删除 supabaseResponse 的 cookies
 *
 * @param request - Next.js 请求对象
 * @returns NextResponse - 带有更新后 cookies 的响应（或重定向响应）
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { updateSession } from '@/lib/supabase/proxy';
 *
 * export const middleware = updateSession;
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 */
export async function updateSession(request: NextRequest) {
  // ========================================================================
  // Step 1: 初始化响应对象
  // ========================================================================

  // 创建一个"透传"响应，后续会在这个响应上设置 cookies
  // 注意：这里使用 NextResponse.next() 而不是 NextResponse.json()，
  // 因为我们需要让原始请求继续到达页面/API Route
  let supabaseResponse = NextResponse.next({
    request,
  });

  // ========================================================================
  // Step 2: 环境变量检查（开发阶段保护）
  // ========================================================================

  // 如果环境变量未配置，跳过 Supabase 检查
  // 这是为了在项目初始阶段（未配置 Supabase）不至于阻塞所有请求
  // 项目上线后应该移除这个检查，或者配置正确的环境变量
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // ========================================================================
  // Step 3: 创建 Supabase 服务端客户端
  // ========================================================================

  // ⚠️ Fluid Compute 注意事项：
  // -------------------------
  // 在 Vercel Fluid Compute 或类似的无服务器环境中，
  // 绝对不要将 Supabase 客户端缓存在全局变量中。
  // 每次请求都必须创建新的客户端实例，否则会导致：
  // - 用户会话混乱（用户 A 看到用户 B 的数据）
  // - 内存泄漏
  // - 难以调试的间歇性错误
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // 读取请求中的所有 cookies（包含 session token）
        getAll() {
          return request.cookies.getAll();
        },

        // 设置 cookies 到响应中（当 Supabase 刷新 token 时会调用）
        setAll(cookiesToSet) {
          // 先设置到请求对象（用于后续中间件读取）
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          // 再设置到响应对象（返回给浏览器）
          // 注意：这里必须创建新的响应对象来设置 cookies
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ========================================================================
  // Step 4: 刷新会话并获取用户信息
  // ========================================================================

  // ⚠️ 关键：不要在 createServerClient 和 getClaims() 之间插入代码
  // ------------------------------------------------------------------------
  // 这是因为 Supabase 需要在创建客户端后立即检查会话状态，
  // 任何延迟都可能导致 token 过期检查不准确。
  //
  // 另外，必须使用 getClaims() 而不是 getUser()：
  // - getUser() 不会刷新 token，可能导致用户随机登出
  // - getClaims() 会自动刷新即将过期的 token
  //
  // 如果不调用 getClaims()，使用服务端 Supabase 客户端的用户会被随机登出！
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // ========================================================================
  // Step 5: 保护需要认证的路由
  // ========================================================================

  // 定义受保护的路径前缀
  // 这些路径需要用户登录才能访问
  //
  // NOTE: 如果需要保护更多路径，请在此处添加
  // 例如：const protectedPaths = ["/dashboard", "/protected", "/notes", "/knowledge"];
  const protectedPaths = ["/dashboard", "/protected"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // 如果访问受保护路径但用户未登录 → 重定向到登录页
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";

    // 添加重定向原因，方便前端显示提示信息
    // 登录后可以跳转回原页面
    url.searchParams.set("redirect", request.nextUrl.pathname);
    url.searchParams.set("reason", "auth_required");

    return NextResponse.redirect(url);
  }

  // ========================================================================
  // Step 6: 防止已登录用户访问认证页面
  // ========================================================================

  // 如果用户已登录，但访问的是登录/注册/确认页面 → 重定向到工作台
  //
  // 例外情况（不重定向的路径）：
  // - /auth/error: 认证错误页面（用户可能需要查看错误信息）
  // - /auth/confirm: 邮箱确认页面（用户点击邮件中的链接后到达）
  // - /auth/update-password: 密码重置/更新页面（用户可能需要重置密码）
  if (
    user &&
    request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/auth/error") &&
    !request.nextUrl.pathname.startsWith("/auth/confirm") &&
    !request.nextUrl.pathname.startsWith("/auth/update-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ========================================================================
  // Step 7: 返回响应
  // ========================================================================

  // ⚠️ 极其重要：必须返回 supabaseResponse 对象！
  // ------------------------------------------------------------------------
  // supabaseResponse 包含了 Supabase 刷新 token 后设置的 cookies，
  // 如果返回其他响应（例如 NextResponse.next()），cookies 会丢失，
  // 导致浏览器和服务器的 session 不同步，用户会被意外登出。
  //
  // 如果你需要修改响应（例如设置自定义 headers），请按以下步骤：
  //
  // 1. 先复制 supabaseResponse 的 cookies：
  //    const myNewResponse = NextResponse.next({ request });
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll());
  //
  // 2. 然后修改 myNewResponse（例如添加 headers）：
  //    myNewResponse.headers.set('X-Custom-Header', 'value');
  //
  // 3. 最后返回 myNewResponse
  //
  // 或者直接修改 supabaseResponse（但不推荐，保持它只用于 cookies）：
  //    supabaseResponse.headers.set('X-Custom-Header', 'value');
  //    return supabaseResponse;

  return supabaseResponse;
}
