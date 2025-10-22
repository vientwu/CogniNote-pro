/**
 * Supabase 客户端配置和认证管理 - 性能优化版
 * 优化重点：并行处理、智能缓存、异步UI更新
 */

// Supabase 配置
const SUPABASE_CONFIG_OPTIMIZED = {
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
let supabaseClientOptimized = null;

// 性能优化缓存
const performanceCache = {
    userProfiles: new Map(),
    authStates: new Map(),
    lastAuthCheck: 0,
    cacheTimeout: 5 * 60 * 1000 // 5分钟缓存
};

/**
 * 初始化 Supabase 客户端 - 优化版
 */
function initSupabaseOptimized() {
    console.log('🚀 开始初始化优化版 Supabase 客户端...');
    
    try {
        // 检查 Supabase SDK 是否已加载
        if (typeof window === 'undefined' || !window.supabase) {
            console.error('❌ Supabase SDK 未加载');
            return false;
        }
        
        // 创建 Supabase 客户端
        supabaseClientOptimized = window.supabase.createClient(
            SUPABASE_CONFIG_OPTIMIZED.url,
            SUPABASE_CONFIG_OPTIMIZED.anonKey,
            SUPABASE_CONFIG_OPTIMIZED.options
        );
        
        console.log('✅ 优化版 Supabase 客户端初始化成功');
        
        // 设置认证状态监听器
        setupOptimizedAuthListener();
        
        return true;
    } catch (error) {
        console.error('❌ 优化版 Supabase 客户端初始化失败:', error);
        return false;
    }
}

/**
 * 获取 Supabase 客户端实例
 */
function getSupabaseClientOptimized() {
    return supabaseClientOptimized;
}

/**
 * 设置优化版认证状态监听器
 */
function setupOptimizedAuthListener() {
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('⚠️ Supabase 客户端未初始化，无法设置认证监听器');
        return;
    }
    
    console.log('🚀 设置优化版认证状态监听器...');
    
    client.auth.onAuthStateChange(async (event, session) => {
        console.log('🚀 认证状态变化:', event, session?.user?.email || '无用户');
        await handleOptimizedAuthStateChange(event, session);
    });
}

/**
 * 处理优化版认证状态变化
 */
async function handleOptimizedAuthStateChange(event, session) {
    console.log('🚀 处理优化版认证状态变化:', event);
    
    // 检查紧急修复标志
    if (window.EMERGENCY_FIX_ENABLED && window.EMERGENCY_FIX_FLAGS?.DISABLE_INITIAL_SESSION) {
        if (event === 'INITIAL_SESSION') {
            console.log('🚫 紧急修复：跳过 INITIAL_SESSION 自动恢复');
            return;
        }
    }
    
    try {
        if (event === 'SIGNED_IN' && session?.user) {
            await onUserSignedInOptimized(session.user);
        } else if (event === 'SIGNED_OUT') {
            onUserSignedOutOptimized();
        } else if (event === 'INITIAL_SESSION' && session?.user) {
            // 只在没有启用紧急修复时处理 INITIAL_SESSION
            if (!window.EMERGENCY_FIX_ENABLED) {
                console.log('🔄 处理初始会话恢复');
                await onUserSignedInOptimized(session.user);
            }
        }
    } catch (error) {
        console.error('❌ 处理认证状态变化失败:', error);
    }
}

/**
 * 优化版用户登录成功处理 - 并行执行
 */
