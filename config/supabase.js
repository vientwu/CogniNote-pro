/**
 * Supabase 客户端配置和认证管理
 * 修复版本 - 解决登录、笔记创建、项目创建问题
 */

// Supabase 配置
const SUPABASE_CONFIG = {
    url: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL || 
         (typeof window !== 'undefined' && window.location?.hostname === 'localhost' ? 
          'https://kqiutopycohertaccqkz.supabase.co' : 
          'https://kqiutopycohertaccqkz.supabase.co'),
    anonKey: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
             'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxaXV0b3B5Y29oZXJ0YWNjcWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTk3OTIsImV4cCI6MjA3NTc3NTc5Mn0.7Q51Vv5q3Twn1v-03O9OZtae36xnmddn9UZSQ8_FcmY',
    
    // 优化的配置选项
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            storage: (typeof window !== 'undefined' ? {
                getItem: (key) => window.sessionStorage.getItem(key),
                setItem: (key, value) => window.sessionStorage.setItem(key, value),
                removeItem: (key) => window.sessionStorage.removeItem(key)
            } : undefined)
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    }
};

// 全局 Supabase 客户端实例
let supabaseClient = null;
let isProcessingAuth = false; // 防止重复处理认证事件的标志位
// 统一管理员邮箱白名单（如果未设置则提供默认值）
if (typeof window !== 'undefined') {
  window.ADMIN_EMAILS = Array.isArray(window.ADMIN_EMAILS) ? window.ADMIN_EMAILS : ['15274410535@163.com'];
}

/**
 * 初始化 Supabase 客户端
 */
function initSupabase() {
    console.log('🔵 开始初始化 Supabase 客户端...');
    
    try {
        // 检查 Supabase SDK 是否已加载
        if (typeof window === 'undefined' || !window.supabase) {
            console.error('❌ Supabase SDK 未加载');
            return false;
        }
        
        // 创建 Supabase 客户端
        supabaseClient = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey,
            SUPABASE_CONFIG.options
        );
        
        console.log('✅ Supabase 客户端初始化成功');
        console.log('🔵 Supabase URL:', SUPABASE_CONFIG.url);
        console.log('🔵 配置选项:', SUPABASE_CONFIG.options);
        
        // 设置认证状态监听器
        setupAuthListener();
        
        return true;
    } catch (error) {
        console.error('❌ Supabase 客户端初始化失败:', error);
        return false;
    }
}

/**
 * 获取 Supabase 客户端实例
 */
function getSupabaseClient() {
    return supabaseClient;
}

/**
 * 设置认证状态监听器
 */
function setupAuthListener() {
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('⚠️ Supabase 客户端未初始化，无法设置认证监听器');
        return;
    }
    
    console.log('🔵 设置认证状态监听器...');
    
    client.auth.onAuthStateChange(async (event, session) => {
        console.log('🔵 认证状态变化:', event, session?.user?.email || '无用户');
        console.log('🔵 会话状态:', session ? '有会话' : '无会话');
        console.log('🔵 用户:', session?.user?.email || '无用户');
        
        // ⚠️ 不要在这里加载任何数据！
        // ⚠️ 不要在这里调用任何函数！
        // ⚠️ 只记录日志！
        
        // 暂时禁用自动处理，防止循环
        // await handleAuthStateChange(event, session);
    });
}

/**
 * 处理认证状态变化
 */
async function handleAuthStateChange(event, session) {
    console.log('🔵 处理认证状态变化:', event, '处理中:', isProcessingAuth);
    
    // 防止重复处理同一个认证事件
    if (isProcessingAuth) {
        console.log('⚠️ 认证正在处理中，跳过重复调用');
        return;
    }
    
    try {
        if (event === 'SIGNED_IN' && session?.user) {
            console.log('✅ 用户已登录:', session.user.email);
            
            // 设置处理标志位
            isProcessingAuth = true;
            
            // 调用登录成功处理函数
            await onUserSignedIn(session.user);
            
        } else if (event === 'SIGNED_OUT') {
            console.log('🔵 用户已登出');
            onUserSignedOut();
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('🔵 令牌已刷新');
        }
    } catch (error) {
        console.error('❌ 处理认证状态变化失败:', error);
    } finally {
        // 无论成功还是失败，都要重置处理标志位
        isProcessingAuth = false;
    }
}

/**
 * 用户登录成功处理 - 简化版本
 */
