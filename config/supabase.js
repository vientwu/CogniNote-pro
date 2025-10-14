/**
 * Supabase 客户端配置
 * 用于连接和操作 CogniNote Pro 数据库
 */

// Supabase 配置常量
const SUPABASE_CONFIG = {
    // 优先使用环境变量，如果没有则使用默认值
    url: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL || 
         (typeof window !== 'undefined' && window.location?.hostname === 'localhost' ? 
          'https://kqiutopycohertaccqkz.supabase.co' : 
          'https://kqiutopycohertaccqkz.supabase.co'),
    anonKey: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
             'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxaXV0b3B5Y29oZXJ0YWNjcWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTk3OTIsImV4cCI6MjA3NTc3NTc5Mn0.7Q51Vv5q3Twn1v-03O9OZtae36xnmddn9UZSQ8_FcmY',
    
    // 可选配置
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
};

// 创建 Supabase 客户端实例
let supabaseClient = null;

/**
 * 初始化 Supabase 客户端
 * @returns {Object} Supabase 客户端实例
 */
function initSupabase() {
    if (!supabaseClient) {
        // 检查是否已加载 Supabase 库
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase 库未加载。请确保在 HTML 中包含 Supabase CDN 链接。');
            return null;
        }
        
        // 验证配置
        if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey || 
            SUPABASE_CONFIG.url.includes('YOUR_SUPABASE_URL') || 
            SUPABASE_CONFIG.anonKey.includes('YOUR_SUPABASE_ANON_KEY')) {
            console.error('请在 supabase.js 中配置正确的 Supabase URL 和 API 密钥');
            return null;
        }
        
        try {
            // 使用 Supabase v2 的正确 API
            supabaseClient = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey,
                SUPABASE_CONFIG.options
            );
            
            console.log('Supabase 客户端初始化成功');
            
            // 设置认证状态监听器
            supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log('认证状态变化:', event, session);
                handleAuthStateChange(event, session);
            });
            
        } catch (error) {
            console.error('Supabase 客户端初始化失败:', error);
            return null;
        }
    }
    
    return supabaseClient;
}

/**
 * 获取 Supabase 客户端实例
 * @returns {Object} Supabase 客户端实例
 */
function getSupabaseClient() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

/**
 * 处理认证状态变化
 * @param {string} event - 认证事件类型
 * @param {Object} session - 用户会话信息
 */
function handleAuthStateChange(event, session) {
    switch (event) {
        case 'SIGNED_IN':
            console.log('用户已登录:', session.user);
            onUserSignedIn(session.user);
            break;
        case 'SIGNED_OUT':
            console.log('用户已登出');
            onUserSignedOut();
            break;
        case 'TOKEN_REFRESHED':
            console.log('令牌已刷新');
            break;
        case 'USER_UPDATED':
            console.log('用户信息已更新:', session.user);
            break;
        default:
            console.log('未知认证事件:', event);
    }
}

/**
 * 用户登录成功处理
 * @param {Object} user - 用户信息
 */
async function onUserSignedIn(user) {
    try {
        // 确保用户配置文件存在
        await ensureUserProfile(user);
        
        // 初始化用户数据
        await initializeUserData(user.id);
        
        // 更新 UI 状态
        if (typeof updateUIForAuthenticatedUser === 'function') {
            updateUIForAuthenticatedUser(user);
        }
        
        // 加载用户数据
        await loadUserData();
        
        // 检查是否需要显示引导界面
        if (typeof checkAndShowOnboarding === 'function') {
            await checkAndShowOnboarding(user);
        }
        
    } catch (error) {
        console.error('用户登录处理失败:', error);
        showNotification('登录处理失败，请刷新页面重试', 'error');
    }
}

/**
 * 用户登出处理
 */
function onUserSignedOut() {
    // 清空应用状态
    if (typeof clearAppState === 'function') {
        clearAppState();
    }
    
    // 更新 UI 状态
    if (typeof updateUIForUnauthenticatedUser === 'function') {
        updateUIForUnauthenticatedUser();
    }
}

