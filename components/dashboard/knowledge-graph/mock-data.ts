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
  // 主题：数字侦探墙（人物-组织-技术-事件-地点-作品）
  const nodes: GraphNode[] = [
    n("e_ren_chenmo", "陈墨", "PERSON", 20),
    n("e_ren_linyan", "林言", "PERSON", 18),
    n("e_ren_zhaoyu", "赵宇", "PERSON", 16),
    n("e_ren_suyan", "苏研", "PERSON", 15),

    n("e_org_yinzhu", "银蛛实验室", "ORG", 22),
    n("e_org_heixing", "黑星资本", "ORG", 18),
    n("e_org_qinghe", "清河市数据局", "ORG", 16),
    n("e_org_xinghe", "星河新闻社", "ORG", 15),

    n("e_tech_muse", "缪斯模型", "TECH", 19),
    n("e_tech_sand", "沙盒网关", "TECH", 17),
    n("e_tech_trace", "追溯引擎", "TECH", 16),
    n("e_tech_jarvis", "贾维斯助手", "TECH", 14),

    n("e_event_leak", "接口泄露事件", "EVENT", 20),
    n("e_event_launch", "追溯引擎发布会", "EVENT", 16),
    n("e_event_meet", "合规闭门会", "EVENT", 14),

    n("e_gpe_qinghe", "清河", "GPE", 16),
    n("e_gpe_huanghai", "黄海新区", "GPE", 14),
    n("e_gpe_shenzhen", "深城", "GPE", 13),

    n("e_work_whitepaper", "《可信证据链白皮书》", "WORK_OF_ART", 16),
    n("e_work_report", "《黑箱追踪报告》", "WORK_OF_ART", 15),
    n("e_work_timeline", "《接口泄露时间线》", "WORK_OF_ART", 14),

    n("e_org_ruihe", "瑞合系统", "ORG", 14),
    n("e_tech_rpa", "审计机器人", "TECH", 13),
    n("e_event_patch", "紧急修复行动", "EVENT", 13),
  ];

  const links: GraphLink[] = [
    l(
      "r_1",
      "e_ren_chenmo",
      "e_org_yinzhu",
      "共同创立",
      "陈墨与林言在访谈中提到，银蛛实验室由两人共同发起，初期专注证据链与数据溯源。"
    ),
    l("r_2", "e_ren_linyan", "e_org_yinzhu", "共同创立", "林言在内部邮件里写道：我们要把溯源变成人人可用的工具。"),
    l("r_3", "e_ren_zhaoyu", "e_org_heixing", "就职于", "赵宇在公开简历中显示其曾任黑星资本研究员，负责技术尽调。"),
    l("r_4", "e_org_heixing", "e_org_yinzhu", "投资", "黑星资本在发布会前完成了对银蛛实验室的战略投资。"),

    l("r_5", "e_org_yinzhu", "e_tech_trace", "推出", "银蛛实验室宣布推出追溯引擎，用于把碎片信息串成证据链。"),
    l("r_6", "e_tech_trace", "e_event_launch", "亮相于", "追溯引擎在发布会现场首次演示‘路径发现’能力。"),
    l("r_7", "e_event_launch", "e_gpe_shenzhen", "发生于", "发布会在深城举行，邀请了多家机构参与。"),

    l("r_8", "e_org_qinghe", "e_event_meet", "组织", "清河市数据局牵头召开合规闭门会，讨论证据链的可验证性。"),
    l("r_9", "e_event_meet", "e_gpe_qinghe", "发生于", "闭门会在清河举行，与会者强调要可追溯、可复核。"),

    l("r_10", "e_tech_muse", "e_org_ruihe", "由…提供", "瑞合系统为缪斯模型提供推理算力与部署支持。"),
    l("r_11", "e_org_ruihe", "e_tech_sand", "维护", "瑞合系统维护沙盒网关，隔离外部访问并记录调用轨迹。"),

    l("r_12", "e_tech_sand", "e_event_leak", "牵涉", "调查显示接口泄露事件与网关规则变更有关，但原因仍在核查。"),
    l("r_13", "e_event_leak", "e_gpe_huanghai", "关联地点", "泄露线索指向黄海新区的一处外包机房。"),
    l("r_14", "e_org_xinghe", "e_work_timeline", "发布", "星河新闻社整理并发布《接口泄露时间线》，记录关键节点与证据。"),

    l("r_15", "e_work_timeline", "e_event_leak", "追踪", "时间线报告将泄露事件拆解为‘触发—扩散—修复’三个阶段。"),
    l("r_16", "e_work_report", "e_org_heixing", "引用", "《黑箱追踪报告》引用了黑星资本的尽调笔记，强调供应链风险。"),
    l("r_17", "e_work_whitepaper", "e_tech_trace", "定义", "白皮书给出‘证据链’定义：可溯源、可复核、可解释。"),

    l("r_18", "e_ren_suyan", "e_work_whitepaper", "撰写", "苏研牵头撰写白皮书，提出‘证据可信度分层’框架。"),
    l("r_19", "e_ren_suyan", "e_org_qinghe", "顾问", "清河市数据局聘请苏研担任合规与审计顾问。"),

    l("r_20", "e_event_patch", "e_org_ruihe", "执行", "紧急修复行动由瑞合系统执行，包含回滚规则、补齐审计日志。"),
    l("r_21", "e_event_patch", "e_tech_rpa", "使用", "修复行动中引入审计机器人，自动比对关键接口的调用轨迹。"),
    l("r_22", "e_tech_rpa", "e_tech_trace", "对接", "审计机器人的输出可直接喂给追溯引擎生成证据路径。"),

    l("r_23", "e_ren_chenmo", "e_tech_muse", "合作", "陈墨在访谈中称：缪斯模型是我们用于实体归一与关系抽取的关键部件。"),
    l("r_24", "e_ren_linyan", "e_tech_jarvis", "提出", "林言在设计评审中提出‘贾维斯助手’，让用户用自然语言追问证据来源。"),
    l("r_25", "e_tech_jarvis", "e_tech_trace", "驱动", "贾维斯助手负责把追问转成路径发现任务，交给追溯引擎执行。"),

    // 一些“弱关联”用于形成更好看的网络结构
    l("r_26", "e_org_yinzhu", "e_org_qinghe", "合作", "银蛛实验室与清河市数据局就证据链试点达成合作意向。"),
    l("r_27", "e_org_yinzhu", "e_org_xinghe", "被报道", "星河新闻社对银蛛实验室做了深度报道，引用多段公开材料。"),
    l("r_28", "e_work_report", "e_event_leak", "调查", "报告提到：泄露并非一次性事故，而是长期缺口被放大。"),
    l("r_29", "e_work_report", "e_event_patch", "建议", "报告建议以‘最小权限+全链路审计’作为修复原则。"),
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
            ? "该人物在多条材料中出现，涉及组织合作、产品发布与事件调查等线索。"
            : x.type === "ORG"
              ? "该组织在网络中扮演关键节点，连接资金、技术与事件链路。"
              : x.type === "TECH"
                ? "该技术用于信息抽取、关系构建或证据链追溯，常与多方实体相关联。"
                : x.type === "EVENT"
                  ? "该事件串联多方实体，包含‘触发—扩散—修复’等阶段。"
                  : x.type === "GPE"
                    ? "该地点在材料中作为事件发生地、关联地点或机构所在地出现。"
                    : "该作品在材料中被引用、发布或用作证据链的结构化载体。",
      },
    ])
  );

  // 给几个核心实体加别名，展示效果更丰富
  entityById["e_ren_chenmo"].aliases = ["墨叔", "陈工"]; // 演示
  entityById["e_org_yinzhu"].aliases = ["银蛛", "银蛛实验室（简称）"]; // 演示
  entityById["e_tech_trace"].aliases = ["证据追溯", "路径发现引擎"]; // 演示

  const demoNotes: DemoNote[] = [
    {
      id: null,
      title: "访谈摘录：把溯源做成人人可用的工具",
      excerpt: "陈墨与林言谈到早期动机：从零散信息里找出可复核的证据链。",
      created_at: isoDaysAgo(1),
    },
    {
      id: null,
      title: "发布会速记：追溯引擎的‘路径发现’演示",
      excerpt: "现场用一条关系链把多个线索串起来，展示证据片段与可信度分层。",
      created_at: isoDaysAgo(3),
    },
    {
      id: null,
      title: "调查备忘：接口泄露事件的关键节点",
      excerpt: "线索指向外包机房与网关规则变更；修复行动包含回滚与补齐审计日志。",
      created_at: isoDaysAgo(5),
    },
    {
      id: null,
      title: "白皮书摘要：可信证据链与可解释性",
      excerpt: "提出：证据必须可溯源、可复核、可解释；并给出可信度分层框架。",
      created_at: isoDaysAgo(9),
    },
  ];

  const mentionsByEntityId: Record<string, DemoMention[]> = {
    e_ren_chenmo: [
      { mention_count: 2, created_at: isoDaysAgo(1), notes: demoNotes[0] },
      { mention_count: 1, created_at: isoDaysAgo(3), notes: demoNotes[1] },
    ],
    e_org_yinzhu: [
      { mention_count: 2, created_at: isoDaysAgo(1), notes: demoNotes[0] },
      { mention_count: 2, created_at: isoDaysAgo(3), notes: demoNotes[1] },
      { mention_count: 1, created_at: isoDaysAgo(5), notes: demoNotes[2] },
    ],
    e_event_leak: [
      { mention_count: 2, created_at: isoDaysAgo(5), notes: demoNotes[2] },
      { mention_count: 1, created_at: isoDaysAgo(9), notes: demoNotes[3] },
    ],
  };

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
    const ev = rel.evidenceSnippet || "该关系来自多条材料的交叉印证。";
    evidenceByLinkId[rel.id] = [
      {
        id: `${rel.id}_ev_1`,
        relation: rel.rawRelation || rel.label,
        evidence_snippet: ev,
        confidence_score: 0.72,
        source_note_id: null,
        notes: demoNotes[Math.floor(Math.random() * demoNotes.length)],
        created_at: isoDaysAgo(Math.max(1, Math.floor(Math.random() * 10))),
      },
      {
        id: `${rel.id}_ev_2`,
        relation: rel.rawRelation || rel.label,
        evidence_snippet: "另一个片段强调：同一条线索在不同材料中出现，且细节相互吻合。",
        confidence_score: 0.61,
        source_note_id: null,
        notes: demoNotes[Math.floor(Math.random() * demoNotes.length)],
        created_at: isoDaysAgo(Math.max(1, Math.floor(Math.random() * 10))),
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
    seedEntityId: "e_ren_chenmo",
  };
}
