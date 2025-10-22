-- CogniNote Pro 数据库表结构
-- 创建时间: 2024-01-24
-- 描述: 智能AI记事本的完整数据库架构

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表 (使用Supabase内置的auth.users)
-- 这里创建用户配置表来存储额外信息
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 增加角色列（若不存在），用于全局权限控制
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'member'));

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'on_hold')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 笔记表
CREATE TABLE IF NOT EXISTS notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 笔记标签关联表
CREATE TABLE IF NOT EXISTS note_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(note_id, tag_id)
);

-- 项目标签关联表
CREATE TABLE IF NOT EXISTS project_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, tag_id)
);

-- 项目成员表
CREATE TABLE IF NOT EXISTS project_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON notes(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON notes(is_favorite);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON project_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id ON project_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要自动更新时间的表创建触发器
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 行级安全策略 (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 用户配置表的RLS策略
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 管理员判断函数（SECURITY DEFINER，避免RLS递归）
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.user_profiles WHERE id = auth.uid();
  RETURN COALESCE(v_role IN ('owner','admin'), false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, anon;

-- 允许 owner/admin 读取全表（用于管理面板）
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (
    public.is_current_user_admin()
);

-- 项目表的RLS策略
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- 笔记表的RLS策略
CREATE POLICY "Users can view own notes" ON notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (auth.uid() = user_id);

-- 标签表的RLS策略
CREATE POLICY "Users can view own tags" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE USING (auth.uid() = user_id);

-- 笔记标签关联表的RLS策略
CREATE POLICY "Users can view own note tags" ON note_tags FOR SELECT USING (
    EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid())
);
CREATE POLICY "Users can insert own note tags" ON note_tags FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid())
);
CREATE POLICY "Users can delete own note tags" ON note_tags FOR DELETE USING (
    EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid())
);

-- 项目标签关联表的RLS策略
CREATE POLICY "Users can view own project tags" ON project_tags FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_tags.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can insert own project tags" ON project_tags FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_tags.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can delete own project tags" ON project_tags FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_tags.project_id AND projects.user_id = auth.uid())
);

-- 项目成员表的RLS策略
CREATE POLICY "Users can view project members" ON project_members FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Project owners can manage members" ON project_members FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.user_id = auth.uid())
);

-- 任务表的RLS策略
CREATE POLICY "Users can view project tasks" ON tasks FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = assignee_id OR
    EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can insert project tasks" ON tasks FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can update project tasks" ON tasks FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can delete project tasks" ON tasks FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
);

-- 创建视图以简化查询
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

-- 为视图创建RLS策略
CREATE POLICY "Users can view own notes with tags" ON notes_with_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own projects with tags" ON projects_with_tags FOR SELECT USING (auth.uid() = user_id);

-- 创建函数以获取用户统计信息
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_notes', (SELECT COUNT(*) FROM notes WHERE user_id = user_uuid),
        'favorite_notes', (SELECT COUNT(*) FROM notes WHERE user_id = user_uuid AND is_favorite = true),
        'today_notes', (SELECT COUNT(*) FROM notes WHERE user_id = user_uuid AND DATE(created_at) = CURRENT_DATE),
        'total_projects', (SELECT COUNT(*) FROM projects WHERE user_id = user_uuid),
        'active_projects', (SELECT COUNT(*) FROM projects WHERE user_id = user_uuid AND status = 'active'),
        'completed_projects', (SELECT COUNT(*) FROM projects WHERE user_id = user_uuid AND status = 'completed'),
        'total_tasks', (SELECT COUNT(*) FROM tasks WHERE user_id = user_uuid),
        'completed_tasks', (SELECT COUNT(*) FROM tasks WHERE user_id = user_uuid AND status = 'done')
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 应用状态表：用于离线/在线双向同步
CREATE TABLE IF NOT EXISTS user_states (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    state JSONB NOT NULL,
    version TEXT DEFAULT 'v1',
    device_id TEXT,
    checksum TEXT,
    client_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_states_user_id ON user_states(user_id);
CREATE INDEX IF NOT EXISTS idx_user_states_updated_at ON user_states(updated_at DESC);

-- 更新时间触发器
CREATE TRIGGER update_user_states_updated_at BEFORE UPDATE ON user_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 行级安全策略
ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own states" ON user_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own states" ON user_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own states" ON user_states FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own states" ON user_states FOR DELETE USING (auth.uid() = user_id);