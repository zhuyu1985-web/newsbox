import type { EntityType, GraphData, GraphLink, GraphNode } from "./types";

export type DemoNote = {
  id?: string | null;
  title: string;
  excerpt?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

export type DemoMention = {
  mention_count: number;
  created_at: string;
  notes: DemoNote;
};

export type DemoRelationshipRow = {
  id: string;
  relation: string;
  source_entity_id: string;
  target_entity_id: string;
  source: { id: string; name: string; type: EntityType };
  target: { id: string; name: string; type: EntityType };
  created_at: string;
};

export type DemoEvidenceRow = {
  id: string;
  relation: string;
  evidence_snippet: string;
  confidence_score?: number | null;
  source_note_id?: string | null;
  notes?: DemoNote | null;
  created_at: string;
};

export type DemoEntity = {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  aliases: string[];
};

export type DemoProfileData = {
  entityById: Record<string, DemoEntity>;
  mentionsByEntityId: Record<string, DemoMention[]>;
  relationshipsByEntityId: Record<string, DemoRelationshipRow[]>;
  evidenceByLinkId: Record<string, DemoEvidenceRow[]>;
};

export type MockKnowledgeGraphBundle = {
  fullGraph: GraphData;
  profile: DemoProfileData;
  seedEntityId: string;
};

const TYPE_COLORS: Record<EntityType, string> = {
  PERSON: "#3b82f6",
  ORG: "#f97316",
  GPE: "#22c55e",
  EVENT: "#eab308",
  TECH: "#a855f7",
  WORK_OF_ART: "#ec4899",
  DEFAULT: "#94a3b8",
};

function isoDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function n(id: string, name: string, type: EntityType, val: number): GraphNode {
  return {
    id,
    name,
    type,
    val,
    color: TYPE_COLORS[type] || TYPE_COLORS.DEFAULT,
  };
}

function l(id: string, source: string, target: string, label: string, ev?: string): GraphLink {
  return {
    id,
    source,
    target,
    label,
    rawRelation: label,
    evidenceSnippet: ev || null,
    sourceNoteId: null,
  };
}

export function buildMockKnowledgeGraph(): MockKnowledgeGraphBundle {
  // 主题：科技巨头与未来探索（Elon Musk & Tesla Ecosystem）
  const nodes: GraphNode[] = [
    // People
    n("e_p_musk", "Elon Musk", "PERSON", 28),
    n("e_p_biden", "Joe Biden", "PERSON", 22),
    n("e_p_cook", "Tim Cook", "PERSON", 20),
    n("e_p_altman", "Sam Altman", "PERSON", 18),

    // Organizations
    n("e_o_tesla", "Tesla Inc.", "ORG", 26),
    n("e_o_spacex", "SpaceX", "ORG", 24),
    n("e_o_x", "X Corp", "ORG", 20),
    n("e_o_apple", "Apple", "ORG", 22),
    n("e_o_openai", "OpenAI", "ORG", 18),

    // Locations
    n("e_l_austin", "Austin", "GPE", 18),
    n("e_l_sf", "San Francisco", "GPE", 18),
    n("e_l_dc", "Washington D.C.", "GPE", 16),
    n("e_l_boca", "Boca Chica", "GPE", 14),

    // Events
    n("e_e_aiday", "Tesla AI Day", "EVENT", 20),
    n("e_e_cyber", "Cybertruck Delivery", "EVENT", 22),
    n("e_e_twitter", "Twitter Acquisition", "EVENT", 24),
    n("e_e_launch", "Starship Launch", "EVENT", 22),

    // Works / Tech
    n("e_w_master3", "Master Plan Part 3", "WORK_OF_ART", 16),
    n("e_t_fsd", "FSD Beta", "TECH", 18),
    n("e_t_optimus", "Optimus", "TECH", 16),
    n("e_t_starlink", "Starlink", "TECH", 18),
  ];

  const links: GraphLink[] = [
    // Musk Relationships
    l("r_1", "e_p_musk", "e_o_tesla", "CEO", "Elon Musk 担任 Tesla CEO，主导了电动车与能源业务的扩张。"),
    l("r_2", "e_p_musk", "e_o_spacex", "Founder", "Elon Musk 创立 SpaceX，致力于降低太空运输成本并实现火星殖民。"),
    l("r_3", "e_p_musk", "e_o_x", "Owner", "Elon Musk 收购 Twitter 并将其重组为 X Corp，意图打造超级应用。"),
    l("r_4", "e_p_musk", "e_o_openai", "Co-Founder", "Elon Musk 曾是 OpenAI 的联合创始人，后因理念分歧退出董事会。"),
    
    // Interactions
    l("r_5", "e_p_musk", "e_p_biden", "Criticized", "Elon Musk 多次公开批评拜登政府的电动车政策，认为其偏袒传统车企。"),
    l("r_6", "e_p_musk", "e_p_cook", "Met With", "Elon Musk 在 Apple 总部与 Tim Cook 会面，解决了关于 App Store 费用的争议。"),
    l("r_7", "e_p_altman", "e_o_openai", "CEO", "Sam Altman 担任 OpenAI CEO，主导了 ChatGPT 的发布与商业化。"),

    // Tesla Ecosystem
    l("r_8", "e_o_tesla", "e_l_austin", "HQ Located In", "Tesla 将全球总部搬迁至得克萨斯州奥斯汀超级工厂。"),
    l("r_9", "e_o_tesla", "e_e_aiday", "Hosted", "Tesla 举办 AI Day，展示了 FSD 自动驾驶技术的最新进展与 Optimus 机器人。"),
    l("r_10", "e_o_tesla", "e_e_cyber", "Organized", "Tesla 在奥斯汀工厂举行 Cybertruck 交付仪式，标志着皮卡车型正式上市。"),
    l("r_11", "e_o_tesla", "e_w_master3", "Published", "Tesla 发布宏图计划第三篇章，描绘了全球可持续能源经济的路径。"),
    l("r_12", "e_o_tesla", "e_t_fsd", "Developed", "FSD Beta 是 Tesla 自研的全自动驾驶软件，已向北美用户广泛推送。"),
    
    // SpaceX Ecosystem
    l("r_13", "e_o_spacex", "e_l_boca", "Launch Site", "SpaceX 在博卡奇卡建立了星舰基地 (Starbase)，进行下一代火箭测试。"),
    l("r_14", "e_o_spacex", "e_e_launch", "Conducted", "SpaceX 进行了多次 Starship 轨道试飞，旨在验证重型运载能力。"),
    l("r_15", "e_o_spacex", "e_t_starlink", "Operates", "SpaceX 运营 Starlink 卫星星座，为全球提供低延迟卫星互联网服务。"),

    // X / Twitter
    l("r_16", "e_o_x", "e_l_sf", "HQ Located In", "X Corp (原 Twitter) 的总部仍位于旧金山，尽管面临租金与人员缩减争议。"),
    l("r_17", "e_e_twitter", "e_o_x", "Transformed Into", "Twitter 收购案尘埃落定后，公司实体并入 X Corp。"),
    l("r_18", "e_e_twitter", "e_p_musk", "Led By", "Elon Musk 以 440 亿美元完成了对 Twitter 的私有化收购。"),

    // Apple
    l("r_19", "e_o_apple", "e_l_sf", "Nearby", "Apple 总部位于旧金山湾区的库比蒂诺，与 X Corp 总部相距不远。"),
    l("r_20", "e_o_apple", "e_o_x", "Advertises On", "Tim Cook 确认 Apple 将继续在 X 平台上投放广告。"),

    // Government / Policy
    l("r_21", "e_p_biden", "e_l_dc", "Works In", "白宫位于华盛顿特区，是拜登政府制定能源与科技政策的核心。"),
    l("r_22", "e_l_dc", "e_o_tesla", "Regulates", "NHTSA 等监管机构在华盛顿对 Tesla 的 Autopilot 安全性展开调查。"),

    // Cross Links
    l("r_23", "e_t_starlink", "e_e_launch", "Deployed By", "Starlink 卫星主要通过 Falcon 9 和未来的 Starship 火箭进行部署。"),
    l("r_24", "e_t_optimus", "e_e_aiday", "Unveiled At", "Optimus 人形机器人原型机在 AI Day 上首次公开亮相。"),
    l("r_25", "e_w_master3", "e_t_fsd", "Mentions", "宏图计划提到自动驾驶出租车 (Robotaxi) 将大幅提升交通效率。"),
  ];

  const entityById: Record<string, DemoEntity> = Object.fromEntries(
    nodes.map((x) => [
      x.id,
      {
        id: x.id,
        name: x.name,
        type: x.type,
        aliases: [],
        description:
          x.type === "PERSON"
            ? `${x.name} 是科技与商业领域的关键人物，近期频频出现在新闻头条。`
            : x.type === "ORG"
              ? `${x.name} 是一家具有全球影响力的机构，在行业中占据主导地位。`
              : x.type === "TECH"
                ? `${x.name} 代表了前沿技术突破，引发了广泛的讨论与关注。`
                : x.type === "EVENT"
                  ? `${x.name} 是近期发生的重大事件，对相关股价与舆论产生了深远影响。`
                  : x.type === "GPE"
                    ? `${x.name} 是重要的地理位置，汇聚了众多科技企业与政策中心。`
                    : `该实体在相关新闻报道中被多次提及，是理解事件全貌的关键节点。`,
      },
    ])
  );

  // Aliases
  if (entityById["e_p_musk"]) entityById["e_p_musk"].aliases = ["Elon", "Iron Man"];
  if (entityById["e_o_tesla"]) entityById["e_o_tesla"].aliases = ["TSLA"];
  if (entityById["e_o_spacex"]) entityById["e_o_spacex"].aliases = ["Space Exploration Technologies Corp."];

  const demoNotes: DemoNote[] = [
    {
      id: null,
      title: "WSJ: Elon Musk's Vision for X and Beyond",
      excerpt: "Discussing the transformation of Twitter into X and the ambition to create an everything app.",
      created_at: isoDaysAgo(2),
    },
    {
      id: null,
      title: "TechCrunch: Tesla AI Day 2024 Recap",
      excerpt: "Highlights from the event include updates on FSD v12 and the new capabilities of the Optimus bot.",
      created_at: isoDaysAgo(5),
    },
    {
      id: null,
      title: "Bloomberg: SpaceX Starship Reaches Orbit",
      excerpt: "A historic milestone for SpaceX as Starship successfully completes its orbital test flight from Boca Chica.",
      created_at: isoDaysAgo(10),
    },
    {
      id: null,
      title: "Reuters: Biden Administration EV Policy Update",
      excerpt: "New tax credits announced for electric vehicles, sparking reactions from industry leaders including Musk.",
      created_at: isoDaysAgo(14),
    },
  ];

  // Helper to distribute mentions
  const mentionsByEntityId: Record<string, DemoMention[]> = {};
  nodes.forEach(n => {
    mentionsByEntityId[n.id] = [
      { mention_count: Math.floor(Math.random() * 5) + 1, created_at: isoDaysAgo(Math.floor(Math.random() * 7)), notes: demoNotes[Math.floor(Math.random() * demoNotes.length)] },
      { mention_count: Math.floor(Math.random() * 3) + 1, created_at: isoDaysAgo(Math.floor(Math.random() * 14) + 7), notes: demoNotes[Math.floor(Math.random() * demoNotes.length)] }
    ];
  });

  const relationshipsByEntityId: Record<string, DemoRelationshipRow[]> = {};
  for (const rel of links) {
    const s = rel.source as string;
    const t = rel.target as string;
    const row: DemoRelationshipRow = {
      id: rel.id,
      relation: rel.rawRelation || rel.label,
      source_entity_id: s,
      target_entity_id: t,
      source: { id: s, name: entityById[s]?.name || "", type: entityById[s]?.type || "DEFAULT" },
      target: { id: t, name: entityById[t]?.name || "", type: entityById[t]?.type || "DEFAULT" },
      created_at: isoDaysAgo(Math.max(1, Math.floor(Math.random() * 10))),
    };

    relationshipsByEntityId[s] = relationshipsByEntityId[s] || [];
    relationshipsByEntityId[t] = relationshipsByEntityId[t] || [];
    relationshipsByEntityId[s].push(row);
    relationshipsByEntityId[t].push(row);
  }

  const evidenceByLinkId: Record<string, DemoEvidenceRow[]> = {};
  for (const rel of links) {
    const ev = rel.evidenceSnippet || "Relationship extracted from news analysis.";
    evidenceByLinkId[rel.id] = [
      {
        id: `${rel.id}_ev_1`,
        relation: rel.rawRelation || rel.label,
        evidence_snippet: ev,
        confidence_score: 0.85,
        source_note_id: null,
        notes: demoNotes[Math.floor(Math.random() * demoNotes.length)],
        created_at: isoDaysAgo(Math.max(1, Math.floor(Math.random() * 5))),
      },
    ];
  }

  return {
    fullGraph: { nodes, links },
    profile: {
      entityById,
      mentionsByEntityId,
      relationshipsByEntityId,
      evidenceByLinkId,
    },
    seedEntityId: "e_p_musk",
  };
}
