-- Migration: Seed Initial Data for Testing
-- This migration inserts sample data for testing the application
-- Note: Replace the user_id with your actual user ID from auth.users

-- ============================================
-- IMPORTANT: Before running this migration
-- ============================================
-- 1. First, create a user account through the sign-up page
-- 2. Get your user ID from Supabase Dashboard > Authentication > Users
-- 3. Replace 'YOUR_USER_ID_HERE' with your actual user ID below
-- 4. Or use this query to get your user ID:
--    SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- ============================================
-- Helper Function: Get User ID
-- ============================================
-- You can use this function to get your user ID:
-- DO $$
-- DECLARE
--   test_user_id UUID;
-- BEGIN
--   SELECT id INTO test_user_id FROM auth.users LIMIT 1;
--   RAISE NOTICE 'User ID: %', test_user_id;
-- END $$;

-- ============================================
-- Sample Data Insertion
-- ============================================
-- Note: This script uses a placeholder user_id. 
-- Replace it with your actual user ID or use the function above.

-- Example: Create sample folders
-- INSERT INTO public.folders (user_id, name, description, color, position)
-- VALUES
--   (
--     (SELECT id FROM auth.users LIMIT 1),
--     '技术文章',
--     '收藏的技术相关文章',
--     '#3B82F6',
--     0
--   ),
--   (
--     (SELECT id FROM auth.users LIMIT 1),
--     '新闻资讯',
--     '日常新闻和资讯',
--     '#10B981',
--     1
--   ),
--   (
--     (SELECT id FROM auth.users LIMIT 1),
--     '学习笔记',
--     '学习相关的笔记和资料',
--     '#8B5CF6',
--     2
--   )
-- ON CONFLICT DO NOTHING;

-- Example: Create sample tags
-- INSERT INTO public.tags (user_id, name, color)
-- VALUES
--   (
--     (SELECT id FROM auth.users LIMIT 1),
--     'AI',
--     '#EF4444'
--   ),
--   (
--     (SELECT id FROM auth.users LIMIT 1),
--     '前端开发',
--     '#3B82F6'
--   ),
--   (
--     (SELECT id FROM auth.users LIMIT 1),
--     '后端开发',
--     '#10B981'
--   ),
--   (
--     (SELECT id FROM auth.users LIMIT 1),
--     '设计',
--     '#F59E0B'
--   )
-- ON CONFLICT DO NOTHING;

-- Example: Create sample notes (articles)
-- INSERT INTO public.notes (
--   user_id,
--   folder_id,
--   source_url,
--   content_type,
--   title,
--   author,
--   site_name,
--   published_at,
--   content_html,
--   content_text,
--   excerpt,
--   cover_image_url,
--   status
-- )
-- SELECT
--   u.id,
--   f.id,
--   'https://example.com/article-1',
--   'article',
--   'Next.js 15 新特性详解',
--   'John Doe',
--   'Tech Blog',
--   NOW() - INTERVAL '2 days',
--   '<article><h1>Next.js 15 新特性详解</h1><p>Next.js 15 带来了许多令人兴奋的新特性...</p></article>',
--   'Next.js 15 带来了许多令人兴奋的新特性，包括改进的服务器组件、更好的性能优化等。',
--   'Next.js 15 带来了许多令人兴奋的新特性...',
--   'https://images.unsplash.com/photo-1633356122544-f134324a6cee',
--   'unread'
-- FROM auth.users u
-- LEFT JOIN public.folders f ON f.user_id = u.id AND f.name = '技术文章'
-- LIMIT 1
-- ON CONFLICT (user_id, source_url) DO NOTHING;

-- ============================================
-- Automated Seed Function
-- ============================================
-- This function will create sample data for the first user in the system
CREATE OR REPLACE FUNCTION seed_sample_data()
RETURNS void AS $$
DECLARE
  sample_user_id UUID;
  tech_folder_id UUID;
  news_folder_id UUID;
  ai_tag_id UUID;
  frontend_tag_id UUID;
  note1_id UUID;
  note2_id UUID;
