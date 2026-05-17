# 迁移到自托管 Supabase 实施计划

> 状态：待执行
> 目标：将当前 Supabase Cloud 实例完整迁移到自托管 Supabase（Docker Compose），应用代码 0 改动
> 预计工期：3–5 个工作日（含验证 + 灰度）
> 主要交付：服务器一套自托管 Supabase + 全量数据迁移 + Next.js 应用切换

---

## 0. 背景与范围

### 当前 Supabase Cloud 使用面（已审计）

| 模块 | 使用程度 | 迁移后保留 |
|------|---------|----------|
| Auth (GoTrue) — Email/Password + Google/GitHub OAuth + Email Verify | 高 | ✅ 完整保留 |
| Postgres — 27 张表 / 26 迁移 / 14 触发器 / 7 PL/pgSQL 函数 / FTS | 高 | ✅ 完整保留 |
| RLS — 全表启用，`auth.uid()` 过滤 | 高 | ✅ 完整保留 |
| Storage — bucket `user-files`，含签名上传 URL | 中 | ✅ 完整保留 |
| Realtime | 未使用 | ⛔ 关闭节省资源 |
| Edge Functions — `membership-expiry-check` / `smart-topics-nightly-refresh` | 低 | ✅ 重新部署 |
| Service Role Key — worker / extension API 使用 | 中 | ✅ 自签发 |
| pgvector / 向量检索 | 未使用 | ⛔ 不启用 |
| pg_cron | 未使用（Cloud 用 Supabase Scheduler） | ✅ 启用替代 |

### 非目标

- 不重构 Auth 实现（保持 `@supabase/ssr`）
- 不替换 ORM/查询层（继续用 `@supabase/supabase-js`）
- 不引入 Realtime 等未使用特性

---

## 1. 前置条件

### 1.1 基础设施
- [ ] 准备 1 台服务器（推荐 4C / 8G / 100G SSD，Ubuntu 22.04 LTS）
- [ ] 域名 + DNS：`supabase.your-domain.com`（Studio 和 API Gateway 共用）
- [ ] TLS：Caddy/Nginx + Let's Encrypt（推荐 Caddy 自动续签）
- [ ] 防火墙开放：`443`、`80`（HTTPS 反代），其余端口仅内网

### 1.2 凭据准备
- [ ] SMTP 账号（建议 Resend / SendGrid / 阿里云邮件）— 用于邮箱验证、密码重置
- [ ] Google OAuth Client ID / Secret（需要补充回调白名单）
- [ ] GitHub OAuth App Client ID / Secret（需要补充回调白名单）
- [ ] 已申请好的 OpenAI / Jina / Tencent ASR Key（不变）

### 1.3 工具
- [ ] Docker ≥ 24，docker compose v2
- [ ] PostgreSQL 客户端 16+（用于 pg_dump/psql）
- [ ] `aws-cli` 或 `rclone`（用于 Storage 文件迁移）
- [ ] 本地开发机能直连 Supabase Cloud 的 Postgres（端口 5432，需在 Supabase Cloud Dashboard 拿到连接串）

---

## 2. Phase A · 自托管 Supabase 部署

### A.1 拉取仓库 + 生成密钥
```bash
# 在服务器上
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env

# 生成 JWT secret（最少 32 字符）
openssl rand -base64 48 | tr -d '\n' > /tmp/jwt_secret
# 用此 secret 在 https://supabase.com/docs/guides/self-hosting/docker#api-keys 生成 anon / service_role JWT
```

- [ ] 修改 `.env` 中以下关键字段：

```env
POSTGRES_PASSWORD=<强密码>
JWT_SECRET=<上面生成的 secret>
ANON_KEY=<生成的 anon JWT>
SERVICE_ROLE_KEY=<生成的 service_role JWT>
DASHBOARD_USERNAME=<Studio 登录用户名>
DASHBOARD_PASSWORD=<Studio 登录密码>

# 站点 URL（影响邮件中的链接）
SITE_URL=https://newsbox.your-domain.com
API_EXTERNAL_URL=https://supabase.your-domain.com
SUPABASE_PUBLIC_URL=https://supabase.your-domain.com

# SMTP
SMTP_ADMIN_EMAIL=admin@your-domain.com
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<resend_api_key>
SMTP_SENDER_NAME=NewsBox

# Auth - OAuth
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false   # 生产建议保留邮箱验证
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<google_client_id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<google_client_secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://supabase.your-domain.com/auth/v1/callback
GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=<github_client_id>
GOTRUE_EXTERNAL_GITHUB_SECRET=<github_client_secret>
GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=https://supabase.your-domain.com/auth/v1/callback
```

### A.2 启动服务
```bash
docker compose pull
docker compose up -d
docker compose ps   # 检查全部 healthy
```

- [ ] 访问 `https://supabase.your-domain.com` 看到 Studio
- [ ] 用 `DASHBOARD_USERNAME/PASSWORD` 登录
- [ ] 在 Studio → SQL Editor 跑 `SELECT version();` 确认 Postgres 16

