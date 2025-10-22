-- Robust admin seeding: ensures all required columns exist
-- Run in Supabase SQL Editor (service role)

BEGIN;

-- 1. 确保 role 列存在
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'member'));

-- 2. 确保 email 列存在
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. 确保 display_name 列存在
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 4. 确保 avatar_url 列存在
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 5. 确保 theme_preference 列存在
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light';

-- 6. 确保 created_at 列存在
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 7. 确保 updated_at 列存在
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 8. 回填 email 数据（从 auth.users）
UPDATE user_profiles AS p
SET email = u.email
FROM auth.users AS u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 9. 插入管理员数据（替换为你的邮箱）
WITH admins AS (
  SELECT u.id, u.email
  FROM auth.users AS u
  WHERE u.email IN ('15274410535@163.com')  -- 修改为你的管理员邮箱
)
INSERT INTO user_profiles (
  id, 
  email, 
  display_name, 
  avatar_url, 
  theme_preference, 
  role, 
  created_at, 
  updated_at
)
SELECT 
  a.id, 
  a.email, 
  COALESCE(split_part(a.email, '@', 1), '管理员'),  -- 用邮箱前缀作为显示名
  NULL,                                              -- 头像为空
  'light',                                           -- 默认主题
  'owner',                                           -- 管理员角色
  NOW(), 
  NOW()
FROM admins a
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

COMMIT;
