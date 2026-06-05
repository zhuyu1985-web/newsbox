#!/usr/bin/env bash
# Newsbox 增量 schema SQL 导出
#
# 基于 MANIFEST.md 最后一条 full 记录的日期作为基线，只导出一份文件：
#   incremental-schema.sql  — supabase/migrations/ 里新增的迁移拼接
#
# 用法：
#   ./scripts/db-export-incremental.sh                  # 自动版本号
#   ./scripts/db-export-incremental.sh 2026-05-20 v1    # 手动指定
#
# 产出：
#   backups/<DATE>-<VERSION>-incremental/incremental-schema.sql
#   backups/<DATE>-<VERSION>-incremental/README.md
#   backups/MANIFEST.md （追加一行）

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MANIFEST="backups/MANIFEST.md"
if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ 找不到 ${MANIFEST}，先跑一次全量导出（./scripts/db-export-full.sh）" >&2
  exit 1
fi

# ---- 1. 计算 DATE / VERSION ----
DATE="${1:-$(date +%Y-%m-%d)}"
VERSION="${2:-}"
if [[ -z "$VERSION" ]]; then
  N=1
  while [[ -e "backups/${DATE}-v${N}-incremental" ]]; do
    N=$((N + 1))
  done
  VERSION="v${N}"
fi
OUT_DIR="backups/${DATE}-${VERSION}-incremental"
mkdir -p "$OUT_DIR"

# ---- 2. 找上次基线（MANIFEST 里最后一条 full 记录） ----
BASE_LINE="$(grep -E '^\| [0-9]{4}-[0-9]{2}-[0-9]{2} \|' "$MANIFEST" | grep ' full ' | tail -1)"
if [[ -z "$BASE_LINE" ]]; then
  echo "❌ MANIFEST 里没找到 full 类型基线" >&2
  exit 1
fi
BASE_DATE="$(echo "$BASE_LINE" | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2}')"
BASE_VERSION="$(echo "$BASE_LINE" | awk -F'|' '{gsub(/^ +| +$/,"",$3); print $3}')"
echo "👉 基线：${BASE_DATE} ${BASE_VERSION}"

# ---- 3. 找出"基线之后"的 migration 文件 ----
BASE_EPOCH=$(date -j -f "%Y-%m-%d" "$BASE_DATE" +%s 2>/dev/null || date -d "$BASE_DATE" +%s)

INCLUDED=()
while IFS= read -r f; do
  ts=$(git log --diff-filter=A --follow --format=%at -- "$f" 2>/dev/null | tail -1)
  if [[ -z "$ts" ]]; then
    INCLUDED+=("$f")
    continue
  fi
  if (( ts >= BASE_EPOCH )); then
    INCLUDED+=("$f")
  fi
done < <(ls supabase/migrations/*.sql 2>/dev/null | sort)

# ---- 4. 拼接 incremental-schema.sql ----
SCHEMA_SQL="$OUT_DIR/incremental-schema.sql"
if [[ ${#INCLUDED[@]} -eq 0 ]]; then
  echo "ℹ️  自 ${BASE_DATE} 以来没有新增 migration 文件，schema 部分为空占位"
  cat > "$SCHEMA_SQL" <<EOF
-- ============================================================
-- Newsbox 增量 schema SQL（空）
-- Date    : ${DATE}
-- Version : ${VERSION}
-- 基线    : ${BASE_DATE} ${BASE_VERSION}
-- 说明    : 自基线日期以来没有新 migration
-- ============================================================
EOF
else
  echo "👉 检测到 ${#INCLUDED[@]} 个新 migration"
  for f in "${INCLUDED[@]}"; do echo "    - $f"; done
  {
    cat <<EOF
-- ============================================================
-- Newsbox 增量数据库 schema SQL
-- Date     : ${DATE}
-- Version  : ${VERSION}
-- 基线     : ${BASE_DATE} ${BASE_VERSION} (full)
-- 包含     : ${#INCLUDED[@]} 个 migration
--
-- 在已经恢复了基线 full.sql 的目标库上执行：
--   psql "\$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f incremental-schema.sql
--
-- 多次执行安全性：依赖每个 migration 文件自身的 idempotency。
-- 项目惯例使用 IF NOT EXISTS / DO \$\$ ... \$\$，可重复执行。
-- ============================================================

BEGIN;
EOF
    for f in "${INCLUDED[@]}"; do
      echo ""
      echo "-- ============================================================"
      echo "-- migration: $f"
      echo "-- ============================================================"
      cat "$f"
      echo ""
    done
    echo "COMMIT;"
  } > "$SCHEMA_SQL"
fi
echo "👉 ${SCHEMA_SQL} 大小 $(du -h "$SCHEMA_SQL" | cut -f1)"

# ---- 5. README ----
SCHEMA_SIZE=$(du -h "$SCHEMA_SQL" | cut -f1)
MIGRATIONS_MD=$(for f in "${INCLUDED[@]}"; do echo "- \`$f\`"; done)

cat > "$OUT_DIR/README.md" <<EOF
# Newsbox 增量 ${DATE} ${VERSION}

| 字段 | 值 |
|------|----|
| 基线全量 | ${BASE_DATE} ${BASE_VERSION} |
| schema 文件 | \`incremental-schema.sql\`（${SCHEMA_SIZE}，${#INCLUDED[@]} migrations） |
| 数据导出 | 未导出 |

## 包含的 migration（schema）

${MIGRATIONS_MD:-_无_}

## 恢复

\`\`\`bash
# 目标库已经恢复了 ${BASE_DATE} ${BASE_VERSION} 的 full.sql 之后
psql "\$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f incremental-schema.sql
\`\`\`
EOF

# ---- 6. 追加 MANIFEST ----
NOTE="基于 ${BASE_DATE} ${BASE_VERSION}；schema ${#INCLUDED[@]} migrations；未导出数据"
echo "| ${DATE} | ${VERSION} | incremental | ${OUT_DIR}/incremental-schema.sql | ${SCHEMA_SIZE} | — | ${NOTE} |" >> "$MANIFEST"

echo ""
echo "✅ 完成"
echo "   ${SCHEMA_SQL}"
echo "   ${OUT_DIR}/README.md"
echo "   ${MANIFEST} （已追加登记）"
