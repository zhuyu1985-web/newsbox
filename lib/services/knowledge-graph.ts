import { createClient } from "@/lib/supabase/server";

export type EntityType = "PERSON" | "ORG" | "GPE" | "EVENT" | "TECH" | "WORK_OF_ART";

export type ExtractedEntity = {
  name: string;
  type: EntityType;
  description: string;
  aliases: string[];
};

export type ExtractedRelationship = {
  source_name: string;
  target_name: string;
  relation: string;
  evidence: string;
};

export type ExtractionResult = {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
};

export type GraphProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/**
 * 使用 LLM 从文本中提取实体和关系
 */
export async function extractGraphFromText(
  cfg: GraphProviderConfig,
  text: string
): Promise<ExtractionResult> {
  const baseUrl = cfg.baseUrl.replace(/\/+$/, "");

  const system = `你是一个专业的知识图谱构建专家。请从给定的文本中提取核心实体及其相互关系。

提取规则：
1. 实体类型限定为：PERSON (人物), ORG (组织), GPE (地理位置), EVENT (事件), TECH (技术/产品), WORK_OF_ART (作品)。
2. 关系应简洁明了，如 "founded", "employed by", "competitor of", "invested in", "located in"。
3. 必须提供证据片段（原文中的一小段话）。
4. 尽可能合并同义词，选择最常用的名称作为主体。

输出格式为 JSON，包含以下字段：
- entities: 数组，包含 { name, type, description, aliases }
- relationships: 数组，包含 { source_name, target_name, relation, evidence }`;

  const user = `请提取以下文本中的知识图谱信息：\n\n${text.slice(0, 10000)}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => null);
    throw new Error(`Graph Extraction API failed (${resp.status}): ${JSON.stringify(err)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Graph Extraction API returned empty content");
  }

  try {
    return JSON.parse(content) as ExtractionResult;
  } catch (e) {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Failed to parse graph extraction JSON");
    return JSON.parse(m[0]) as ExtractionResult;
  }
}

/**
 * 处理提取结果并存入数据库
 */
export async function processAndStoreGraph(
  supabase: any,
  userId: string,
  noteId: string,
  result: ExtractionResult
) {
  // 1. 处理实体
  const entityIdMap = new Map<string, string>();

  for (const ent of result.entities) {
    // 检查是否存在（简单的同名匹配或别名匹配）
    const { data: existing } = await supabase
      .from("knowledge_entities")
      .select("id, name, aliases")
      .eq("user_id", userId)
      .or(`name.eq."${ent.name}",aliases.cs.{"${ent.name}"}`)
      .limit(1)
      .single();

    let entityId: string;

    if (existing) {
      entityId = existing.id;
      // 增量更新别名
      const newAliases = Array.from(new Set([...(existing.aliases || []), ...ent.aliases, ent.name]));
      await supabase
        .from("knowledge_entities")
        .update({ aliases: newAliases, updated_at: new Date().toISOString() })
        .eq("id", entityId);
    } else {
      const { data: inserted, error } = await supabase
        .from("knowledge_entities")
        .insert({
          user_id: userId,
          name: ent.name,
          type: ent.type,
          description: ent.description,
          aliases: ent.aliases,
        })
        .select("id")
        .single();
      
      if (error || !inserted) {
        console.error("Failed to insert entity", ent.name, error);
        continue;
      }
      entityId = inserted.id;
    }

    entityIdMap.set(ent.name.toLowerCase(), entityId);
    // 同时把别名也映射过去，方便后续关系查询
    for (const alias of ent.aliases) {
      entityIdMap.set(alias.toLowerCase(), entityId);
    }
  }

  // 2. 存入 note_entities 关联
  const noteEntities = Array.from(new Set(entityIdMap.values())).map(id => ({
    user_id: userId,
    note_id: noteId,
    entity_id: id,
  }));

  if (noteEntities.length > 0) {
    await supabase.from("knowledge_note_entities").upsert(noteEntities, {
      onConflict: "note_id,entity_id"
    });
  }

  // 3. 处理关系
  const relationships = result.relationships.map(rel => {
    const sourceId = entityIdMap.get(rel.source_name.toLowerCase());
    const targetId = entityIdMap.get(rel.target_name.toLowerCase());

    if (!sourceId || !targetId) return null;

    return {
      user_id: userId,
      source_entity_id: sourceId,
      target_entity_id: targetId,
      relation: rel.relation,
      source_note_id: noteId,
      evidence_snippet: rel.evidence,
    };
  }).filter(Boolean);

  if (relationships.length > 0) {
    await supabase.from("knowledge_relationships").insert(relationships);
  }

  return {
    entityCount: entityIdMap.size,
    relationshipCount: relationships.length
  };
}