BEGIN
  -- Get the first user (or you can modify this to get a specific user)
  SELECT id INTO sample_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  
  IF sample_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Please create a user account first.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Seeding data for user: %', sample_user_id;
  
  -- Create sample folders
  INSERT INTO public.folders (user_id, name, description, color, position)
  VALUES
    (sample_user_id, '技术文章', '收藏的技术相关文章', '#3B82F6', 0),
    (sample_user_id, '新闻资讯', '日常新闻和资讯', '#10B981', 1),
    (sample_user_id, '学习笔记', '学习相关的笔记和资料', '#8B5CF6', 2)
  ON CONFLICT (user_id, name) DO NOTHING
  RETURNING id INTO tech_folder_id;
  
  SELECT id INTO tech_folder_id FROM public.folders WHERE user_id = sample_user_id AND name = '技术文章';
  SELECT id INTO news_folder_id FROM public.folders WHERE user_id = sample_user_id AND name = '新闻资讯';
  
  -- Create sample tags
  INSERT INTO public.tags (user_id, name, color)
  VALUES
    (sample_user_id, 'AI', '#EF4444'),
    (sample_user_id, '前端开发', '#3B82F6'),
    (sample_user_id, '后端开发', '#10B981'),
    (sample_user_id, '设计', '#F59E0B')
  ON CONFLICT (user_id, name) DO NOTHING;
  
  SELECT id INTO ai_tag_id FROM public.tags WHERE user_id = sample_user_id AND name = 'AI';
  SELECT id INTO frontend_tag_id FROM public.tags WHERE user_id = sample_user_id AND name = '前端开发';
  
  -- Create sample notes (articles)
  INSERT INTO public.notes (
    user_id,
    folder_id,
    source_url,
    content_type,
    title,
    author,
    site_name,
    published_at,
    content_html,
    content_text,
    excerpt,
    cover_image_url,
    status
  )
  VALUES
    (
      sample_user_id,
      tech_folder_id,
      'https://nextjs.org/blog/next-15',
      'article',
      'Next.js 15 新特性详解',
      'Next.js Team',
      'Next.js Blog',
      NOW() - INTERVAL '2 days',
      '<article><h1>Next.js 15 新特性详解</h1><p>Next.js 15 带来了许多令人兴奋的新特性，包括改进的服务器组件、更好的性能优化、新的缓存策略等。这些改进让开发者能够构建更快、更高效的 Web 应用。</p><h2>主要特性</h2><ul><li>改进的服务器组件</li><li>更好的性能优化</li><li>新的缓存策略</li></ul></article>',
      'Next.js 15 带来了许多令人兴奋的新特性，包括改进的服务器组件、更好的性能优化、新的缓存策略等。这些改进让开发者能够构建更快、更高效的 Web 应用。主要特性包括改进的服务器组件、更好的性能优化、新的缓存策略。',
      'Next.js 15 带来了许多令人兴奋的新特性，包括改进的服务器组件、更好的性能优化等。',
      'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
      'unread'
    ),
    (
      sample_user_id,
      tech_folder_id,
      'https://react.dev/blog/2024/react-19',
      'article',
      'React 19 发布：新特性一览',
      'React Team',
      'React Blog',
      NOW() - INTERVAL '5 days',
      '<article><h1>React 19 发布：新特性一览</h1><p>React 19 正式发布，带来了许多新特性和改进。这个版本专注于提升开发体验和应用性能。</p></article>',
      'React 19 正式发布，带来了许多新特性和改进。这个版本专注于提升开发体验和应用性能。',
      'React 19 正式发布，带来了许多新特性和改进。',
      'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
      'reading'
    ),
    (
      sample_user_id,
      news_folder_id,
      'https://example.com/news-1',
      'article',
      'AI 技术的最新进展',
      'Tech News',
      'Tech Daily',
      NOW() - INTERVAL '1 day',
      '<article><h1>AI 技术的最新进展</h1><p>人工智能技术在过去一年中取得了重大突破...</p></article>',
      '人工智能技术在过去一年中取得了重大突破，包括大语言模型、计算机视觉、自然语言处理等领域都有了显著进展。',
      '人工智能技术在过去一年中取得了重大突破...',
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      'unread'
    ),
    (
      sample_user_id,
      NULL,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'video',
      'React 教程：从入门到精通',
      'Tech Channel',
      'YouTube',
      NOW() - INTERVAL '3 days',
      NULL,
      NULL,
      '一个全面的 React 教程视频，涵盖从基础到高级的所有内容。',
      'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
      'unread'
    ),
    (
      sample_user_id,
      NULL,
      'https://example.com/podcast-1',
      'audio',
      '前端开发最佳实践',
      'Dev Podcast',
      'Podcast Platform',
      NOW() - INTERVAL '7 days',
      NULL,
      NULL,
      '讨论前端开发的最佳实践和最新趋势。',
      'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800',
      'archived'
    )
  ON CONFLICT (user_id, source_url) DO NOTHING
  RETURNING id INTO note1_id;
  
  -- Get note IDs for tag associations
  SELECT id INTO note1_id FROM public.notes WHERE user_id = sample_user_id AND source_url = 'https://nextjs.org/blog/next-15';
  SELECT id INTO note2_id FROM public.notes WHERE user_id = sample_user_id AND source_url = 'https://react.dev/blog/2024/react-19';
  
  -- Associate tags with notes
  IF note1_id IS NOT NULL AND frontend_tag_id IS NOT NULL THEN
    INSERT INTO public.note_tags (note_id, tag_id)
    VALUES (note1_id, frontend_tag_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF note2_id IS NOT NULL AND frontend_tag_id IS NOT NULL THEN
    INSERT INTO public.note_tags (note_id, tag_id)
    VALUES (note2_id, frontend_tag_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Create sample highlights
  INSERT INTO public.highlights (user_id, note_id, quote, range_start, range_end, color)
  SELECT
    sample_user_id,
    id,
    'Next.js 15 带来了许多令人兴奋的新特性',
    0,
    20,
    '#FFEB3B'
  FROM public.notes
  WHERE user_id = sample_user_id AND title = 'Next.js 15 新特性详解'
  LIMIT 1
  ON CONFLICT DO NOTHING;
  
  -- Create sample annotations
  INSERT INTO public.annotations (user_id, note_id, highlight_id, content)
  SELECT
    sample_user_id,
    h.note_id,
    h.id,
    '这是一个重要的更新，值得深入学习。'
  FROM public.highlights h
  WHERE h.user_id = sample_user_id
  LIMIT 1
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Sample data seeded successfully!';
END;
$$ LANGUAGE plpgsql;

-- Run the seed function
SELECT seed_sample_data();

-- Clean up: Drop the function if you want (optional)
-- DROP FUNCTION IF EXISTS seed_sample_data();