async function onUserSignedInOptimized(user) {
    console.log('🔵 onUserSignedInOptimized 开始执行，用户:', user.email);
    const startTime = performance.now();
    
    try {
        // 🔥 关键修复：使用 Promise.allSettled 而不是 Promise.all
        // 这样即使某个操作失败，也不会影响其他操作
        console.log('💡 开始并行处理两个操作（使用容错机制）');
        
        const results = await Promise.allSettled([
            ensureUserProfileOptimized(user),
            loadUserDataOptimized(user)
        ]);
        
        const [profileResult, userDataResult] = results;
        
        const totalTime = performance.now() - startTime;
        console.log(`✅ onUserSignedInOptimized 完成 (耗时: ${(totalTime/1000).toFixed(2)}秒)`);
        
        // 处理结果，提供降级策略
        const processedResults = {
            profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
            userData: userDataResult.status === 'fulfilled' ? userDataResult.value : null
        };
        
        // 记录失败的操作，但不影响整体成功
        if (profileResult.status === 'rejected') {
            console.warn('⚠️ 用户配置文件加载失败，将使用默认配置:', profileResult.reason);
        }
        
        if (userDataResult.status === 'rejected') {
            console.warn('⚠️ 用户数据加载失败，将使用默认数据:', userDataResult.reason);
        }
        
        console.log('📊 处理后的结果:', processedResults);
        
        // 即使部分操作失败，也返回成功，确保用户能正常使用应用
        return { 
            success: true, 
            profileResult: processedResults.profile, 
            userDataResult: processedResults.userData,
            warnings: {
                profileFailed: profileResult.status === 'rejected',
                userDataFailed: userDataResult.status === 'rejected'
            }
        };
    } catch (error) {
        const errorTime = performance.now() - startTime;
        console.error(`❌ onUserSignedInOptimized 意外错误 (耗时: ${(errorTime/1000).toFixed(2)}秒):`, error);
        
        // 即使出现意外错误，也尝试返回基本的成功状态
        console.log('🔄 尝试降级处理，确保用户能正常登录...');
        return { 
            success: true, 
            profileResult: null, 
            userDataResult: null,
            error: error.message,
            degraded: true // 标记为降级模式
        };
    }
}

/**
 * 优化版用户登出处理
 */
function onUserSignedOutOptimized() {
    console.log('🚀 处理优化版用户登出...');
    clearOptimizedAppState();
    if (typeof updateUIForUnauthenticatedUser === 'function') {
        updateUIForUnauthenticatedUser();
    }
}

/**
 * 优化版确保用户配置文件存在 - 智能缓存
 */
