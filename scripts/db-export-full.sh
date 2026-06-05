#!/usr/bin/env bash
# Newsbox 全量数据库导出脚本（覆盖 public + auth + storage）
#
# 用法：
#   ./scripts/db-export-full.sh                 # 自动版本号（按当日 vN 递增）
#   ./scripts/db-export-full.sh 2026-05-18 v2   # 手动指定日期 + 版本
#
# 产出：
#   backups/<DATE>-<VERSION>/full.sql           # 一份 SQL，包含：
#       - public schema + data（DROP + CREATE + COPY）
#       - auth 业务数据（users / identities，data-only）
#       - storage 业务数据（buckets / objects，data-only）
#       - 外层包 BEGIN; SET session_replication_role=replica; ... COMMIT;
#         在恢复期间临时关闭 FK 检查，避免顺序问题
#   backups/<DATE>-<VERSION>/README.md          # 恢复说明
#   backups/<DATE>-<VERSION>/orphan-rows.log    # 孤儿检测结果
#   backups/MANIFEST.md                         # 版本登记（追加一行）
#
# 适用场景：
#   目标库为"全新自托管 Supabase"。auth.users 等表为空，可直接 INSERT。
#   如果目标已有数据，请先手工 TRUNCATE 相关表或换用 pg_restore --data-only。
#
# 孤儿检测：
#   通过 scripts/db-orphan-checks.sql 自定义（默认无）。FK 报错时再启用。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---- 0. 读取源库 DATABASE_URL ----
if [[ ! -f .env.local ]]; then
  echo "❌ .env.local 不存在" >&2
  exit 1
fi
DB_URL_INFO="$(python3 scripts/lib/load-export-database-url.py "$REPO_ROOT")"
DB_URL_SOURCE="${DB_URL_INFO%%	*}"
DATABASE_URL="${DB_URL_INFO#*	}"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ 源库连接串未设置（请添加 DB_EXPORT_DATABASE_URL 或 CLOUD_DB_URL）" >&2
  echo "   Supabase 控制台 → Project Settings → Database → Connection string（URI / Session pooler）" >&2
  exit 1
fi
echo "👉 数据源：${DB_URL_SOURCE}"
DB_URL_ERR="$(mktemp)"
if ! DATABASE_URL="$(python3 scripts/lib/normalize-database-url.py "$DATABASE_URL" 2>"$DB_URL_ERR")"; then
  echo "❌ 源库连接串格式无效：${DB_URL_SOURCE}" >&2
  cat "$DB_URL_ERR" >&2
  echo "ℹ️  如果要从当前 Sealos 库导出，请先确认单独运行 psql SELECT 1 能成功。" >&2
  echo "ℹ️  如果要从旧 Supabase Cloud 源库导出，请用 DB_EXPORT_DATABASE_URL 或 CLOUD_DB_URL 指向 Cloud 源库。" >&2
  rm -f "$DB_URL_ERR"
  exit 1
fi
rm -f "$DB_URL_ERR"
export DATABASE_URL

PG_DUMP="${PG_DUMP:-/opt/homebrew/opt/libpq/bin/pg_dump}"
PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"
if [[ ! -x "$PG_DUMP" ]]; then
  echo "❌ pg_dump 不存在: ${PG_DUMP}（brew install libpq 后再跑）" >&2
  exit 1
fi
if [[ ! -x "$PSQL" ]]; then
  echo "❌ psql 不存在: ${PSQL}（brew install libpq 后再跑）" >&2
  exit 1
fi

DB_CHECK_ERR="$(mktemp)"
if ! PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}" "$PSQL" "$DATABASE_URL" -At -X -c "SELECT 1" >/dev/null 2>"$DB_CHECK_ERR"; then
  echo "❌ DATABASE_URL 连接失败，导出前置检查未通过" >&2
  sed -E 's#(postgres(ql)?://)[^[:space:]]+#\1<REDACTED>#g' "$DB_CHECK_ERR" >&2
  if grep -Eq '198\.18\.|198\.19\.' "$DB_CHECK_ERR"; then
    echo "ℹ️  检测到 198.18/198.19 地址，这通常是代理/TUN 的 fake-ip DNS，不是真实数据库 IP。" >&2
  fi
  echo "ℹ️  请先确认源库连接串可用。单独 psql SELECT 1 成功后再运行导出。" >&2
  rm -f "$DB_CHECK_ERR"
  exit 1
fi
rm -f "$DB_CHECK_ERR"

# ---- 1. 计算 DATE / VERSION ----
DATE="${1:-$(date +%Y-%m-%d)}"
VERSION="${2:-}"
if [[ -z "$VERSION" ]]; then
  N=1
  while [[ -e "backups/${DATE}-v${N}" ]]; do
    N=$((N + 1))
  done
  VERSION="v${N}"