### A.3 启用关键扩展
在 Studio SQL Editor 执行：
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 项目当前不需要 pgvector，跳过
```

### A.4 关闭未使用服务（可选，节省 ~500MB 内存）
若使用本项目仓库的 `docker/supabase/docker-compose.yml`（见交付物 2），可注释 `realtime`、`vector`、`analytics`。

---

## 3. Phase B · Schema + 数据迁移

> 详细脚本见 `scripts/migrate-supabase/`，本节是流程说明。

### B.1 拿到两端连接串
- [ ] Cloud DB URL：在 Supabase Cloud Dashboard → Project Settings → Database → Connection String（**Direct connection**，端口 5432）
- [ ] Self-hosted DB URL：`postgresql://postgres:<POSTGRES_PASSWORD>@<server-ip>:5432/postgres`

### B.2 Schema 迁移（两种选择二选一）

**方案 1（推荐）：复用项目内 migration 文件**
```bash
# 在本地运行
cd scripts/migrate-supabase
./02-apply-schema.sh "<self-hosted-db-url>"
```
按 001 → 025 顺序对自托管库执行 `supabase/migrations/*.sql`。

**方案 2：从 Cloud dump schema**
```bash
./01-dump-cloud-schema.sh "<cloud-db-url>" > cloud-schema.sql
psql "<self-hosted-db-url>" < cloud-schema.sql
```
适合担心本地 migration 与 Cloud 实际状态有差异的情况（如手动改过）。

### B.3 业务数据迁移
```bash
./03-dump-cloud-data.sh "<cloud-db-url>"   # 输出 cloud-data.sql（仅 public schema 数据）
./04-import-data.sh "<self-hosted-db-url>" cloud-data.sql
```

⚠️ 注意：
- `--data-only --disable-triggers` 是必需的（绕过 FK + trigger）
- 大表 `note_visit_events`、`knowledge_note_embeddings`、`transcripts` 可能很大，导入耗时

### B.4 Auth 用户迁移（关键步骤）
```bash
./05-dump-auth-users.sh "<cloud-db-url>"   # 输出 cloud-auth.sql
./06-import-auth-users.sh "<self-hosted-db-url>" cloud-auth.sql
```

迁移内容：`auth.users` + `auth.identities` + `auth.mfa_factors` + `auth.refresh_tokens`（可选）

**JWT secret 必须保持一致才能让现有 session 继续有效**。但 Cloud 的 JWT secret 拿不到 → 用户会被强制重新登录一次。这是已知限制，事先公告。

### B.5 Storage 迁移
```bash
./07-migrate-storage.sh   # 用 rclone 把 user-files 桶整桶拷贝
```

需要：
- Cloud Storage 的 S3 兼容凭据（Storage Settings 里启用 S3 Protocol）
- Self-hosted Storage 的 S3 凭据（默认开启）

⚠️ Storage 元数据（`storage.objects` 表）会随 Phase B.3 一起迁入，但**实际文件**要单独拷。先迁文件再迁元数据顺序更稳。

### B.6 验证
```bash
./08-verify.sh "<cloud-db-url>" "<self-hosted-db-url>"
```
比对：
- [ ] 每张表行数一致
- [ ] `auth.users` 数量一致
- [ ] 随机抽 5 个 user_id 在两边 join `notes` 行数一致
- [ ] Storage 文件数量一致

---

## 4. Phase C · Edge Functions 重新部署

### C.1 部署函数
```bash
# 本地安装 supabase CLI
brew install supabase/tap/supabase

# 链接到自托管实例
export SUPABASE_ACCESS_TOKEN=<不需要，自托管走 API URL>
supabase functions deploy membership-expiry-check \
  --project-ref <skip> \
  --no-verify-jwt \
  --import-map ./supabase/functions/import_map.json

# 或者用 docker-compose 内置的 edge-runtime 直接 mount 函数代码（见交付物 2）
```

### C.2 定时调度（pg_cron 替代 Supabase Scheduler）

在 Studio SQL Editor 执行：
```sql
-- 每天凌晨 3 点跑会员到期检查
SELECT cron.schedule(
  'membership-expiry-check',
  '0 3 * * *',
  $$ SELECT net.http_post(
    url := 'http://kong:8000/functions/v1/membership-expiry-check',
    headers := jsonb_build_object('Authorization', 'Bearer <service_role_key>')
  ); $$
);

-- 每天凌晨 4 点跑智能主题刷新（调应用 cron 端点）
SELECT cron.schedule(
  'smart-topics-nightly-refresh',
  '0 4 * * *',
  $$ SELECT net.http_post(
    url := 'https://newsbox.your-domain.com/api/knowledge/topics/nightly-refresh',
    headers := jsonb_build_object('x-cron-secret', '<KNOWLEDGE_CRON_SECRET>')
  ); $$
);
```

需启用 `pg_net` 扩展：
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

- [ ] 在 Studio → Database → Cron Jobs 看到两个任务
- [ ] 手动触发一次确认能正确调用

---

## 5. Phase D · 应用切换

### D.1 Next.js 环境变量切换