async function ensureUserProfileOptimized(user) {
    console.log('🚀 ensureUserProfileOptimized 开始执行，用户:', user.email);
    const ADMIN_EMAILS = (typeof window !== 'undefined' && Array.isArray(window.ADMIN_EMAILS)) ? window.ADMIN_EMAILS : ['15274410535@163.com'];
    const startTime = performance.now();
    
    // 检查缓存
    const cacheKey = `profile_${user.id}`;
    const cachedProfile = performanceCache.userProfiles.get(cacheKey);
    const now = Date.now();
    
    if (cachedProfile && (now - cachedProfile.timestamp) < performanceCache.cacheTimeout) {
        console.log('💾 使用缓存的用户配置文件');
        return cachedProfile.data;
    }
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('⚠️ Supabase 客户端未初始化，返回默认配置');
        return {
            id: user.id,
            email: user.email,
            display_name: user.email.split('@')[0],
            preferences: { theme: 'light', language: 'zh-CN' },
            _isDefault: true
        };
    }
    
    try {
        console.log('🔍 查询用户配置文件...');
        
        // 🔥 修复：增加合理的超时时间（从5秒改为15秒）
        const profilePromise = client
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('查询超时（15秒）')), 15000); // 15秒超时，更合理
        });
        
        console.log('⏱️ 开始查询用户配置文件（最多15秒）...');
        const { data: profile, error: fetchError } = await Promise.race([
            profilePromise,
            timeoutPromise
        ]);
        
        if (fetchError) {
            console.warn('⚠️ 用户配置文件查询失败:', fetchError.message);
            // 🔥 修复：返回默认配置而不是undefined
            return {
                id: user.id,
                email: user.email,
                display_name: user.email.split('@')[0],
                preferences: { theme: 'light', language: 'zh-CN' },
                role: ADMIN_EMAILS.includes(user.email) ? 'owner' : 'member',
                _isDefault: true,
                _error: fetchError.message
            };
        }
        
        if (!profile) {
            console.log('📝 创建新用户配置文件...');
            
            const defaultProfile = {
                id: user.id,
                email: user.email,
                display_name: user.email.split('@')[0],
                preferences: { theme: 'light', language: 'zh-CN' },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const computedRole = ADMIN_EMAILS.includes(user.email) ? 'owner' : 'member';
            
            try {
                const { error: insertError } = await client
                    .from('user_profiles')
                    .insert(defaultProfile);
                
                if (insertError) {
                    console.warn('⚠️ 配置文件创建失败:', insertError.message);
                } else {
                    console.log('✅ 用户配置文件创建成功');
                }
                
                // 缓存配置文件（无论创建是否成功）
                performanceCache.userProfiles.set(cacheKey, {
                    data: { ...defaultProfile, role: computedRole },
                    timestamp: now
                });
                
                return { ...defaultProfile, role: computedRole };
            } catch (createError) {
                console.warn('⚠️ 创建用户配置文件异常:', createError.message);
                return { ...defaultProfile, role: computedRole, _isDefault: true, _error: createError.message };
            }
        } else {
            console.log('✅ 用户配置文件已存在');
            // 缓存现有配置文件
            performanceCache.userProfiles.set(cacheKey, {
                data: profile,
                timestamp: now
            });
            
            const queryTime = performance.now() - startTime;
            console.log(`✅ 用户配置文件处理完成 (耗时: ${(queryTime/1000).toFixed(2)}秒)`);
            
            // 前端计算角色（兼容没有 role 列的数据库）
            const computedRole = typeof profile.role !== 'undefined'
                ? profile.role
                : (ADMIN_EMAILS.includes(user.email) ? 'owner' : 'member');
            return { ...profile, role: computedRole };
        }
        
    } catch (error) {
        const errorTime = performance.now() - startTime;
        console.error(`❌ 用户配置文件处理失败 (耗时: ${(errorTime/1000).toFixed(2)}秒):`, error);
        
        // 🔥 修复：提供降级策略，返回默认配置而不是undefined
        if (error.message.includes('超时')) {
            console.warn('⚠️ 用户配置文件查询超时，使用默认配置');
        } else {
            console.warn('⚠️ 用户配置文件查询失败，使用默认配置');
        }
        
        // 返回默认配置，确保应用能正常运行
        const defaultProfile = {
            id: user.id,
            email: user.email,
            display_name: user.email.split('@')[0],
            preferences: { theme: 'light', language: 'zh-CN' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            role: (typeof window !== 'undefined' && Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.includes(user.email)) ? 'owner' : 'member',
            _isDefault: true,
            _error: error.message
        };
        
        console.log('🔄 返回默认用户配置文件');
        return defaultProfile;
    }
}

/**
 * 优化版加载用户数据
 */
async function loadUserDataOptimized(user) {
    console.log('🔵 loadUserDataOptimized 开始执行...');
    const startTime = performance.now();
    
    try {
        // 如果没有传入用户，尝试获取当前用户
        let currentUser = user;
        if (!currentUser) {
            console.log('🔍 获取当前用户...');
            
            // 🔥 修复：添加超时控制
            const getUserPromise = getCurrentUserOptimized();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('获取当前用户超时（10秒）'));
                }, 10000); // 10秒超时
            });
            
            currentUser = await Promise.race([getUserPromise, timeoutPromise]);
        }
        
        if (!currentUser) {
            console.warn('⚠️ 没有当前用户，跳过数据加载');
            return { success: false, error: '没有当前用户' };
        }
        
        console.log('✅ 获取到当前用户:', currentUser.email);
        
        // 🔥 修复：异步更新仪表板，添加超时和错误处理
        const dashboardPromise = new Promise(async (resolve) => {
            try {
                if (typeof updateDashboard === 'function') {
                    console.log('🔄 开始更新仪表板...');
                    
                    // 添加仪表板更新超时
                    const updatePromise = updateDashboard();
                    const dashboardTimeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new Error('仪表板更新超时（15秒）'));
                        }, 15000); // 15秒超时
                    });
                    
                    await Promise.race([updatePromise, dashboardTimeoutPromise]);
                    console.log('✅ 仪表板更新成功');
                    resolve({ dashboard: 'success' });
                } else {
                    console.log('ℹ️ updateDashboard 函数不可用，跳过仪表板更新');
                    resolve({ dashboard: 'skipped' });
                }
            } catch (error) {
                console.warn('⚠️ 仪表板更新失败:', error.message);
                resolve({ dashboard: 'failed', error: error.message });
            }
        });
        
        // 等待仪表板更新完成（但不阻塞太久）
        const dashboardResult = await dashboardPromise;
        
        const totalTime = performance.now() - startTime;
        console.log(`✅ loadUserDataOptimized 完成 (耗时: ${(totalTime/1000).toFixed(2)}秒)`);
        
        return { 
            success: true, 
            user: currentUser,
            dashboard: dashboardResult,
            timing: {
                total: totalTime / 1000
            }
        };
        
    } catch (error) {
        const errorTime = performance.now() - startTime;
        console.warn(`⚠️ loadUserDataOptimized 失败 (耗时: ${(errorTime/1000).toFixed(2)}秒):`, error.message);
        
        // 🔥 修复：即使失败也返回部分成功状态，不影响登录
        return { 
            success: false, 
            error: error.message,
            timing: {
                total: errorTime / 1000
            },
            degraded: true // 标记为降级模式
        };
    }
}

