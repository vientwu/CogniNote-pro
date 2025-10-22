-- 数据库修复脚本
-- 修复 CogniNote Pro 数据库表结构问题
-- 执行时间: 2024-01-24

-- 确保projects表有正确的字段
DO $$
BEGIN
    -- 检查并添加name字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'name'
    ) THEN
        ALTER TABLE projects ADD COLUMN name TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- 检查并添加deadline字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'deadline'
    ) THEN
        ALTER TABLE projects ADD COLUMN deadline TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- 检查并添加description字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'description'
    ) THEN
        ALTER TABLE projects ADD COLUMN description TEXT;
    END IF;
    
    -- 检查并添加status字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'status'
    ) THEN
        ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'on_hold'));
    END IF;
    
    -- 检查并添加progress字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'progress'
    ) THEN
        ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);
    END IF;
END $$;

-- 重新创建视图以确保它们是最新的
DROP VIEW IF EXISTS notes_with_tags CASCADE;
DROP VIEW IF EXISTS projects_with_tags CASCADE;

-- 重新创建notes_with_tags视图
CREATE OR REPLACE VIEW notes_with_tags AS
SELECT 
    n.*,
    COALESCE(
        json_agg(
            json_build_object('id', t.id, 'name', t.name, 'color', t.color)
        ) FILTER (WHERE t.id IS NOT NULL), 
        '[]'::json
    ) as tags
FROM notes n
LEFT JOIN note_tags nt ON n.id = nt.note_id
LEFT JOIN tags t ON nt.tag_id = t.id
GROUP BY n.id, n.user_id, n.project_id, n.title, n.content, n.is_favorite, n.created_at, n.updated_at;

-- 重新创建projects_with_tags视图
CREATE OR REPLACE VIEW projects_with_tags AS
SELECT 
    p.*,
    COALESCE(
        json_agg(
            json_build_object('id', t.id, 'name', t.name, 'color', t.color)
        ) FILTER (WHERE t.id IS NOT NULL), 
        '[]'::json
    ) as tags
FROM projects p
LEFT JOIN project_tags pt ON p.id = pt.project_id
LEFT JOIN tags t ON pt.tag_id = t.id
GROUP BY p.id, p.user_id, p.name, p.description, p.status, p.progress, p.deadline, p.created_at, p.updated_at;

-- 为视图启用行级安全策略
ALTER VIEW notes_with_tags ENABLE ROW LEVEL SECURITY;
ALTER VIEW projects_with_tags ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own notes with tags" ON notes_with_tags;
DROP POLICY IF EXISTS "Users can view own projects with tags" ON projects_with_tags;

-- 为视图创建RLS策略
CREATE POLICY "Users can view own notes with tags" ON notes_with_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own projects with tags" ON projects_with_tags FOR SELECT USING (auth.uid() = user_id);

-- 刷新schema缓存
NOTIFY pgrst, 'reload schema';

-- 输出完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库修复脚本执行完成！';
    RAISE NOTICE '- 已确保projects表包含所有必需字段';
    RAISE NOTICE '- 已重新创建视图和RLS策略';
    RAISE NOTICE '- 已刷新schema缓存';
END $$;