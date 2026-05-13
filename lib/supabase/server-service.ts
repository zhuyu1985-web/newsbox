// lib/supabase/server-service.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Service role client（绕 RLS），用于后台 worker 操作。
 * ⚠️ 仅限服务器端使用，绝不暴露到客户端。
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for worker DB access');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