/**
 * 确保用户配置文件存在
 * @param {Object} user - 用户信息
 */
async function ensureUserProfile(user) {
    const client = getSupabaseClient();
    if (!client) return;
    
    try {
        // 检查用户配置文件是否存在
        const { data: profile, error: fetchError } = await client
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }
        
        // 如果配置文件不存在，创建一个
        if (!profile) {
            const { error: insertError } = await client
                .from('user_profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    display_name: user.user_metadata?.display_name || user.email.split('@')[0],
                    avatar_url: user.user_metadata?.avatar_url,
                    theme_preference: 'light'
                });
            
            if (insertError) {
                throw insertError;
            }
            
            console.log('用户配置文件创建成功');
        }
        
    } catch (error) {
        console.error('确保用户配置文件失败:', error);
        throw error;
    }
}

/**
 * 初始化用户数据
 * @param {string} userId - 用户ID
 * @param {boolean} createSample - 是否创建示例数据
 */
async function initializeUserData(userId, createSample = true) {
    const client = getSupabaseClient();
    if (!client) return;
    
    try {
        // 检查用户是否有数据
        const { data: notes } = await client
            .from('notes')
            .select('id')
            .eq('user_id', userId)
            .limit(1);
        
        const { data: projects } = await client
            .from('projects')
            .select('id')
            .eq('user_id', userId)
            .limit(1);
        
        // 如果是新用户（没有任何数据），创建初始数据
        if ((!notes || notes.length === 0) && (!projects || projects.length === 0)) {
            console.log('检测到新用户，初始化工作空间');
            
            if (createSample) {
                await createWelcomeData(userId);
            } else {
                await createEmptyWorkspace(userId);
            }
            
            // 设置用户首次登录标记
            await markUserAsInitialized(userId);
        }
        
    } catch (error) {
        console.error('初始化用户数据失败:', error);
        throw error;
    }
}

/**
 * 创建欢迎数据（示例项目和笔记）
 * @param {string} userId - 用户ID
 */
