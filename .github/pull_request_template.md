<!-- 简短描述本 PR 的目标 -->

## 改动摘要

-

## 关联 issue / openspec 提案

<!-- 例如：openspec/changes/<id> 或 https://github.com/.../issues/N -->

---

## UI 自检 Checklist（仅含 UI 改动的 PR）

参见 [`docs/UI_GUIDELINES.md`](../docs/UI_GUIDELINES.md) §12。

- [ ] 颜色全走 token / Tailwind 语义类（无 `bg-[#XXX]`）
- [ ] 所有手写颜色类配套 `dark:` 前缀
- [ ] 复用 `components/ui/` 原子，没有重复造轮子
- [ ] 圆角用 Tailwind 原生类（`rounded-md/lg/xl/2xl/3xl/full`，避免 `rounded-[14px]` 自定义像素）
- [ ] Loading / Empty / Error 三态都处理了
- [ ] 危险操作走 `<ConfirmDialog variant="destructive">`
- [ ] 操作反馈用 `toast.success/error()`（无 `alert()`）
- [ ] icon-only 按钮有 `aria-label`
- [ ] 表单 `<Input>` 配对 `<Label>` + `disabled={isLoading}`
- [ ] 文案中文 + 中文标点 + 友好语气
- [ ] 移动端在 `lg` 以下能用
- [ ] 外链图加 `referrerPolicy="no-referrer"`
- [ ] 实测 light + dark 两套主题

## 通用 Checklist

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run lint` 通过（或新增 warning 已说明）
- [ ] 涉及 schema 变更已加迁移文件 + `database.types.ts` 重新生成

## 测试方式

<!-- 描述如何手动验证（仅有自动测试时可省略） -->

-
