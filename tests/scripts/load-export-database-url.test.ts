import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const loader = path.join(repoRoot, "scripts/lib/load-export-database-url.py");

function loadUrl(root: string, env: NodeJS.ProcessEnv = {}) {
  return execFileSync("python3", [loader, root], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  }).trim();
}

function tempRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "newsbox-db-url-"));
  mkdirSync(path.join(root, "scripts/migrate-supabase"), { recursive: true });
  return root;
}

describe("load export database URL", () => {
  it("prefers DB_EXPORT_DATABASE_URL over the app DATABASE_URL", () => {
    const root = tempRepo();
    writeFileSync(
      path.join(root, ".env.local"),
      [
        "DATABASE_URL=postgresql://postgres:target@dbconn.sealosbja.site:31440/postgres",
        "DB_EXPORT_DATABASE_URL=postgresql://postgres.source:source@aws.pooler.supabase.com:6543/postgres",
      ].join("\n"),
    );

    expect(loadUrl(root)).toBe(
      "DB_EXPORT_DATABASE_URL from .env.local\tpostgresql://postgres.source:source@aws.pooler.supabase.com:6543/postgres",
    );
  });

  it("uses migrate-supabase CLOUD_DB_URL before the app DATABASE_URL", () => {
    const root = tempRepo();
    writeFileSync(
      path.join(root, ".env.local"),
      "DATABASE_URL=postgresql://postgres:target@dbconn.sealosbja.site:31440/postgres\n",
    );
    writeFileSync(
      path.join(root, "scripts/migrate-supabase/.env"),
      "CLOUD_DB_URL=postgresql://postgres.source:source@aws.pooler.supabase.com:6543/postgres\n",
    );

    expect(loadUrl(root)).toBe(
      "CLOUD_DB_URL from scripts/migrate-supabase/.env\tpostgresql://postgres.source:source@aws.pooler.supabase.com:6543/postgres",
    );
  });
});