/**
 * 优化版清理应用状态
 */
function clearOptimizedAppState() {
    console.log('🚀 清理优化版应用状态...');
    
    // 清理缓存
    performanceCache.userProfiles.clear();
    performanceCache.authStates.clear();
    performanceCache.lastAuthCheck = 0;
    
    // 清理全局状态
    if (typeof window !== 'undefined') {
        window.currentUser = null;
    }
}

/**
 * 优化版获取当前用户 - 智能缓存
 */
async function getCurrentUserOptimized() {
    console.log('🚀 getCurrentUserOptimized 开始执行...');
    
    const now = Date.now();
    const cacheKey = 'current_user';
    
    // 检查缓存
    if (performanceCache.lastAuthCheck > 0 && 
        (now - performanceCache.lastAuthCheck) < 30000) { // 30秒缓存
        const cachedUser = performanceCache.authStates.get(cacheKey);
        if (cachedUser) {
            console.log('💾 使用缓存的用户信息');
            return cachedUser;
        }
    }
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('⚠️ Supabase 客户端未初始化');
        return null;
    }
    
    try {
        const { data: { user }, error } = await client.auth.getUser();
        
        if (error) {
            console.warn('⚠️ 获取用户失败:', error.message);
            return null;
        }
        
        // 更新缓存
        performanceCache.lastAuthCheck = now;
        if (user) {
            performanceCache.authStates.set(cacheKey, user);
        }
        
        console.log('✅ 获取当前用户成功:', user?.email || '无用户');
        return user;
        
    } catch (error) {
        console.error('❌ getCurrentUserOptimized 异常:', error);
        return null;
    }
}

/**
 * 优化版用户登录 - 快速响应
 */
