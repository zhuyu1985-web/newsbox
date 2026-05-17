import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "out/**",
      "coverage/**",
      "extension/**",
      "supabase/**",
      "scripts/**",
      "lib/supabase/database.types.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // UI 规范守卫 —— 参见 docs/UI_GUIDELINES.md
    // warn 级别：不阻断构建，但在编辑器与 npm run lint 输出中暴露
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/bg-\\[#[0-9a-fA-F]/]",
          message:
            "禁止 className 内硬编码 hex 颜色（如 bg-[#xxx]）。使用语义 token（bg-primary / bg-card / bg-muted）或 Tailwind 调色板（bg-blue-500）。详见 docs/UI_GUIDELINES.md §1.1。",
        },
        {
          selector: "TemplateElement[value.raw=/bg-\\[#[0-9a-fA-F]/]",
          message:
            "禁止模板字符串内的 hex 颜色（bg-[#xxx]）。详见 docs/UI_GUIDELINES.md §1.1。",
        },
        {
          selector: "Literal[value=/text-\\[#[0-9a-fA-F]/]",
          message:
            "禁止 className 内硬编码 hex 颜色（如 text-[#xxx]）。使用 text-foreground / text-muted-foreground / text-primary 或 Tailwind 调色板。详见 docs/UI_GUIDELINES.md §1.1。",
        },
        {
          selector: "TemplateElement[value.raw=/text-\\[#[0-9a-fA-F]/]",
          message:
            "禁止模板字符串内的 hex 颜色（text-[#xxx]）。详见 docs/UI_GUIDELINES.md §1.1。",
        },
        {
          selector: "Literal[value=/rounded-\\[\\d+px\\]/]",
          message:
            "禁止 className 内 rounded-[Npx] 自定义像素圆角。使用 rounded-md / lg / xl / 2xl / 3xl / full。详见 docs/UI_GUIDELINES.md §1.5。",
        },
        {
          selector: "TemplateElement[value.raw=/rounded-\\[\\d+px\\]/]",
          message:
            "禁止模板字符串内的 rounded-[Npx]。详见 docs/UI_GUIDELINES.md §1.5。",
        },
      ],
    },
  },
];

export default eslintConfig;
