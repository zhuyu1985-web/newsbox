import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as cheerio from "cheerio";
import { sanitizeHtmlContent } from "@/lib/services/html-sanitizer";

export async function POST(request: NextRequest) {
  try {
    const { noteId, url } = await request.json();

    if (!noteId || !url) {
      return NextResponse.json(
        { error: "noteId and url are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 验证笔记属于当前用户
    const { data: note, error: noteError } = await supabase
      .from("notes")
      .select("id, user_id")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    // 简单的内容抓取（使用 fetch）
    try {
      // 验证 URL 格式
      let targetUrl = url;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        targetUrl = `https://${url}`;
      }

      // 检测视频平台并生成embed URL
      let mediaUrl: string | null = null;
      let detectedContentType: "article" | "video" | "audio" = "article";
      const urlObj = new URL(targetUrl);

      // B站视频处理
      if (urlObj.hostname.includes("bilibili.com")) {
        detectedContentType = "video";
        const bvMatch = targetUrl.match(/BV[\w]+/);
        const avMatch = targetUrl.match(/av(\d+)/);

        if (bvMatch) {
          mediaUrl = `https://player.bilibili.com/player.html?bvid=${bvMatch[0]}&high_quality=1`;
        } else if (avMatch) {
          mediaUrl = `https://player.bilibili.com/player.html?aid=${avMatch[1]}&high_quality=1`;
        }
      }
      // YouTube处理
      else if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
        detectedContentType = "video";
        let videoId: string | null = null;

        if (urlObj.hostname.includes("youtu.be")) {
          videoId = urlObj.pathname.slice(1);
        } else {
          videoId = urlObj.searchParams.get("v");
        }

        if (videoId) {
          mediaUrl = `https://www.youtube.com/embed/${videoId}`;
        }
      }
      // 抖音视频处理
      else if (urlObj.hostname.includes("douyin.com") || urlObj.hostname.includes("iesdouyin.com")) {
        detectedContentType = "video";
        const videoIdMatch = targetUrl.match(/video\/(\d+)/);
        if (videoIdMatch) {
          mediaUrl = targetUrl;
        } else {
          mediaUrl = targetUrl;
        }
      }
      // 快手视频处理
      else if (urlObj.hostname.includes("kuaishou.com") || urlObj.hostname.includes("kuaishouapp.com")) {
        detectedContentType = "video";
        const videoIdMatch = targetUrl.match(/short-video\/(\d+)/) || targetUrl.match(/photo\/(\d+)/);
        if (videoIdMatch) {
          mediaUrl = targetUrl;
        } else {
          mediaUrl = targetUrl;
        }
      }

      // 针对不同平台设置不同的请求头
      const headers: HeadersInit = {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      };

      if (urlObj.hostname.includes("bilibili.com")) {
        headers["Referer"] = "https://www.bilibili.com/";
      }

      let html = "";
      let title: string | null = null;
      let excerpt: string | null = null;
      let coverImageUrl: string | null = null;
      let siteName: string | null = null;
      let contentText = "";
      let contentHtml = "";

      // 尝试抓取HTML内容
      try {
        const response = await fetch(targetUrl, {
          headers,
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          if (mediaUrl) {
            console.log(`HTML fetch failed (${response.status}) but video embed URL exists, continuing...`);
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        } else {
          html = await response.text();
        }
      } catch (fetchError: any) {
        console.error("HTML fetch error:", fetchError);
        if (!mediaUrl) {
          throw fetchError;
        }
      }

      // 使用 cheerio 解析内容
      if (html) {
        const $ = cheerio.load(html);
        
        // 1. 提取元数据
        title =
          $("title").text().trim() ||
          $("meta[property=\"og:title\"]").attr("content") ||
          $("meta[name=\"title\"]").attr("content") ||
          null;

        // B站视频标题清理
        if (title && urlObj.hostname.includes("bilibili.com")) {
          title = title.replace(/\s*[-_]\s*(哔哩哔哩|bilibili).*$/i, "").trim();
        }

        excerpt =
          $("meta[property=\"og:description\"]").attr("content") ||
          $("meta[name=\"description\"]").attr("content") ||
          null;

        coverImageUrl =
          $("meta[property=\"og:image\"]").attr("content") ||
          $("meta[name=\"twitter:image\"]").attr("content") ||
          null;

        siteName =
          $("meta[property=\"og:site_name\"]").attr("content") ||
          $("meta[name=\"application-name\"]").attr("content") ||
          null;

        // 2. 提取并清洗主要内容
        // 我们传入原始 HTML 给专门的清洗函数
        contentHtml = sanitizeHtmlContent(html);
        
        // 生成纯文本摘要
        const $clean = cheerio.load(contentHtml);
        contentText = $clean.root().text().replace(/\s+/g, " ").trim().substring(0, 5000);
        
        if (!excerpt && contentText) {
          excerpt = contentText.substring(0, 200);
        }
      }

      // 设置默认值
      if (!siteName) {
        if (urlObj.hostname.includes("bilibili.com")) siteName = "哔哩哔哩";
        else if (urlObj.hostname.includes("douyin.com")) siteName = "抖音";
        else if (urlObj.hostname.includes("youtube.com")) siteName = "YouTube";
        else siteName = urlObj.hostname;
      }

      if (!title) title = urlObj.hostname;

      // 更新笔记
      const updateData: any = {
        title: title,
        excerpt: excerpt || null,
        cover_image_url: coverImageUrl,
        site_name: siteName,
        content_text: contentText || null,
        content_html: contentHtml || null,
        captured_at: new Date().toISOString(),
      };

      if (mediaUrl || detectedContentType === "video") {
        updateData.media_url = mediaUrl || targetUrl;
        updateData.content_type = "video";
      }

      const { error: updateError } = await supabase
        .from("notes")
        .update(updateData)
        .eq("id", noteId);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        hasMetadata: !!html,
        isVideo: !!mediaUrl
      });
    } catch (fetchError: any) {
      console.error("Content fetch error:", fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Capture error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to capture content" },
      { status: 500 }
    );
  }
}

