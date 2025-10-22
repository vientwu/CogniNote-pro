/**
 * CogniNote Pro 紧急修复脚本
 * 解决会话自动恢复、重复保存、UI初始化等关键问题
 */
(function() {
  console.log('🚨 应用紧急修复脚本...');

  // ===== 1. 清理过期会话 =====
  function cleanupExpiredSession() {
    console.log('🧹 检查并清理过期会话...');
    
    const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase.auth'));
    
    authKeys.forEach(authKey => {
      try {
        const authData = JSON.parse(localStorage.getItem(authKey));
        if (authData?.expires_at) {
          const expiresAt = authData.expires_at * 1000;
          const now = Date.now();
          
          if (expiresAt < now) {
            console.log('🧹 清理过期会话:', authKey);
            localStorage.removeItem(authKey);
          } else {
            console.log('✅ 会话有效，过期时间:', new Date(expiresAt));
          }
        }
      } catch (err) {
        console.error('清理会话失败:', err);
        // 如果解析失败，也清理掉
        localStorage.removeItem(authKey);
      }
    });
  }

  // ===== 2. 禁用有问题的功能（临时） =====
  window.EMERGENCY_FLAGS = {
    DISABLE_TASK_SAVE: true,
    DISABLE_AUTO_SYNC: true,
    SKIP_INITIAL_SESSION: true,
    ENABLE_SAVE_THROTTLE: true,
    DISABLE_SAVE_PROTECTION: false
  };

  console.log('⚠️ 紧急标志已设置:', window.EMERGENCY_FLAGS);

  // ===== 3. 增强的保存节流和防抖机制 =====
  window.saveThrottleMap = new Map();
  window.saveDebounceMap = new Map();
  window.savePendingMap = new Map();
  
  // 节流函数 - 限制调用频率
  function createThrottledSave(originalSaveFunc, delay = 2000) {
    return function throttledSave(...args) {
      const funcName = originalSaveFunc.name || 'unknown';
      const key = `${funcName}_${JSON.stringify(args[0]?.id || 'no-id')}`;
      const now = Date.now();
      const lastCall = window.saveThrottleMap.get(key);
      
      if (!lastCall || now - lastCall > delay) {
        window.saveThrottleMap.set(key, now);
        console.log(`✅ ${funcName} 执行保存 (节流通过)`);
        return originalSaveFunc.apply(this, args);
      } else {
        const remaining = delay - (now - lastCall);
        console.log(`🚫 ${funcName} 保存被节流限制，还需等待 ${remaining}ms`);
        return Promise.resolve({ success: true, throttled: true, remaining });
      }
    };
  }
  
  // 防抖函数 - 延迟执行，如果在延迟期间再次调用则重新计时
  function createDebouncedSave(originalSaveFunc, delay = 1500) {
    return function debouncedSave(...args) {
      const funcName = originalSaveFunc.name || 'unknown';
      const key = `${funcName}_${JSON.stringify(args[0]?.id || 'no-id')}`;
      
      // 清除之前的定时器
      if (window.saveDebounceMap.has(key)) {
        clearTimeout(window.saveDebounceMap.get(key));
      }
      
      // 设置新的定时器
      const timeoutId = setTimeout(async () => {
        try {
          console.log(`✅ ${funcName} 防抖执行保存`);
          const result = await originalSaveFunc.apply(this, args);
          window.saveDebounceMap.delete(key);
          return result;
        } catch (error) {
          console.error(`❌ ${funcName} 防抖保存失败:`, error);
          window.saveDebounceMap.delete(key);
          throw error;
        }
      }, delay);
      
      window.saveDebounceMap.set(key, timeoutId);
      console.log(`⏱️ ${funcName} 防抖延迟 ${delay}ms 执行`);
      
      return Promise.resolve({ success: true, debounced: true, delay });
    };
  }
  
  // 智能保存 - 结合节流和防抖，防止重复保存
  function createSmartSave(originalSaveFunc, options = {}) {
    const {
      throttleDelay = 2000,
      debounceDelay = 1000,
      maxPending = 3
    } = options;
    
    return function smartSave(...args) {
      const funcName = originalSaveFunc.name || 'unknown';
      const dataId = args[0]?.id || 'no-id';
      const key = `${funcName}_${dataId}`;
      
      // 检查是否有正在进行的保存
      if (window.savePendingMap.has(key)) {
        const pendingCount = window.savePendingMap.get(key);
        if (pendingCount >= maxPending) {
          console.warn(`⚠️ ${funcName} 保存队列已满 (${pendingCount}/${maxPending})，跳过`);
          return Promise.resolve({ success: true, skipped: true, reason: 'queue_full' });
        }
        window.savePendingMap.set(key, pendingCount + 1);
      } else {
        window.savePendingMap.set(key, 1);
      }
      
      // 节流检查
      const now = Date.now();
      const lastCall = window.saveThrottleMap.get(key);
      if (lastCall && now - lastCall < throttleDelay) {
        const remaining = throttleDelay - (now - lastCall);
        console.log(`🚫 ${funcName} 节流限制，还需等待 ${remaining}ms`);
        window.savePendingMap.delete(key);
        return Promise.resolve({ success: true, throttled: true, remaining });
      }
      
      // 防抖处理
      if (window.saveDebounceMap.has(key)) {
        clearTimeout(window.saveDebounceMap.get(key));
      }
      
      const timeoutId = setTimeout(async () => {
        try {
          window.saveThrottleMap.set(key, Date.now());
          console.log(`✅ ${funcName} 智能保存执行 (ID: ${dataId})`);
          
          const result = await originalSaveFunc.apply(this, args);
          
          // 清理
          window.saveDebounceMap.delete(key);
          window.savePendingMap.delete(key);
          
          return result;
        } catch (error) {
          console.error(`❌ ${funcName} 智能保存失败:`, error);
          window.saveDebounceMap.delete(key);
          window.savePendingMap.delete(key);
          throw error;
        }
      }, debounceDelay);
      
      window.saveDebounceMap.set(key, timeoutId);
      console.log(`⏱️ ${funcName} 智能保存延迟 ${debounceDelay}ms (ID: ${dataId})`);
      
      return Promise.resolve({ success: true, debounced: true, delay: debounceDelay });
    };
  }
  
  // 兼容旧版本的 throttleSave 函数
  window.throttleSave = function(key, func, delay = 2000) {
    if (window.saveDebounceMap.has(key)) {
      clearTimeout(window.saveDebounceMap.get(key));
      console.log('⏭️ 取消之前的保存:', key);
    }
    
    const timeoutId = setTimeout(() => {
      console.log('💾 执行节流保存:', key);
      try {
        func();
      } catch (err) {
        console.error('节流保存失败:', key, err);
      }
      window.saveDebounceMap.delete(key);
    }, delay);
    
    window.saveDebounceMap.set(key, timeoutId);
    console.log('⏱️ 设置保存节流:', key, delay + 'ms');
  };

  // ===== 4. 修复 initializeNotesPage =====
  const originalInit = window.initializeNotesPage;
  if (originalInit) {
    window.initializeNotesPage = function() {
      console.log('🔧 安全初始化笔记页面...');
      
      try {
        // 检查所有必需元素
        const requiredElements = {
          notesList: 'notesList',
          notesContainer: 'notesContainer', 
          editorContainer: 'editorContainer',
          noteEditor: 'noteEditor'
        };
        
        const missing = [];
        const elements = {};
        
        Object.entries(requiredElements).forEach(([key, id]) => {
          const element = document.getElementById(id);
          if (!element) {
            missing.push(id);
          } else {
            elements[key] = element;
          }
        });
        
        if (missing.length > 0) {
          console.error('❌ 缺少必需元素:', missing);
          console.log('⏭️ 跳过笔记页面初始化');
          return;
        }
        
        console.log('✅ 所有必需元素已找到，继续初始化');
        
        // 调用原函数
        return originalInit.apply(this, arguments);
        
      } catch (err) {
        console.error('❌ initializeNotesPage 失败:', err);
        console.log('⏭️ 使用降级模式');
        
        // 降级模式：只做最基本的显示
        const notesList = document.getElementById('all-notes-grid');
        const editorContainer = document.getElementById('editorContainer');
        
        if (notesList) notesList.style.display = 'block';
        if (editorContainer) editorContainer.style.display = 'none';
      }
    };
    
    console.log('🔧 已修复 initializeNotesPage 函数');
  }

  // ===== 5. 修复认证状态监听器 =====
  const originalOnAuthStateChange = window.setupOptimizedAuthListener;
  if (originalOnAuthStateChange) {
    window.setupOptimizedAuthListener = function() {
      console.log('🔧 设置修复版认证监听器...');
      
      if (!window.supabaseClientOptimized) {
        console.error('❌ Supabase 客户端未初始化');
        return;
      }
      
      const { data: { subscription } } = window.supabaseClientOptimized.auth.onAuthStateChange((event, session) => {
        console.log('🚀 认证状态变化:', event, session?.user?.email);
        
        // ✅ 跳过自动会话恢复
        if (event === 'INITIAL_SESSION' && window.EMERGENCY_FLAGS.SKIP_INITIAL_SESSION) {
          console.log('⏭️ 跳过初始会话恢复（紧急修复）');
          return;
        }
        
        // 只处理真实的登录和登出事件
        if (event === 'SIGNED_IN' && session) {
          console.log('✅ 处理真实登录事件');
          if (window.onUserSignedInOptimized) {
            window.onUserSignedInOptimized(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('✅ 处理登出事件');
          if (window.onUserSignedOut) {
            window.onUserSignedOut();
          }
        }
      });
      
      console.log('✅ 修复版认证监听器已设置');
      return subscription;
    };
  }

  // ===== 6. 修复数据库保存函数 =====
  
  // 修复任务保存
  const originalSaveProjectTasks = window.saveProjectTasks;
  if (originalSaveProjectTasks) {
    window.saveProjectTasks = function(projectId, tasks, userId) {
      if (window.EMERGENCY_FLAGS.DISABLE_TASK_SAVE) {
        console.log('⏸️ 任务保存已临时禁用（紧急修复）');
        return Promise.resolve();
      }
      
      // 状态值映射
      const statusMapping = {
        'pending': 'todo',
        'progress': 'in_progress', 
        'in-progress': 'in_progress',
        'done': 'completed',
        'completed': 'completed',
        'cancelled': 'cancelled'
      };
      
      // 修复任务数据
      const fixedTasks = tasks.map(task => ({
        ...task,
        status: statusMapping[task.status] || 'todo'
      }));
      
      console.log('🔧 使用修复版任务保存，状态已映射');
      return originalSaveProjectTasks.call(this, projectId, fixedTasks, userId);
    };
  }
  
  // 应用智能保存机制到数据库保存函数
  window.applySmartSaveToFunctions = function() {
    // 包装 saveProjectToDatabase
    if (window.saveProjectToDatabase && !window.saveProjectToDatabase._smartWrapped) {
      const originalSaveProject = window.saveProjectToDatabase;
      window.saveProjectToDatabase = createSmartSave(originalSaveProject, {
        throttleDelay: 3000,  // 项目保存节流3秒
        debounceDelay: 1500,  // 防抖1.5秒
        maxPending: 2         // 最多2个待处理
      });
      window.saveProjectToDatabase._smartWrapped = true;
      console.log('✅ saveProjectToDatabase 已应用智能保存保护');
    }
    
    // 包装 saveNoteToDatabase
    if (window.saveNoteToDatabase && !window.saveNoteToDatabase._smartWrapped) {
      const originalSaveNote = window.saveNoteToDatabase;
      window.saveNoteToDatabase = createSmartSave(originalSaveNote, {
        throttleDelay: 2000,  // 笔记保存节流2秒
        debounceDelay: 1000,  // 防抖1秒
        maxPending: 3         // 最多3个待处理
      });
      window.saveNoteToDatabase._smartWrapped = true;
      console.log('✅ saveNoteToDatabase 已应用智能保存保护');
    }
    
    // 包装其他可能的保存函数
    ['saveTaskToDatabase', 'saveTagToDatabase', 'saveUserPreferences'].forEach(funcName => {
      if (window[funcName] && !window[funcName]._smartWrapped) {
        const originalFunc = window[funcName];
        window[funcName] = createSmartSave(originalFunc, {
          throttleDelay: 1500,
          debounceDelay: 800,
          maxPending: 2
        });
        window[funcName]._smartWrapped = true;
        console.log(`✅ ${funcName} 已应用智能保存保护`);
      }
    });
  };
  
  // 立即应用智能保存
  window.applySmartSaveToFunctions();
  
  // 定期检查并应用（防止函数被重新定义）
  setInterval(() => {
    if (!window.EMERGENCY_FLAGS.DISABLE_SAVE_PROTECTION) {
      window.applySmartSaveToFunctions();
    }
  }, 5000);
  
  // 修复标签查询
  const originalGetOrCreateTags = window.getOrCreateTags;
  if (originalGetOrCreateTags) {
    window.getOrCreateTags = async function(tagNames, userId) {
      if (!tagNames || tagNames.length === 0) return [];
      
      console.log('🔧 使用修复版标签查询');
      const tagIds = [];
      
      for (const tagName of tagNames) {
        try {
          // 先尝试查询单个标签
          const { data: existing, error: queryError } = await window.supabaseClientOptimized
            .from('tags')
            .select('id, name')
            .eq('user_id', userId)
            .eq('name', tagName)
            .maybeSingle(); // 使用 maybeSingle 避免 406 错误
          
          if (existing) {
            tagIds.push(existing.id);
            continue;
          }
          
          // 不存在则创建
          const { data: newTag, error: insertError } = await window.supabaseClientOptimized
            .from('tags')
            .insert({ 
              user_id: userId, 
              name: tagName, 
              color: '#6366F1' 
            })
            .select('id')
            .single();
          
          if (newTag) {
            tagIds.push(newTag.id);
          }
          
        } catch (err) {
          console.error('标签处理失败:', tagName, err);
          
          // 处理重复插入错误
          if (err.code === '23505') {
            try {
              const { data } = await window.supabaseClientOptimized
                .from('tags')
                .select('id')
                .eq('user_id', userId)
                .eq('name', tagName)
                .single();
              
              if (data) tagIds.push(data.id);
            } catch (retryErr) {
              console.error('重试查询标签失败:', retryErr);
            }
          }
        }
      }
      
      return tagIds;
    };
  }

  // ===== 7. 修复同步函数 =====
  let lastSyncTime = 0;
  const SYNC_THROTTLE = 3000; // 3秒节流
  
  const originalSyncAppState = window.syncAppStateToDatabase;
  if (originalSyncAppState) {
    window.syncAppStateToDatabase = function() {
      if (window.EMERGENCY_FLAGS.DISABLE_AUTO_SYNC) {
        console.log('⏸️ 自动同步已临时禁用（紧急修复）');
        return Promise.resolve();
      }
      
      // 节流控制
      const now = Date.now();
      if (now - lastSyncTime < SYNC_THROTTLE) {
        console.log('⏭️ 同步过于频繁，跳过（节流）');
        return Promise.resolve();
      }
      lastSyncTime = now;
      
      console.log('🔧 执行节流同步');
      return originalSyncAppState.apply(this, arguments);
    };
  }

  // ===== 8. 执行初始清理 =====
  cleanupExpiredSession();

  // ===== 9. 添加全局错误处理 =====
  window.addEventListener('error', function(event) {
    console.error('🚨 全局错误捕获:', event.error);
    
    // 如果是认证相关错误，清理状态
    if (event.error?.message?.includes('auth') || 
        event.error?.message?.includes('session')) {
      console.log('🧹 检测到认证错误，清理状态');
      cleanupExpiredSession();
    }
  });

  // ===== 10. 添加调试工具 =====
  window.emergencyDebug = {
    cleanupSession: cleanupExpiredSession,
    checkFlags: () => window.EMERGENCY_FLAGS,
    clearThrottle: () => { saveThrottle = {}; },
    getThrottleStatus: () => Object.keys(saveThrottle)
  };

  console.log('✅ 紧急修复脚本已完全加载');
  console.log('🛠️ 调试工具可用: window.emergencyDebug');
  
})();