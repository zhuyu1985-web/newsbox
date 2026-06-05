import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const normalizer = path.join(repoRoot, "scripts/lib/normalize-database-url.py");

function normalizeDatabaseUrl(url: string) {
  return execFileSync("python3", [normalizer, url], {
    encoding: "utf8",
  }).trim();
}

describe("normalize database URL", () => {
  it("rejects an ambiguous URL with multiple unescaped @ characters", () => {
    const input =
      "postgresql://postgres:pass@with-at@db.example.test:6543/postgres?sslmode=require";

    const result = spawnSync("python3", [normalizer, input], {
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("DATABASE_URL contains multiple unescaped @ characters");
  });

  it("does not double-encode an already escaped password", () => {
    const input =
      "postgresql://postgres:pass%40with-at@db.example.test:6543/postgres";

    expect(normalizeDatabaseUrl(input)).toBe(input);
  });
});
