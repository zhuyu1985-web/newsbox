import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rebuildTopicsForUser } from "../../knowledge/topics/rebuild/route";

function buildSeedNotes(now = new Date()) {
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const cover = {
    ai: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200",
    chip: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200",
    battery: "https://images.unsplash.com/photo-1617886322168-72b886573c9b?w=1200",
    finance: "https://images.unsplash.com/photo-1559526324-593bc073d938?w=1200",
    security: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200",
    climate: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200",
  };

  const blocks: Array<{
    key: keyof typeof cover;
    site: string;
    author: string;
    items: Array<{ days: number; title: string; excerpt: string; body: string }>;
  }> = [
    {
      key: "chip",
      site: "TechDaily",
      author: "Industry Desk",
      items: [
        {
          days: 1,
          title: "全球半导体供应链转移：美国补贴与产能再平衡",
          excerpt: "围绕 CHIPS 补贴、代工产能与先进封装，供应链正从效率导向转向安全导向。",
          body: "要点：CHIPS 补贴推动本土产能；先进封装成为瓶颈；EDA/光刻设备限制影响节奏；企业采用双供应链策略。关键词：半导体、代工、先进封装、CHIPS、供应链安全。",
        },
        {
          days: 3,
          title: "TSMC 在亚利桑那扩产：2nm/3nm 量产窗口讨论",
          excerpt: "新厂产能爬坡与人才、设备、良率息息相关。",
          body: "分析：设备到位与良率提升需要时间；先进制程对 EUV 与材料供应要求更高；客户交付窗口影响下游产品节奏。关键词：TSMC、EUV、良率、2nm、3nm。",
        },
        {
          days: 6,
          title: "先进封装与 Chiplet：从成本到生态的关键转折",
          excerpt: "Chiplet 与先进封装让系统设计更灵活，但生态协同更复杂。",
          body: "要点：标准化互连、封装良率、热设计、测试成本；生态的 IP/EDA/封装厂协作成为竞争壁垒。关键词：Chiplet、先进封装、互连标准、EDA。",
        },
        {
          days: 9,
          title: "存储市场回暖：HBM 与 AI 训练需求推升价格",
          excerpt: "AI 训练带来 HBM 供需紧张，存储厂策略转向高端。",
          body: "分析：HBM 产能稀缺；先进封装与测试产能制约；AI 加速卡出货决定存储周期。关键词：HBM、AI 训练、存储周期。",
        },
        {
          days: 12,
          title: "半导体出口管制升级：设备与材料的合规挑战",
          excerpt: "管制规则变化导致供应链重新评估合规成本。",
          body: "要点：设备许可周期拉长；材料替代与认证；企业加强合规审计与供应链可视化。关键词：出口管制、合规、设备、材料。",
        },
      ],
    },
    {
      key: "battery",
      site: "EnergyWatch",
      author: "EV Research",
      items: [
        {
          days: 0,
          title: "电动车电池供应链：锂价波动与材料回收的拐点",
          excerpt: "锂价回落缓解成本压力，但回收与合规正在成为第二条主线。",
          body: "要点：锂价波动影响电池成本；LFP/LMFP 路线分化；回收体系与法规推动闭环；上游资源锁定仍关键。关键词：电池、锂价、回收、LFP、供应链。",
        },
        {
          days: 4,
          title: "北美电池产能加速：本土化政策与合资工厂",
          excerpt: "本土化要求推动合资建厂，但设备与人才短缺是瓶颈。",
          body: "分析：本土化比例要求；合资模式降低风险；产线爬坡与良率；材料运输与认证。关键词：本土化、电池工厂、合资、良率。",
        },
        {
          days: 7,
          title: "固态电池进展：量产时间表与成本曲线",
          excerpt: "固态路线在能量密度与安全上有优势，但量产仍受限。",
          body: "要点：电解质材料；界面问题；生产工艺与良率；成本下降路径。关键词：固态电池、电解质、量产、成本。",
        },
        {
          days: 10,
          title: "磷酸铁锂持续扩张：快充与低温性能优化",
          excerpt: "LFP 通过材料与结构创新在快充与低温性能上追赶。",
          body: "分析：材料掺杂；结构设计；快充热管理；供应链成本优势。关键词：LFP、快充、热管理、材料创新。",
        },
      ],
    },
    {
      key: "finance",
      site: "FinanceFlow",
      author: "Macro Desk",
      items: [
        {
          days: 2,
          title: "美联储降息预期升温：通胀回落与就业韧性",
          excerpt: "市场对降息路径重新定价，收益率曲线变化加剧波动。",
          body: "要点：通胀数据、就业、金融条件；资产定价对降息节奏敏感；风险资产情绪回暖但分化明显。关键词：降息、通胀、收益率、就业。",
        },
        {
          days: 5,
          title: "市场波动与风险偏好：从流动性到盈利预期",
          excerpt: "风险偏好在宏观与盈利之间摇摆。",
          body: "分析：流动性边际变化；企业盈利预期；板块轮动；避险资产与风险资产联动。关键词：风险偏好、流动性、盈利预期、波动。",
        },
        {
          days: 8,
          title: "银行业压力测试结果：资本充足率与信贷收缩",
          excerpt: "资本要求抬升或导致信贷供给收紧。",
          body: "要点：资本充足率；不良贷款；信贷投放；监管政策。关键词：银行、压力测试、资本、信贷。",
        },
      ],
    },
    {
      key: "security",
      site: "SecurityBrief",
      author: "Incident Response",
      items: [
        {
          days: 1,
          title: "银行业网络安全事件：勒索攻击与供应链漏洞",
          excerpt: "攻击从供应链切入，暴露权限管理与备份策略缺陷。",
          body: "要点：勒索攻击链路；供应链漏洞；零信任与权限最小化；离线备份与演练。关键词：网络安全、勒索、供应链、零信任、备份。",
        },
        {
          days: 6,
          title: "身份与访问管理（IAM）升级：从 MFA 到行为风控",
          excerpt: "仅靠 MFA 不够，行为检测成为关键。",
          body: "分析：异常登录检测；设备指纹；最小权限；审计与告警闭环。关键词：IAM、MFA、行为风控、审计。",
        },
        {
          days: 11,
          title: "安全运营（SOC）自动化：告警降噪与编排响应",
          excerpt: "SOAR 帮助降低噪声并提升响应速度。",
          body: "要点：告警关联；编排响应；指标体系；演练与复盘。关键词：SOC、SOAR、告警降噪、响应。",
        },
      ],
    },
    {
      key: "climate",
      site: "ClimateNow",
      author: "Policy Desk",
      items: [
        {
          days: 2,
          title: "COP29 讨论焦点：减排目标与气候融资缺口",
          excerpt: "各方在减排节奏与融资机制上分歧明显。",
          body: "要点：减排目标；碳市场；气候融资；产业转型成本。关键词：COP29、减排、气候融资、碳市场。",
        },
        {
          days: 7,
          title: "可再生能源装机增长：电网消纳与储能瓶颈",
          excerpt: "风光装机增长快，但电网与储能成为瓶颈。",
          body: "分析：电网建设周期；储能成本下降；市场化机制；弃风弃光风险。关键词：可再生能源、电网、储能、消纳。",
        },
        {
          days: 13,
          title: "碳关税与供应链合规：出口企业的成本测算",
          excerpt: "碳足迹核算与数据透明度要求提升。",
          body: "要点：碳足迹核算；数据审计；供应链协同；成本转嫁。关键词：碳关税、碳足迹、合规、审计。",
        },
      ],
    },
    {
      key: "ai",
      site: "AI Frontier",
      author: "Research Lab",
      items: [
        {
          days: 0,
          title: "大模型安全与评测：从对齐到基准测试的演进",
          excerpt: "模型能力提升的同时，安全评测与对齐方法也在迭代。",
          body: "要点：对齐方法；红队测试；安全基准；推理效率与成本。关键词：大模型、安全评测、对齐、基准测试。",
        },
        {
          days: 4,
          title: "多模态模型进展：视觉-语言推理与数据质量",
          excerpt: "多模态能力依赖高质量数据与更强推理结构。",
          body: "分析：视觉-语言对齐；数据清洗；推理链；评测指标。关键词：多模态、视觉语言、数据质量、推理。",
        },
        {
          days: 9,
          title: "推理成本优化：KV cache、量化与路由策略",
          excerpt: "推理成本成为落地关键，系统优化空间巨大。",
          body: "要点：KV cache；量化；路由；批处理与吞吐；工程权衡。关键词：推理成本、量化、KV cache、路由。",
        },
      ],
    },
  ];

  const notes: Array<{
    source_url: string;
    title: string;
    excerpt: string;
    content_text: string;
    published_at: string;
    site_name: string;
    author: string;
    cover_image_url: string;
  }> = [];

  let i = 0;
  for (const b of blocks) {
    for (const it of b.items) {
      i += 1;
      const published = iso(daysAgo(it.days));
      notes.push({
        source_url: `https://demo.local/smart-topics/${b.key}/${now.getFullYear()}-${String(i).padStart(3, "0")}`,
        title: it.title,
        excerpt: it.excerpt,
        content_text: `${it.body}\n\n（seed）发布日期：${published}`,
        published_at: published,
        site_name: b.site,
        author: b.author,
        cover_image_url: cover[b.key],
      });
    }
  }

  return notes;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const shouldRebuild = url.searchParams.get("rebuild") === "1";

  const notes = buildSeedNotes(new Date());
  const rows = notes.map((n) => ({
    user_id: user.id,
    source_url: n.source_url,
    content_type: "article",
    title: n.title,
    author: n.author,
    site_name: n.site_name,
    published_at: n.published_at,
    content_text: n.content_text,
    excerpt: n.excerpt,
    cover_image_url: n.cover_image_url,
    status: "unread",
  }));

  const up = await supabase.from("notes").upsert(rows, { onConflict: "user_id,source_url" });
  if (up.error) {
    return NextResponse.json({ error: "Failed to seed notes", details: up.error }, { status: 500 });
  }

  let rebuild: unknown = null;
  if (shouldRebuild) {
    rebuild = await rebuildTopicsForUser({
      supabase,
      userId: user.id,
      body: { algorithm: "dbscan" },
      markIngestedSinceIso: null,
    });
  }

  return NextResponse.json({
    ok: true,
    seededNotes: rows.length,
    rebuild: shouldRebuild ? rebuild : null,
  });
}