async function onUserSignedIn(user) {
    console.log('=== 开始处理用户登录 ===');
    console.log('用户ID:', user.id);
    console.log('用户邮箱:', user.email);
    
    try {
        console.log('1. 确保用户配置文件存在...');
        await ensureUserProfile(user);
        console.log('✅ 用户配置文件处理完成');
        
        console.log('2. 更新UI状态...');
        if (typeof updateUIForAuthenticatedUser === 'function') {
            console.log('调用 updateUIForAuthenticatedUser，传入用户:', user.email);
            await updateUIForAuthenticatedUser(user);
            console.log('✅ UI状态更新完成');
        } else {
            console.warn('⚠️ updateUIForAuthenticatedUser 函数不存在');
        }
        
        // ❌ 临时注释掉自动数据加载，防止循环
        // console.log('3. 加载用户数据...');
        // await loadUserData();
        // console.log('✅ 用户数据加载完成');
        
        console.log('🎉 用户登录处理完成（已跳过自动数据加载）');
        
    } catch (error) {
        console.error('❌ 用户登录处理失败:', error);
        console.error('错误详情:', error.message);
        // 不显示错误通知，避免影响用户体验
    }
}

/**
 * 用户登出处理
 */
function onUserSignedOut() {
    console.log('🔵 处理用户登出...');
    clearAppState();
    if (typeof updateUIForUnauthenticatedUser === 'function') {
        updateUIForUnauthenticatedUser();
    }
}

/**
 * 确保用户配置文件存在 - 简化版本
 */
async function ensureUserProfile(user) {
    console.log('🔵 ensureUserProfile 开始执行，用户:', user.email);
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('⚠️ Supabase 客户端未初始化，跳过用户配置文件检查');
        return;
    }
    
    try {
        console.log('🔵 检查用户配置文件是否存在...');
        
        // 先尝试查询用户配置文件
        const { data: profile, error: fetchError } = await client
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(); // 使用 maybeSingle 避免 PGRST116 错误
        
        console.log('🔵 用户配置文件查询结果:', { 
            hasProfile: !!profile, 
            hasError: !!fetchError,
            errorCode: fetchError?.code,
            errorMessage: fetchError?.message 
        });
        
        if (fetchError) {
            console.warn('⚠️ 用户配置文件查询失败:', fetchError.message);
            const fallbackRole = (Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.includes(user.email)) ? 'owner' : 'member';
            if (typeof window.updateRoleBanner === 'function') {
                window.updateRoleBanner(fallbackRole);
            }
            if (typeof window !== 'undefined') {
                window.currentUserRole = fallbackRole;
            }
            return {
                id: user.id,
                email: user.email,
                display_name: user.user_metadata?.display_name || user.email.split('@')[0],
                avatar_url: user.user_metadata?.avatar_url || null,
                theme_preference: 'light',
                role: fallbackRole,
                _error: fetchError?.message
            };
        }
        
        // 如果配置文件不存在，尝试创建一个
        if (!profile) {
            console.log('🔵 用户配置文件不存在，尝试创建...');
            
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
                console.warn('⚠️ 用户配置文件创建失败:', insertError.message);
                const fallbackRole = (Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.includes(user.email)) ? 'owner' : 'member';
                if (typeof window.updateRoleBanner === 'function') window.updateRoleBanner(fallbackRole);
                if (typeof window !== 'undefined') window.currentUserRole = fallbackRole;
                return {
                    id: user.id,
                    email: user.email,
                    display_name: user.user_metadata?.display_name || user.email.split('@')[0],
                    avatar_url: user.user_metadata?.avatar_url || null,
                    theme_preference: 'light',
                    role: fallbackRole,
                    _error: insertError?.message
                };
            }
            
            console.log('✅ 用户配置文件创建成功');
            const createdRole = (Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.includes(user.email)) ? 'owner' : 'member';
            if (typeof window.updateRoleBanner === 'function') window.updateRoleBanner(createdRole);
            if (typeof window !== 'undefined') window.currentUserRole = createdRole;
            return {
                id: user.id,
                email: user.email,
                display_name: user.user_metadata?.display_name || user.email.split('@')[0],
                avatar_url: user.user_metadata?.avatar_url || null,
                theme_preference: 'light',
                role: createdRole
            };
        } else {
            console.log('✅ 用户配置文件已存在');
            const computedRole = typeof profile.role !== 'undefined'
                ? profile.role
                : ((Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.includes(user.email)) ? 'owner' : 'member');
            if (typeof window.updateRoleBanner === 'function') window.updateRoleBanner(computedRole);
            if (typeof window !== 'undefined') window.currentUserRole = computedRole;
            return { ...profile, role: computedRole };
        }
        
    } catch (error) {
        console.warn('⚠️ ensureUserProfile 执行失败，但继续执行后续流程:', error.message);
        const fallbackRole = (Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.includes(user.email)) ? 'owner' : 'member';
        if (typeof window.updateRoleBanner === 'function') window.updateRoleBanner(fallbackRole);
        if (typeof window !== 'undefined') window.currentUserRole = fallbackRole;
        return {
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.display_name || user.email.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url || null,
            theme_preference: 'light',
            role: fallbackRole,
            _error: error?.message
        };
    }
    
    console.log('✅ ensureUserProfile 执行完成');
}

