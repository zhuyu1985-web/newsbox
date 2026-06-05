import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const script = path.join(repoRoot, "scripts/db-export-incremental.sh");

describe("db-export-incremental.sh", () => {
  it("exports only schema migrations without database data access", () => {
    const content = readFileSync(script, "utf8");

    expect(content).not.toContain("incremental-data.sql");
    expect(content).not.toContain("导出数据增量");
    expect(content).not.toContain("PSQL=");
    expect(content).not.toContain("DATABASE_URL");
    expect(content).not.toContain("pg_tables");
  });
});