修改生产 `.env.production` 或 Vercel/Docker 环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.your-domain.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<新的 anon key>
SUPABASE_SERVICE_ROLE_KEY=<新的 service_role key>
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=user-files
```

### D.2 CSP 头部白名单调整

修改 `next.config.ts`，把新域名加入 `connect-src` 和 `frame-src`：

```ts
isDev
  ? "connect-src 'self' https: http: ws: wss:"
  : "connect-src 'self' https://supabase.your-domain.com https://*.your-domain.com",
```

> 当前 `connect-src 'self' https:` 已经允许所有 HTTPS，技术上不需要改。但显式白名单更安全，建议生产收紧。

### D.3 OAuth 提供商更新回调 URL
- [ ] Google Cloud Console → 凭据 → 添加授权重定向 URI：
  `https://supabase.your-domain.com/auth/v1/callback`
- [ ] GitHub Settings → Developer settings → OAuth Apps → 更新 Authorization callback URL

### D.4 灰度部署
- [ ] 部署 1 个 staging 应用指向自托管 Supabase
- [ ] 自己账号跑通：登录 / 注册 / 邮箱验证 / OAuth / 创建 note / 上传图片 / AI 摘要 / 视频任务
- [ ] DNS/Env 全量切换
- [ ] 保留 Cloud 实例只读 1 周（关闭新写入，作为回滚源）

---

## 6. Phase E · 运维基线

### E.1 备份
- [ ] Postgres 每日凌晨 `pg_dump` → 异地 S3（脚本：`scripts/ops/backup-pg.sh`，下次迭代写）
- [ ] Storage 文件用 rclone sync 每周快照
- [ ] 保留策略：日备 30 天 / 周备 12 周

### E.2 监控
- [ ] Prometheus + Grafana 监控 docker compose
- [ ] 关键指标：Postgres 连接数、磁盘使用率、Auth 错误率、Storage 容量
- [ ] 邮件/钉钉/飞书告警

### E.3 安全
- [ ] 服务器只开 80/443，5432 仅内网或跳板机
- [ ] Studio 用 HTTP Basic Auth + IP 白名单
- [ ] service_role key 仅放服务端，绝不进客户端打包
- [ ] 定期轮换 JWT secret（**会让所有 session 失效**，需通告）

---

## 7. 回滚预案

任一阶段出问题：

| 阶段 | 回滚动作 | 影响 |
|------|---------|------|
| Phase A 失败 | docker compose down + 删 volumes | 无（未切流量） |
| Phase B 失败 | 自托管库 truncate + 重新导入 | 无（未切流量） |
| Phase D 切流量后失败 | env 改回 Cloud URL + redeploy | 用户 5 min 内可能看到错误 |

**关键**：Phase D 切换前确保 Cloud 实例**仍可写**，必要时 24h 内可双写恢复。

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Cloud JWT secret 拿不到 → 用户被踢下线 | 100% | 中 | 提前公告，引导重新登录 |
| OAuth 用户的 `identities.provider_id` 与新 GoTrue 不兼容 | 中 | 高 | 提前在 staging 用真实账号验证；必要时让 OAuth 用户走"忘记密码" |
| `auth.users` 主键冲突（service role 已生成种子用户） | 低 | 高 | 自托管初始化时不创建任何用户；先迁后用 |
| Storage 文件路径 hash 冲突 | 低 | 低 | rclone 用相同 key，不重命名 |
| pg_cron 与应用时区不一致 | 中 | 低 | 启动 Postgres 时 `TZ=Asia/Shanghai`，cron 表达式按 UTC 写 |
| 大表迁移超时 | 中 | 中 | 用 `--jobs=4` 并行；预估 `note_visit_events` 行数 |

---

## 9. 验收清单（上线判据）

- [ ] Studio 可访问，所有服务 healthy
- [ ] 现有用户能登录（邮箱密码 + Google + GitHub）
- [ ] 新用户能注册并收到验证邮件
- [ ] Dashboard 无限滚动正常，notes 数量与 Cloud 一致
- [ ] 上传图片正常显示
- [ ] AI 摘要 / 视频任务正常推进
- [ ] 知识库 / 智能主题正常
- [ ] pg_cron 两个任务 24h 内成功触发一次
- [ ] 7 天无 P0/P1 故障

---

## 10. 时间表

| 日期 | 阶段 | 交付物 |
|------|------|--------|
| D1 | Phase A | 自托管 Supabase 跑起来 |
| D2 | Phase B (Schema + 数据) | 数据完整迁移到新库 |
| D3 | Phase B (Auth + Storage) + Phase C | Auth/文件/Edge Function 全部就绪 |
| D4 | Phase D (staging) | Staging 验证通过 |
| D5 | Phase D (prod) + Phase E | 切流量 + 监控建立 |

---

## 附录：命令速查

```bash
# 在自托管服务器上
docker compose logs -f auth          # GoTrue 日志
docker compose logs -f kong          # API 网关日志
docker compose exec db psql -U postgres   # 直连数据库
docker compose restart auth          # 重启某服务

# 备份
docker compose exec db pg_dump -U postgres postgres | gzip > backup-$(date +%F).sql.gz

# 容器内 cron 状态
docker compose exec db psql -U postgres -c "SELECT * FROM cron.job;"
docker compose exec db psql -U postgres -c "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"
```