/**
 * 加载用户数据 - 简化版本
 */
async function loadUserData() {
    console.log('🔵 loadUserData 被调用');
    console.log('⏸️ 数据加载已临时禁用，防止循环');
    return;  // ✅ 直接返回，不执行任何操作
    
    // 原有的加载逻辑（暂时不执行）
    console.log('🔵 开始加载用户数据...');
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('⚠️ Supabase 客户端未初始化');
        return;
    }
    
    try {
        // 获取当前用户
        const { data: { user }, error: userError } = await client.auth.getUser();
        
        if (userError || !user) {
            console.warn('⚠️ 无法获取当前用户:', userError?.message);
            return;
        }
        
        console.log('✅ 用户数据加载完成');
        
        // 更新仪表板（如果函数存在）
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        
    } catch (error) {
        console.warn('⚠️ 加载用户数据失败:', error.message);
    }
}

/**
 * 清空应用状态
 */
function clearAppState() {
    console.log('🔵 清空应用状态...');
    // 清空全局变量
    if (typeof window !== 'undefined') {
        window.currentUser = null;
        window.userProjects = [];
        window.userNotes = [];
        window.userTags = [];
    }
}

/**
 * 获取当前用户 - 简化版本
 */
async function getCurrentUser() {
    console.log('🔵 getCurrentUser 函数被调用');
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        throw new Error('Supabase 客户端未初始化');
    }
    
    try {
        console.log('🔵 调用 client.auth.getUser()...');
        const { data: { user }, error } = await client.auth.getUser();
        
        console.log('🔵 getUser API 返回结果:', { 
            hasUser: !!user, 
            hasError: !!error,
            userEmail: user?.email,
            errorMessage: error?.message 
        });
        
        if (error) {
            console.error('❌ getUser API返回错误:', error);
            console.error('错误类型:', error.name);
            console.error('错误消息:', error.message);
            throw error;
        }
        
        if (!user) {
            console.log('🔵 当前没有登录用户');
            return null;
        }
        
        console.log('✅ 成功获取当前用户:', user.email);
        return user;
        
    } catch (error) {
        console.error('❌ 获取当前用户失败:', error);
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        
        // 特殊处理 AuthSessionMissingError - 这是正常情况，用户未登录
        if (error.name === 'AuthSessionMissingError') {
            console.log('🔍 用户未登录 (AuthSessionMissingError)');
            return null;
        }
        
        // 其他错误继续抛出
        throw error;
    }
}

/**
 * 用户登录 - 优化版本
 */
async function signInUser(email, password) {
    console.log('🔵 signInUser 函数开始执行，邮箱:', email);
    const client = getSupabaseClient();
    console.log('🔵 Supabase 客户端状态:', client ? '已初始化' : '未初始化');
    
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    try {
        console.log('🔵 开始调用 client.auth.signInWithPassword...');
        
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        
        console.log('🔵 signInWithPassword 返回结果:', { 
            hasData: !!data, 
            hasUser: !!data?.user, 
            hasSession: !!data?.session,
            hasError: !!error,
            errorMessage: error?.message 
        });
        
        if (error) {
            console.error('❌ 登录失败:', error.message);
            return { success: false, error: error.message };
        }
        
        if (data?.user) {
            console.log('✅ 登录成功，用户:', data.user.email);
            return { success: true, user: data.user, session: data.session };
        } else {
            console.error('❌ 登录失败：未返回用户信息');
            return { success: false, error: '登录失败：未返回用户信息' };
        }
        
    } catch (error) {
        console.error('❌ signInUser 捕获到错误:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 用户注册
 */
async function signUpUser(email, password) {
    console.log('🔵 signUpUser 函数开始执行，邮箱:', email);
    const client = getSupabaseClient();
    
    if (!client) {
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    try {
        const { data, error } = await client.auth.signUp({
            email,
            password
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, user: data.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 用户登出
 */
async function signOutUser() {
    console.log('🔵 signOutUser 函数开始执行');
    const client = getSupabaseClientOptimized();
    
    if (!client) {
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    try {
        const { error } = await client.auth.signOut();
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 导出模块（如果在 Node.js 环境中）
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

// 全局暴露（浏览器环境）
if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
    window.initSupabase = initSupabase;
    window.getSupabaseClient = getSupabaseClient;
    window.getCurrentUser = getCurrentUser;
    window.signInUser = signInUser;
    window.signUpUser = signUpUser;
    window.signOutUser = signOutUser;
    window.loadUserData = loadUserData;
    window.clearAppState = clearAppState;
}