async function createWelcomeData(userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase客户端未初始化');
    
    try {
        // 创建示例项目
        const { data: project, error: projectError } = await client
            .from('projects')
            .insert({
                user_id: userId,
                name: '欢迎使用 CogniNote Pro',
                description: '这是一个示例项目，帮助您快速了解 CogniNote Pro 的功能。您可以在这里管理笔记、跟踪任务进度，并使用标签来组织内容。',
                status: 'progress',
                progress: 30,
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后
                members: ['您自己'],
                color: '#3b82f6'
            })
            .select()
            .single();
        
        if (projectError) throw projectError;
        
        // 创建示例笔记
        const sampleNotes = [
            {
                user_id: userId,
                project_id: project.id,
                title: '欢迎使用 CogniNote Pro！',
                content: `# 欢迎使用 CogniNote Pro！

感谢您选择 CogniNote Pro 作为您的智能记事工具。这里是一些快速入门指南：

## 🚀 主要功能

### 📝 智能笔记
- 支持 **Markdown** 格式编写
- 实时自动保存，永不丢失您的想法
- 强大的搜索功能，快速找到所需内容

### 📁 项目管理
- 创建项目来组织相关笔记
- 跟踪项目进度和任务状态
- 设置截止日期和团队成员

### 🏷️ 标签系统
- 使用标签对笔记进行分类
- 支持多标签组合筛选
- 颜色标记，一目了然

### ☁️ 云端同步
- 数据安全存储在云端
- 多设备实时同步
- 离线编辑，联网后自动同步

## 💡 使用技巧

1. **快速创建笔记**：点击右上角的"+"按钮
2. **使用标签**：在笔记中添加标签来分类管理
3. **项目管理**：将相关笔记归类到同一个项目中
4. **搜索功能**：使用搜索框快速找到需要的内容

## 🎯 下一步

- 尝试创建您的第一个笔记
- 探索项目管理功能
- 使用标签来组织您的内容
- 体验实时同步的便利

祝您使用愉快！如有任何问题，请随时联系我们的支持团队。`,
                is_favorite: true
            },
            {
                user_id: userId,
                project_id: project.id,
                title: 'Markdown 语法指南',
                content: `# Markdown 语法指南

CogniNote Pro 支持完整的 Markdown 语法，让您的笔记更加美观和结构化。

## 基础语法

### 标题
\`\`\`
# 一级标题
## 二级标题
### 三级标题
\`\`\`

### 文本格式
- **粗体文本**
- *斜体文本*
- ~~删除线~~
- \`行内代码\`

### 列表
#### 无序列表
- 项目一
- 项目二
  - 子项目
  - 子项目

#### 有序列表
1. 第一项
2. 第二项
3. 第三项

### 链接和图片
- [链接文本](https://example.com)
- ![图片描述](image-url)

### 代码块
\`\`\`javascript
function hello() {
    console.log("Hello, CogniNote Pro!");
}
\`\`\`

### 表格
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |
| 数据4 | 数据5 | 数据6 |

### 引用
> 这是一个引用块
> 可以包含多行内容

## 高级功能

### 任务列表
- [x] 已完成的任务
- [ ] 待完成的任务
- [ ] 另一个待完成的任务

### 分割线
---

现在您可以开始使用这些语法来创建美观的笔记了！`,
                is_favorite: false
            },
            {
                user_id: userId,
                project_id: project.id,
                title: '项目规划模板',
                content: `# 项目规划模板

使用这个模板来规划您的项目，确保项目顺利进行。

## 📋 项目概述

**项目名称：** [在此填写项目名称]

**项目描述：** [简要描述项目目标和范围]

**开始日期：** [YYYY-MM-DD]

**预计完成日期：** [YYYY-MM-DD]

**项目负责人：** [负责人姓名]

## 🎯 项目目标

### 主要目标
- [ ] 目标1：[具体描述]
- [ ] 目标2：[具体描述]
- [ ] 目标3：[具体描述]

### 成功标准
- [ ] 标准1：[可衡量的成功指标]
- [ ] 标准2：[可衡量的成功指标]

## 📅 项目阶段

### 阶段1：规划阶段
**时间：** [开始日期] - [结束日期]
- [ ] 需求分析
- [ ] 资源评估
- [ ] 风险识别
- [ ] 计划制定

### 阶段2：执行阶段
**时间：** [开始日期] - [结束日期]
- [ ] 任务1
- [ ] 任务2
- [ ] 任务3

### 阶段3：收尾阶段
**时间：** [开始日期] - [结束日期]
- [ ] 测试验收
- [ ] 文档整理
- [ ] 项目总结

## 👥 团队成员

| 姓名 | 角色 | 职责 | 联系方式 |
|------|------|------|----------|
| [姓名] | [角色] | [主要职责] | [邮箱/电话] |

## 📊 进度跟踪

- **当前进度：** 0%
- **下一个里程碑：** [里程碑名称]
- **预计完成时间：** [日期]

## ⚠️ 风险管理

| 风险 | 影响程度 | 发生概率 | 应对措施 |
|------|----------|----------|----------|
| [风险描述] | 高/中/低 | 高/中/低 | [具体措施] |

## 📝 会议记录

### [日期] 项目启动会议
- **参与人员：** [列出参与者]
- **主要讨论：** [会议要点]
- **决定事项：** [重要决定]
- **行动项：** [后续行动]

---

*提示：您可以复制这个模板来创建新的项目规划笔记。*`,
                is_favorite: false
            }
        ];
        
        const { error: notesError } = await client
            .from('notes')
            .insert(sampleNotes);
        
        if (notesError) throw notesError;
        
        // 创建示例标签
        const sampleTags = [
            { user_id: userId, name: '重要', color: '#ef4444' },
            { user_id: userId, name: '工作', color: '#3b82f6' },
            { user_id: userId, name: '学习', color: '#10b981' },
            { user_id: userId, name: '想法', color: '#f59e0b' },
            { user_id: userId, name: '模板', color: '#8b5cf6' }
        ];
        
        const { data: tags, error: tagsError } = await client
            .from('tags')
            .insert(sampleTags)
            .select();
        
        if (tagsError) throw tagsError;
        
        // 为项目添加标签
        await client
            .from('project_tags')
            .insert([
                { project_id: project.id, tag_id: tags.find(t => t.name === '重要').id },
                { project_id: project.id, tag_id: tags.find(t => t.name === '工作').id }
            ]);
        
        console.log('示例数据创建成功');
        
    } catch (error) {
        console.error('创建示例数据失败:', error);
        throw error;
    }
}