fi
OUT_DIR="backups/${DATE}-${VERSION}"
mkdir -p "$OUT_DIR"

echo "👉 导出到 $OUT_DIR"

# ---- 2. 孤儿检测（可选） ----
ORPHAN_LOG="$OUT_DIR/orphan-rows.log"
ORPHAN_CHECKS="scripts/db-orphan-checks.sql"
if [[ -f "$ORPHAN_CHECKS" && -s "$ORPHAN_CHECKS" ]]; then
  "$PSQL" "$DATABASE_URL" -At -f "$ORPHAN_CHECKS" > "$ORPHAN_LOG" 2>/dev/null || true
else
  : > "$ORPHAN_LOG"
fi
ORPHAN_COUNT=$(wc -l < "$ORPHAN_LOG" | tr -d ' ')
echo "👉 检测到 ${ORPHAN_COUNT} 行孤儿数据（详见 ${ORPHAN_LOG}）"

# ---- 3. pg_dump：public 全量（schema + data） ----
PUBLIC_RAW="$OUT_DIR/_public.sql"
echo "👉 pg_dump public 中..."
"$PG_DUMP" "$DATABASE_URL" \
  --no-owner --no-acl --clean --if-exists \
  --schema=public --quote-all-identifiers \
  --format=plain \
  -f "$PUBLIC_RAW"
echo "   public 大小 $(du -h "$PUBLIC_RAW" | cut -f1)"

# ---- 4. pg_dump：auth + storage 数据（data-only，精选表） ----
# auth.users / auth.identities：用户账号 + 邮箱 + 哈希密码 + OAuth 关联
# storage.buckets / storage.objects：存储桶定义 + 文件元数据
#
# 故意排除：
#   - auth.schema_migrations / storage.migrations：目标库由 gotrue/storage-api 自己维护
#   - auth.sessions / auth.refresh_tokens：迁移后让用户重新登录最干净
#   - auth.audit_log_entries / auth.flow_state：审计与 OAuth 临时态，不需要带
DATA_AUTH_STORAGE="$OUT_DIR/_data_auth_storage.sql"
echo "👉 pg_dump auth + storage 数据中..."
"$PG_DUMP" "$DATABASE_URL" \
  --no-owner --no-acl --data-only \
  --table=auth.users \
  --table=auth.identities \
  --table=storage.buckets \
  --table=storage.objects \
  --quote-all-identifiers \
  --format=plain \
  -f "$DATA_AUTH_STORAGE"
echo "   auth+storage 数据 $(du -h "$DATA_AUTH_STORAGE" | cut -f1)"

# ---- 5. 孤儿剔除（仅作用于 public.sql 内的 COPY 块） ----
PUBLIC_CLEAN="$OUT_DIR/_public_clean.sql"
if (( ORPHAN_COUNT > 0 )); then
  python3 - "$PUBLIC_RAW" "$ORPHAN_LOG" "$PUBLIC_CLEAN" <<'PY'
import re, sys

raw_path, orphan_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

