# Change: Enhance My Collections module

## Why
- Users need a single "我的收藏"体验来浏览、筛选并批量管理已抓取、手动输入与上传的所有内容，但当前规范仅描述基础列表，无法满足自定义分类、智能分组、导出复制以及多种新建方式的要求。
- Web 端需支持微信公众号等来源常见的防盗链图片、滚动加载和批量操作，否则难以在海量收藏时保持可用性。

## What Changes
- Define category navigation for 未分类/所有/星标/今日/智能列表/收藏夹，并明确默认归属与筛选规则。
- Specify smart list behaviour based on标签聚类与自动推荐，同时允许将未分类笔记移动到自定义收藏夹。
- Require infinite scroll / 滑动分页加载以承载大规模笔记列表。
- Add comprehensive note-level and bulk operations: 打开原文、复制链接、复制内容（纯文本/Markdown/HTML）、导出 txt/Markdown/HTML、星标、收藏夹移动、标签管理、归档、删除。
- Extend capture capability so "我的收藏"入口可添加网址、速记文本、以及上传图片/视频/文件，其中媒体需保存到 Supabase Storage 并与笔记关联。

## Impact
- Affected specs: `library`, `capture`
- Affected code: dashboard/library UI, notes API + services (listing, actions, exports), capture endpoints for manual/上传内容, storage layer for文件上传, batch action UX.