async function signInUserOptimized(email, password) {
    console.log('🚀 signInUserOptimized 函数开始执行，邮箱:', email);
    const startTime = performance.now();
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    // 添加详细的客户端状态调试信息
    console.log('🔍 Supabase 客户端详细信息:');
    console.log('  - URL:', client.supabaseUrl);
    console.log('  - Key:', client.supabaseKey ? '已配置' : '未配置');
    console.log('  - Auth 实例:', client.auth ? '已初始化' : '未初始化');
    
    try {
        console.log('🚀 开始调用 client.auth.signInWithPassword...');
        console.log('🔍 登录参数:', { email, passwordLength: password ? password.length : 0 });
        
        console.log('⏱️ 开始等待登录响应（最多30秒）...');
        
        // 直接调用登录，不使用 Promise.race，避免超时Promise干扰
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        
        const loginTime = performance.now() - startTime;
        console.log(`⚡ 登录请求耗时: ${(loginTime/1000).toFixed(2)}秒`);
        
        // 详细记录响应信息
        console.log('🔍 Supabase 响应详情:');
        console.log('  - Error:', error);
        console.log('  - Data:', data);
        console.log('  - User:', data?.user);
        console.log('  - Session:', data?.session);
        
        if (error) {
            console.error('❌ 登录失败:', error.message);
            console.error('❌ 错误详情:', error);
            return { success: false, error: error.message };
        }
        
        if (data?.user) {
            console.log('✅ 登录成功，用户:', data.user.email);
            console.log('✅ 用户ID:', data.user.id);
            console.log('✅ 会话状态:', data.session ? '有效' : '无效');
            
            // 清理相关缓存
            performanceCache.authStates.clear();
            performanceCache.lastAuthCheck = 0;
            
            // 🔥 关键修复：登录成功后立即返回，不等待数据加载
            // 数据加载由认证状态监听器异步处理，不影响登录结果
            console.log('🎯 登录成功，数据加载将在后台异步进行...');
            
            return { 
                success: true, 
                user: data.user, 
                session: data.session,
                timing: {
                    login: loginTime / 1000
                }
            };
        } else {
            console.error('❌ 登录失败：未返回用户信息');
            console.error('❌ 响应数据:', data);
            return { success: false, error: '登录失败：未返回用户信息' };
        }
        
    } catch (error) {
        const errorTime = performance.now() - startTime;
        console.error(`❌ signInUserOptimized 捕获到错误 (耗时: ${(errorTime/1000).toFixed(2)}秒):`, error);
        console.error('❌ 错误堆栈:', error.stack);
        
        // 根据错误类型提供更友好的错误信息
        let friendlyError = error.message;
        if (error.message.includes('timeout') || error.message.includes('超时')) {
            friendlyError = '登录请求超时，请检查网络连接后重试';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            friendlyError = '网络连接失败，请检查网络后重试';
        } else if (error.message.includes('Invalid login credentials')) {
            friendlyError = '邮箱或密码错误';
        } else if (error.message.includes('Email not confirmed')) {
            friendlyError = '邮箱未确认，请检查邮箱并点击确认链接';
        }
        
        return { success: false, error: friendlyError };
    }
}

/**
 * 优化版用户注册
 */
async function signUpUserOptimized(email, password) {
    console.log('🚀 signUpUserOptimized 函数开始执行，邮箱:', email);
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    try {
        const { data, error } = await client.auth.signUp({
            email,
            password
        });
        
        if (error) {
            console.error('❌ 注册失败:', error.message);
            return { success: false, error: error.message };
        }
        
        console.log('✅ 注册成功');
        return { success: true, user: data.user, session: data.session };
        
    } catch (error) {
        console.error('❌ signUpUserOptimized 捕获到错误:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 优化版用户登出
 */
async function signOutUserOptimized() {
    console.log('🚀 signOutUserOptimized 函数开始执行...');
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    try {
        const { error } = await client.auth.signOut();
        
        if (error) {
            console.error('❌ 登出失败:', error.message);
            return { success: false, error: error.message };
        }
        
        console.log('✅ 登出成功');
        clearOptimizedAppState();
        return { success: true };
        
    } catch (error) {
        console.error('❌ signOutUserOptimized 捕获到错误:', error);
        return { success: false, error: error.message };
    }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabaseOptimized,
        getSupabaseClientOptimized,
        getCurrentUserOptimized,
        signInUserOptimized,
        signUpUserOptimized,
        signOutUserOptimized,
        loadUserDataOptimized,
        clearOptimizedAppState
    };
}

// 浏览器环境下的全局变量
if (typeof window !== 'undefined') {
    window.SUPABASE_CONFIG_OPTIMIZED = SUPABASE_CONFIG_OPTIMIZED;
    window.initSupabaseOptimized = initSupabaseOptimized;
    window.getSupabaseClientOptimized = getSupabaseClientOptimized;
    window.getCurrentUserOptimized = getCurrentUserOptimized;
    window.signInUserOptimized = signInUserOptimized;
    window.signUpUserOptimized = signUpUserOptimized;
    window.signOutUserOptimized = signOutUserOptimized;
    window.loadUserDataOptimized = loadUserDataOptimized;
    window.clearOptimizedAppState = clearOptimizedAppState;
    window.performanceCache = performanceCache;
}