orphans = {}
with open(orphan_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line: continue
        parts = line.split("|", 1)
        if len(parts) != 2: continue
        tbl, rid = parts
        orphans.setdefault(tbl, set()).add(rid)

copy_re = re.compile(r'^COPY\s+"?public"?\."?([a-z_0-9]+)"?\s*\([^)]*\)\s+FROM\s+stdin;\s*$', re.IGNORECASE)

with open(raw_path, "r", encoding="utf-8") as fin, open(out_path, "w", encoding="utf-8") as fout:
    in_copy = False
    current_tbl = None
    skipped = 0
    for line in fin:
        if not in_copy:
            m = copy_re.match(line)
            if m:
                current_tbl = m.group(1)
                in_copy = True
            fout.write(line)
            continue
        if line.rstrip("\r\n") == "\\.":
            in_copy = False
            current_tbl = None
            fout.write(line)
            continue
        first = line.split("\t", 1)[0]
        if current_tbl in orphans and first in orphans[current_tbl]:
            skipped += 1
            continue
        fout.write(line)
    sys.stderr.write(f"  ➜ python 后处理：剔除 {skipped} 行孤儿数据\n")
PY
else
  cp "$PUBLIC_RAW" "$PUBLIC_CLEAN"
fi

# ---- 6. 拼装 full.sql：header + auth+storage + public + footer ----
# 顺序：先灌 auth.users 数据，再 DROP/CREATE public（FK 才能立得起来）。
# 兜底：session_replication_role=replica 关闭触发器与 FK 检查，避免任何顺序问题。
CLEAN_SQL="$OUT_DIR/full.sql"
{
  cat <<EOF
-- ============================================================
-- Newsbox 全量数据库导出（public + auth + storage）
-- Date    : ${DATE}
-- Version : ${VERSION}
-- Source  : $(echo "$DATABASE_URL" | sed -E 's|://[^@]+@|://<REDACTED>@|')
-- Tool    : $($PG_DUMP --version)
-- Orphans : 已剔除 ${ORPHAN_COUNT} 行（详见 同目录 orphan-rows.log）
--
-- 恢复（推荐用 -v ON_ERROR_STOP=1 严格模式）：
--   psql "\$TARGET" -v ON_ERROR_STOP=1 -f full.sql
--
-- 适用：目标库为全新自托管 Supabase（auth/storage 表空）
-- ============================================================

BEGIN;
SET session_replication_role = replica;  -- 关闭触发器 & FK 检查，避免顺序问题

EOF
  echo "-- ============================================================"
  echo "-- ① auth + storage 业务数据（data-only）"
  echo "-- ============================================================"
  cat "$DATA_AUTH_STORAGE"
  echo ""
  echo "-- ============================================================"
  echo "-- ② public schema + data"
  echo "-- ============================================================"
  cat "$PUBLIC_CLEAN"
  echo ""
  cat <<'EOF'
SET session_replication_role = DEFAULT;
COMMIT;
EOF
} > "$CLEAN_SQL"

rm -f "$PUBLIC_RAW" "$PUBLIC_CLEAN" "$DATA_AUTH_STORAGE"
echo "👉 $CLEAN_SQL 大小 $(du -h "$CLEAN_SQL" | cut -f1)"

# ---- 7. 写 README ----
cat > "$OUT_DIR/README.md" <<EOF
# Newsbox 全量数据库 ${DATE} ${VERSION}

| 字段 | 值 |
|------|----|
| 导出时间 | $(date +"%Y-%m-%d %H:%M:%S %Z") |
| 数据源 | $(echo "$DATABASE_URL" | sed -E 's|://[^@]+@|://<REDACTED>@|') |
| pg_dump 版本 | $($PG_DUMP --version | head -1) |
| 剔除孤儿行 | ${ORPHAN_COUNT} |
| 文件大小 | $(du -h "$CLEAN_SQL" | cut -f1) |

## 包含内容

| Schema | 范围 | 备注 |
|--------|------|------|
| public | schema + data | --clean --if-exists：DROP 后重建 |
| auth.users | data-only | 含邮箱、加密密码、metadata |
| auth.identities | data-only | OAuth 关联（如有） |
| storage.buckets | data-only | 桶定义 |
| storage.objects | data-only | 文件元数据（不含实际文件二进制） |

**未包含**：
- auth.schema_migrations / storage.migrations（gotrue/storage-api 自维护）
- auth.sessions / auth.refresh_tokens（让用户重新登录最干净）
- auth.audit_log_entries / auth.flow_state（审计与临时态）
- Supabase Storage 实际文件二进制（需另行从 \`user-files\` bucket 全量下载/上传）

## 恢复

\`\`\`bash
psql "\$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f full.sql
\`\`\`

文件首尾已包好 \`BEGIN / SET session_replication_role = replica\` 与 \`COMMIT\`，
导入期间 FK 检查关闭，恢复后自动复位。

## 自托管 Supabase 恢复前置条件

1. 目标 Postgres 必须已经通过官方 docker-compose 启动过一次（已存在 \`auth\`、\`storage\` schema 及其内部表结构）
2. 目标库的 \`auth.users\` 应为空（新部署）。若已有数据，先：
   \`\`\`sql
   TRUNCATE auth.users CASCADE;
   TRUNCATE storage.objects, storage.buckets CASCADE;
   \`\`\`
3. 实际文件二进制：需要单独把源端 \`user-files\` bucket 下的对象拷贝过去（Tencent COS 已支持，参考 \`STORAGE_PROVIDER\` 切换）
EOF

# ---- 8. 追加 MANIFEST ----
MANIFEST="backups/MANIFEST.md"
if [[ ! -f "$MANIFEST" ]]; then
  cat > "$MANIFEST" <<'MEOF'
# Newsbox 数据库导出登记表

每行登记一份全量或增量。**新增加在表底**。

| 日期 | 版本 | 类型 | 文件 | 大小 | 孤儿剔除 | 备注 |
|------|------|------|------|------|----------|------|
MEOF
fi
SIZE_HUMAN=$(du -h "$CLEAN_SQL" | cut -f1)
echo "| ${DATE} | ${VERSION} | full | ${OUT_DIR}/full.sql | ${SIZE_HUMAN} | ${ORPHAN_COUNT} | public+auth+storage |" >> "$MANIFEST"

echo ""
echo "✅ 完成"
echo "   $CLEAN_SQL"
echo "   $OUT_DIR/README.md"
echo "   $MANIFEST （已追加登记）"
