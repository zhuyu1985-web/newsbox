## 1. Implementation
- [x] 1.1 Add `quote_materials` table + indexes + RLS policies (Supabase migration)
- [x] 1.2 Add API: list/create/delete quote materials (`/api/quote-materials`)
- [x] 1.3 Add API: LLM extract for a note (`/api/quote-materials/extract`) with server-side “must exist in source text” validation + dedup
- [x] 1.4 Add “设为金句素材/取消” action in reading annotation list UI (and wire to API)
- [x] 1.5 Add the same action in dashboard annotations list UI (and wire to API)
- [x] 1.6 Implement Knowledge Base → “金句素材” subview UI: list + copy + open source note + empty/loading/error states

## 2. Validation
- [ ] 2.1 `npm run lint` (当前仓库存在大量既有 lint 错误，未能通过；需单独治理或放宽规则)
- [x] 2.2 `npm run build`
- [ ] 2.3 Manual QA checklist:
  - [ ] Can mark an annotation as quote material from reading sidebar
  - [ ] Can unmark/delete quote material
  - [ ] Quotes view lists materials and can copy/open source
  - [ ] LLM extraction only stores text that appears in the note body (no hallucinated entries)

## 3. Spec Updates
- [x] 3.1 Add delta spec: `annotations` (manual mark-as-quote entry points)
- [x] 3.2 Add new capability delta spec: `quote-materials`
