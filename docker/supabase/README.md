# NewsBox 自托管 Supabase

## 目录结构
```
docker/supabase/
├── docker-compose.yml        # 编排（已剔除 realtime/vector）
├── .env.example              # 环境变量模板
├── README.md                 # 本文档
└── volumes/
    ├── kong/kong.yml         # API 网关路由配置
    ├── db/data/              # Postgres 数据目录（首次启动自动创建）
    └── storage/              # Storage 文件目录（首次启动自动创建）
```

## 快速开始

```bash
cd docker/supabase
cp .env.example .env
# 编辑 .env：
#   - POSTGRES_PASSWORD / JWT_SECRET 改为强密码
#   - 在 https://supabase.com/docs/guides/self-hosting/docker#api-keys 用 JWT_SECRET 生成 anon/service_role key
#   - SMTP / OAuth 等按需填写

docker compose pull
docker compose up -d
docker compose ps      # 全部 healthy
```

访问 Studio：`http://127.0.0.1:18000`（用 .env 里的 DASHBOARD_USERNAME/PASSWORD 登录）

生产环境用 Caddy/Nginx 终结 TLS，把 `https://supabase.your-domain.com` → `127.0.0.1:18000`

## 端口说明（与已有 supabase 实例并行）
该 compose 的 `COMPOSE_PROJECT_NAME=supabase-newsbox`、所有 container 名带 `supabase-newsbox-` 前缀，端口段统一 +10000，可以与系统内其他 supabase 实例同时运行。

| 端口 | 服务 | 是否对外 | 旧默认 |
|------|------|---------|--------|
| 18000 | Kong (HTTP) | ✅ 反代后唯一入口 | 8000 |
| 18443 | Kong (HTTPS) | 可选 | 8443 |
| 15432 | Postgres | ❌ 仅 127.0.0.1 | 5432 |

## 已剔除的服务
- **realtime**：项目未使用实时订阅
- **vector / analytics**：日志聚合，初期不需要（默认保留 analytics 让 Studio 不报错；要省内存可注释 + Studio env `NEXT_PUBLIC_ENABLE_LOGS=false`）

需要恢复时取消 `docker-compose.yml` 中对应段落注释即可。

## 数据持久化
所有状态都在 `./volumes/` 下：
- `volumes/db/data/` — Postgres 数据
- `volumes/storage/` — 用户上传的文件

备份这两个目录 = 全量备份。

## 常用命令
```bash
docker compose logs -f auth          # 看 GoTrue 日志
docker compose exec db psql -U postgres
docker compose restart auth

# 备份
docker compose exec -T db pg_dump -U postgres postgres | gzip > backup-$(date +%F).sql.gz

# pg_cron 状态
docker compose exec db psql -U postgres -c "SELECT * FROM cron.job;"
```

## 升级
```bash
docker compose pull && docker compose up -d
```
建议先在 staging 验证后再升级生产。

## 故障排查
| 现象 | 排查 |
|------|------|
| Studio 显示 "Failed to load schema" | `docker compose logs meta` |
| 登录后 redirect 失败 | 检查 `.env` 中 `API_EXTERNAL_URL` 是否与浏览器实际访问 URL 一致 |
| OAuth 回调 400 | OAuth 平台的 Authorized Redirect URI 与 `GOTRUE_EXTERNAL_*_REDIRECT_URI` 不一致 |
| 上传文件 413 | 检查 `FILE_SIZE_LIMIT`（默认 500MB），反代如 Nginx 还需 `client_max_body_size` |

## 与项目应用对接

**本地开发** `.env.local`：
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:18000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<docker .env 里的 ANON_KEY>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<同上>
SUPABASE_SERVICE_ROLE_KEY=<docker .env 里的 SERVICE_ROLE_KEY>
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=user-files
```

**生产**：把 `127.0.0.1:18000` 换成反代域名。

## 从云端 Supabase 一次性迁移到本实例

完整脚本在 `scripts/migrate-supabase/`。最小流程：
```bash
cd ../../scripts/migrate-supabase
cp .env.example .env   # 填两端连接串（LOCAL_DB_URL 用 postgres://postgres:<密码>@127.0.0.1:15432/postgres）
./02-apply-schema.sh   # 在本地库执行 supabase/migrations/*.sql
./03-dump-cloud-data.sh && ./04-import-data.sh   # 业务数据
./05-dump-auth-users.sh && ./06-import-auth-users.sh   # auth.users
# 跳过 07-migrate-storage.sh：本项目文件已在腾讯 COS，URL 不动即可
./08-verify.sh         # 行数核对
```
完成后改 `.env.local` 指向 `http://127.0.0.1:18000`，重启 dev server 即可。