/**
 * 创建空白工作空间
 * @param {string} userId - 用户ID
 */
async function createEmptyWorkspace(userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase客户端未初始化');
    
    try {
        // 创建基础标签
        const basicTags = [
            { user_id: userId, name: '重要', color: '#ef4444' },
            { user_id: userId, name: '工作', color: '#3b82f6' },
            { user_id: userId, name: '个人', color: '#10b981' }
        ];
        
        const { error: tagsError } = await client
            .from('tags')
            .insert(basicTags);
        
        if (tagsError) throw tagsError;
        
        console.log('空白工作空间创建成功');
        
    } catch (error) {
        console.error('创建空白工作空间失败:', error);
        throw error;
    }
}

/**
 * 标记用户已初始化
 * @param {string} userId - 用户ID
 */
async function markUserAsInitialized(userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase客户端未初始化');
    
    try {
        const { error } = await client
            .from('user_profiles')
            .update({ 
                is_initialized: true,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        
        if (error) throw error;
        
        console.log('用户初始化标记成功:', userId);
        
    } catch (error) {
        console.error('标记用户初始化失败:', error);
        throw error;
    }
}

/**
 * 加载用户数据到应用状态
 */
async function loadUserData() {
    try {
        // 加载笔记
        await loadNotesFromDatabase();
        
        // 加载项目
        await loadProjectsFromDatabase();
        
        // 加载标签
        await loadTagsFromDatabase();
        
        // 更新 UI
        if (typeof updateDashboardStats === 'function') {
            updateDashboardStats();
        }
        
        console.log('用户数据加载完成');
        
    } catch (error) {
        console.error('加载用户数据失败:', error);
        showNotification('数据加载失败，请刷新页面重试', 'error');
    }
}

/**
 * 清空应用状态
 */
function clearAppState() {
    if (typeof AppState !== 'undefined') {
        AppState.notes = [];
        AppState.projects = [];
        AppState.currentNote = null;
        AppState.currentProject = null;
    }
}

/**
 * 检查用户是否已登录
 * @returns {Object|null} 当前用户信息或 null
 */
async function getCurrentUser() {
    const client = getSupabaseClient();
    if (!client) return null;
    
    try {
        const { data: { user }, error } = await client.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('获取当前用户失败:', error);
        return null;
    }
}

/**
 * 用户登录
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Object} 登录结果
 */
async function signInUser(email, password) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase 客户端未初始化');
    }
    
    try {
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        return { success: true, user: data.user };
        
    } catch (error) {
        console.error('用户登录失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 用户注册
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Object} 注册结果
 */
async function signUpUser(email, password) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase 客户端未初始化');
    }
    
    try {
        const { data, error } = await client.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        return { success: true, user: data.user };
        
    } catch (error) {
        console.error('用户注册失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 用户登出
 * @returns {Object} 登出结果
 */
async function signOutUser() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase 客户端未初始化');
    }
    
    try {
        const { error } = await client.auth.signOut();
        if (error) throw error;
        
        return { success: true };
        
    } catch (error) {
        console.error('用户登出失败:', error);
        return { success: false, error: error.message };
    }
}

// 导出主要函数（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabase,
        getSupabaseClient,
        getCurrentUser,
        signInUser,
        signUpUser,
        signOutUser,
        loadUserData,
        clearAppState
    };
}

// 全局导出函数和配置（用于浏览器环境）
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.initSupabase = initSupabase;
window.getSupabaseClient = getSupabaseClient;
window.getCurrentUser = getCurrentUser;
window.signInUser = signInUser;
window.signUpUser = signUpUser;
window.signOutUser = signOutUser;
window.loadUserData = loadUserData;
window.clearAppState = clearAppState;