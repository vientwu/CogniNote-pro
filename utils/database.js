/**
 * 数据库操作 API
 * 提供笔记、项目、标签等数据的 CRUD 操作
 */

// ==================== 笔记相关操作 ====================

/**
 * 从数据库加载笔记
 */
async function loadNotesFromDatabase() {
    console.log('=== 开始从数据库加载笔记 ===');
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    const user = await getCurrentUserOptimized();
    if (!user) {
        console.warn('⚠️ 用户未登录，无法加载笔记');
        return { success: false, error: '用户未登录' };
    }
    
    console.log('当前用户:', user.id);
    
    try {
        console.log('查询笔记数据...');
        const { data: notes, error } = await client
            .from('notes_with_tags')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ 查询笔记失败:', error);
            return { success: false, error: error.message };
        }
        
        console.log('查询到的原始笔记数据:', notes);
        
        // 转换数据格式以匹配现有的 AppState 结构
        const transformedNotes = (notes || []).map(note => ({
            id: note.id,
            title: note.title || '无标题',
            content: note.content || '',
            createdAt: note.created_at,
            updatedAt: note.updated_at,
            isFavorite: note.is_favorite || false,
            tags: Array.isArray(note.tags) ? note.tags.map(tag => tag.name) : [],
            projectId: note.project_id
        }));
        
        if (typeof AppState !== 'undefined') {
            AppState.notes = transformedNotes;
            console.log(`✅ 成功加载 ${transformedNotes.length} 条笔记到 AppState`);
            console.log('AppState.notes:', AppState.notes);
        } else {
            console.warn('⚠️ AppState 未定义，无法保存笔记数据');
        }
        
        // 更新 UI
        if (typeof updateNotesTabCounts === 'function') {
            updateNotesTabCounts();
            console.log('✅ 笔记标签计数已更新');
        }
        
        console.log(`✅ 笔记加载成功，共 ${transformedNotes.length} 条`);
        return { success: true, data: transformedNotes };
        
    } catch (error) {
        console.error('❌ 加载笔记失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 保存笔记到数据库
 * @param {Object} note - 笔记对象
 * @returns {Object} 保存结果
 */
async function saveNoteToDatabase(note) {
    console.log('=== 开始保存笔记到数据库 ===');
    console.log('笔记数据:', note);
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    const user = await getCurrentUserOptimized();
    if (!user) {
        console.error('❌ 用户未登录');
        return { success: false, error: '用户未登录' };
    }
    
    console.log('当前用户:', user.id);
    
    try {
        const noteData = {
            title: note.title || '无标题',
            content: note.content || '',
            is_favorite: note.isFavorite || false,
            project_id: note.projectId || null,
            user_id: user.id
        };
        
        console.log('准备保存的笔记数据:', noteData);
        
        let result;
        
        if (!note.id || note.id.startsWith('note-temp-') || note.id.startsWith('note-')) {
            // 新笔记，插入数据库
            console.log('插入新笔记...');
            const { data, error } = await client
                .from('notes')
                .insert(noteData)
                .select()
                .single();
            
            if (error) {
                console.error('❌ 插入笔记失败:', error);
                throw error;
            }
            
            result = data;
            console.log('✅ 新笔记插入成功:', result);
            
            // 更新本地 AppState 中的 ID
            if (typeof AppState !== 'undefined' && AppState.notes) {
                const localNote = AppState.notes.find(n => n.id === note.id);
                if (localNote) {
                    localNote.id = result.id;
                    console.log('✅ 本地笔记ID已更新:', result.id);
                }
            }
            
        } else {
            // 现有笔记，更新数据库
            console.log('更新现有笔记:', note.id);
            const { data, error } = await client
                .from('notes')
                .update(noteData)
                .eq('id', note.id)
                .select()
                .single();
            
            if (error) {
                console.error('❌ 更新笔记失败:', error);
                throw error;
            }
            
            result = data;
            console.log('✅ 笔记更新成功:', result);
        }
        
        // 处理标签
        if (note.tags && note.tags.length > 0) {
            console.log('保存笔记标签:', note.tags);
            try {
                await saveNoteTags(result.id, note.tags, user.id);
                console.log('✅ 笔记标签保存成功');
            } catch (tagError) {
                console.error('❌ 保存笔记标签失败:', tagError);
                // 标签保存失败不影响笔记保存
            }
        }
        
        console.log('✅ 笔记保存完成:', result.id);
        return { success: true, data: result };
        
    } catch (error) {
        console.error('❌ 保存笔记失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 删除笔记
 * @param {string} noteId - 笔记ID
 * @returns {Object} 删除结果
 */
async function deleteNoteFromDatabase(noteId) {
    const client = getSupabaseClientOptimized();
    if (!client) return { success: false, error: 'Supabase 客户端未初始化' };
    
    try {
        const { error } = await client
            .from('notes')
            .delete()
            .eq('id', noteId);
        
        if (error) throw error;
        
        console.log('笔记删除成功:', noteId);
        return { success: true };
        
    } catch (error) {
        console.error('删除笔记失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 保存笔记标签
 * @param {string} noteId - 笔记ID
 * @param {Array} tagNames - 标签名称数组
 * @param {string} userId - 用户ID
 */
async function saveNoteTags(noteId, tagNames, userId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        // 删除现有标签关联
        const { error: deleteError } = await client
            .from('note_tags')
            .delete()
            .eq('note_id', noteId);
        
        if (deleteError) {
            console.error('删除现有标签关联失败:', deleteError);
            throw deleteError;
        }
        
        if (tagNames.length === 0) return;
        
        // 获取或创建标签
        const tagIds = await getOrCreateTags(tagNames, userId);
        
        // 检查已存在的标签关联
        const { data: existingTags } = await client
            .from('note_tags')
            .select('tag_id')
            .eq('note_id', noteId);
        
        const existingTagIds = existingTags ? existingTags.map(t => t.tag_id) : [];
        
        // 只插入不存在的标签关联
        const newTagIds = tagIds.filter(tagId => !existingTagIds.includes(tagId));
        
        if (newTagIds.length > 0) {
            const noteTagData = newTagIds.map(tagId => ({
                note_id: noteId,
                tag_id: tagId
            }));
            
            const { error } = await client
                .from('note_tags')
                .insert(noteTagData)
                .select();
                
            if (error) throw error;
        }
        
    } catch (error) {
        console.error('保存笔记标签失败:', error);
        throw error;
    }
}

// ==================== 项目相关操作 ====================

/**
 * 从数据库加载项目
 */
async function loadProjectsFromDatabase() {
    console.log('=== 开始从数据库加载项目 ===');
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    const user = await getCurrentUserOptimized();
    if (!user) {
        console.warn('⚠️ 用户未登录，无法加载项目');
        return;
    }
    
    console.log('当前用户:', user.id);
    
    try {
        console.log('查询项目数据...');
        const { data: projects, error } = await client
            .from('projects_with_tags')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ 查询项目失败:', error);
            throw error;
        }
        
        console.log('查询到的原始项目数据:', projects);
        
        // 转换数据格式以匹配现有的 AppState 结构
        if (typeof AppState !== 'undefined') {
            AppState.projects = (projects || []).map(project => ({
                id: project.id,
                name: project.name || '无标题项目',
                description: project.description || '',
                status: project.status || 'active',
                progress: project.progress || 0,
                deadline: project.deadline,
                createdAt: project.created_at,
                updatedAt: project.updated_at,
                tags: Array.isArray(project.tags) ? project.tags.map(tag => tag.name) : [],
                members: [], // 需要单独加载成员信息
                tasks: [] // 需要单独加载任务信息
            }));
            
            console.log(`✅ 成功加载 ${projects?.length || 0} 个项目到 AppState`);
            console.log('AppState.projects:', AppState.projects);
            
            // 加载项目的任务和成员信息
            for (const project of AppState.projects) {
                try {
                    console.log(`加载项目 ${project.id} 的任务和成员...`);
                    await loadProjectTasks(project.id);
                    await loadProjectMembers(project.id);
                    console.log(`✅ 项目 ${project.id} 的任务和成员加载完成`);
                } catch (taskError) {
                    console.error(`❌ 加载项目 ${project.id} 的任务和成员失败:`, taskError);
                    // 继续加载其他项目
                }
            }
        } else {
            console.warn('⚠️ AppState 未定义，无法保存项目数据');
        }
        
        // 更新 UI
        if (typeof updateProjectTabCounts === 'function') {
            updateProjectTabCounts(AppState.projects);
            console.log('✅ 项目标签计数已更新');
        }
        
    } catch (error) {
        console.error('❌ 加载项目失败:', error);
        throw error;
    }
}

/**
 * 保存项目到数据库
 * @param {Object} project - 项目对象
 * @returns {Object} 保存结果
 */
async function saveProjectToDatabase(project) {
    console.log('=== 开始保存项目到数据库 ===');
    console.log('项目数据:', project);
    
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.error('❌ Supabase 客户端未初始化');
        return { success: false, error: 'Supabase 客户端未初始化' };
    }
    
    const user = await getCurrentUserOptimized();
    if (!user) {
        console.error('❌ 用户未登录');
        return { success: false, error: '用户未登录' };
    }
    
    console.log('当前用户:', user.id);
    
    try {
        // 验证和修复状态值
        const validStatuses = ['active', 'completed', 'paused', 'cancelled'];
        let status = project.status || 'active';
        if (!validStatuses.includes(status)) {
            console.warn(`⚠️ 无效的项目状态值: ${status}，使用默认值 'active'`);
            status = 'active';
        }
        
        const projectData = {
            title: project.title || project.name || '无标题项目', // 修复字段映射：使用title字段
            description: project.description || '',
            status: status,
            progress: Math.max(0, Math.min(100, project.progress || 0)), // 确保进度在0-100之间
            deadline: project.deadline || null,
            user_id: user.id
        };
        
        console.log('准备保存的项目数据:', projectData);
        
        let result;
        
        if (!project.id || project.id.startsWith('project-temp-') || project.id.startsWith('project-')) {
            // 新项目，插入数据库
            console.log('插入新项目...');
            const { data, error } = await client
                .from('projects')
                .insert(projectData)
                .select()
                .single();
            
            if (error) {
                console.error('❌ 插入项目失败:', error);
                throw error;
            }
            
            result = data;
            console.log('✅ 新项目插入成功:', result);
            
            // 更新本地 AppState 中的 ID
            if (typeof AppState !== 'undefined' && AppState.projects) {
                const localProject = AppState.projects.find(p => p.id === project.id);
                if (localProject) {
                    localProject.id = result.id;
                    console.log('✅ 本地项目ID已更新:', result.id);
                }
            }
            
        } else {
            // 现有项目，更新数据库
            console.log('更新现有项目:', project.id);
            const { data, error } = await client
                .from('projects')
                .update(projectData)
                .eq('id', project.id)
                .select()
                .single();
            
            if (error) {
                console.error('❌ 更新项目失败:', error);
                throw error;
            }
            
            result = data;
            console.log('✅ 项目更新成功:', result);
        }
        
        // 处理标签
        if (project.tags && project.tags.length > 0) {
            console.log('保存项目标签:', project.tags);
            try {
                await saveProjectTags(result.id, project.tags, user.id);
                console.log('✅ 项目标签保存成功');
            } catch (tagError) {
                console.error('❌ 保存项目标签失败:', tagError);
                // 标签保存失败不影响项目保存
            }
        }
        
        // 处理任务
        if (project.tasks && project.tasks.length > 0) {
            console.log('保存项目任务:', project.tasks.length, '个任务');
            try {
                await saveProjectTasks(result.id, project.tasks, user.id);
                console.log('✅ 项目任务保存成功');
            } catch (taskError) {
                console.error('❌ 保存项目任务失败:', taskError);
                // 任务保存失败不影响项目保存
            }
        }
        
        console.log('✅ 项目保存完成:', result.id);
        return { success: true, data: result };
        
    } catch (error) {
        console.error('❌ 保存项目失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 删除项目
 * @param {string} projectId - 项目ID
 * @returns {Object} 删除结果
 */
async function deleteProjectFromDatabase(projectId) {
    const client = getSupabaseClientOptimized();
    if (!client) return { success: false, error: 'Supabase 客户端未初始化' };
    
    try {
        const { error } = await client
            .from('projects')
            .delete()
            .eq('id', projectId);
        
        if (error) throw error;
        
        console.log('项目删除成功:', projectId);
        return { success: true };
        
    } catch (error) {
        console.error('删除项目失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 保存项目标签
 * @param {string} projectId - 项目ID
 * @param {Array} tagNames - 标签名称数组
 * @param {string} userId - 用户ID
 */
async function saveProjectTags(projectId, tagNames, userId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        // 删除现有标签关联
        const { error: deleteError } = await client
            .from('project_tags')
            .delete()
            .eq('project_id', projectId);
        
        if (deleteError) {
            console.error('删除现有项目标签关联失败:', deleteError);
            throw deleteError;
        }
        
        if (tagNames.length === 0) return;
        
        // 获取或创建标签
        const tagIds = await getOrCreateTags(tagNames, userId);
        
        // 创建新的标签关联，使用upsert避免重复键冲突
        const projectTagData = tagIds.map(tagId => ({
            project_id: projectId,
            tag_id: tagId
        }));
        
        // 使用upsert操作，如果存在则忽略
        const { error } = await client
            .from('project_tags')
            .upsert(projectTagData, { 
                onConflict: 'project_id,tag_id',
                ignoreDuplicates: true 
            });
        
        if (error) throw error;
        
    } catch (error) {
        console.error('保存项目标签失败:', error);
        throw error;
    }
}

/**
 * 加载项目任务
 * @param {string} projectId - 项目ID
 */
async function loadProjectTasks(projectId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        const { data: tasks, error } = await client
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // 更新项目的任务列表
        const project = AppState.projects.find(p => p.id === projectId);
        if (project) {
            project.tasks = tasks.map(task => ({
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                assigneeId: task.assignee_id,
                dueDate: task.due_date,
                createdAt: task.created_at,
                updatedAt: task.updated_at
            }));
        }
        
    } catch (error) {
        console.error('加载项目任务失败:', error);
    }
}

/**
 * 保存项目任务
 * @param {string} projectId - 项目ID
 * @param {Array} tasks - 任务数组
 * @param {string} userId - 用户ID
 */
async function saveProjectTasks(projectId, tasks, userId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        // 删除现有任务
        await client
            .from('tasks')
            .delete()
            .eq('project_id', projectId);
        
        if (tasks.length === 0) return;
        
        // 插入新任务
        const validTaskStatuses = ['todo', 'in_progress', 'completed', 'cancelled'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        
        const taskData = tasks.map(task => {
            // 验证任务状态
            let taskStatus = task.status || 'todo';
            if (!validTaskStatuses.includes(taskStatus)) {
                console.warn(`⚠️ 无效的任务状态值: ${taskStatus}，使用默认值 'todo'`);
                taskStatus = 'todo';
            }
            
            // 验证优先级
            let priority = task.priority || 'medium';
            if (!validPriorities.includes(priority)) {
                console.warn(`⚠️ 无效的任务优先级: ${priority}，使用默认值 'medium'`);
                priority = 'medium';
            }
            
            return {
                project_id: projectId,
                user_id: userId,
                title: task.title || '无标题任务',
                description: task.description || '',
                status: taskStatus,
                priority: priority,
                assignee_id: task.assigneeId || userId,
                due_date: task.dueDate
            };
        });
        
        const { error } = await client
            .from('tasks')
            .insert(taskData);
        
        if (error) throw error;
        
    } catch (error) {
        console.error('保存项目任务失败:', error);
        throw error;
    }
}

/**
 * 加载项目成员
 * @param {string} projectId - 项目ID
 */
async function loadProjectMembers(projectId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        const { data: members, error } = await client
            .from('project_members')
            .select(`
                *,
                user_profiles(display_name, email)
            `)
            .eq('project_id', projectId);
        
        if (error) throw error;
        
        // 更新项目的成员列表
        const project = AppState.projects.find(p => p.id === projectId);
        if (project) {
            project.members = members.map(member => 
                member.user_profiles?.display_name || member.user_profiles?.email || 'Unknown User'
            );
        }
        
    } catch (error) {
        console.error('加载项目成员失败:', error);
    }
}

// ==================== 标签相关操作 ====================

/**
 * 从数据库加载标签
 */
async function loadTagsFromDatabase() {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    const user = await getCurrentUserOptimized();
    if (!user) {
        console.warn('用户未登录，无法加载标签');
        return;
    }
    
    try {
        const { data: tags, error } = await client
            .from('tags')
            .select('*')
            .eq('user_id', user.id)
            .order('name');
        
        if (error) throw error;
        
        // 存储标签到全局变量（如果需要）
        window.userTags = tags;
        
        console.log(`加载了 ${tags.length} 个标签`);
        
    } catch (error) {
        console.error('加载标签失败:', error);
        throw error;
    }
}

/**
 * 获取或创建标签
 * @param {Array} tagNames - 标签名称数组
 * @param {string} userId - 用户ID
 * @returns {Array} 标签ID数组
 */
async function getOrCreateTags(tagNames, userId) {
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('⚠️ Supabase 客户端未初始化');
        return [];
    }
    
    // 输入验证
    if (!Array.isArray(tagNames) || tagNames.length === 0) {
        console.warn('⚠️ 标签名称数组为空或无效');
        return [];
    }
    
    if (!userId) {
        console.warn('⚠️ 用户ID无效');
        return [];
    }
    
    try {
        const tagIds = [];
        
        // 过滤和清理标签名称
        const validTagNames = tagNames
            .filter(name => name && typeof name === 'string' && name.trim().length > 0)
            .map(name => name.trim().substring(0, 50)); // 限制长度
        
        if (validTagNames.length === 0) {
            console.warn('⚠️ 没有有效的标签名称');
            return [];
        }
        
        for (const tagName of validTagNames) {
            try {
                // 检查标签是否存在
                let { data: existingTag, error: fetchError } = await client
                    .from('tags')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('name', tagName)
                    .maybeSingle(); // 使用 maybeSingle 而不是 single
                
                if (fetchError) {
                    console.error(`❌ 查询标签失败 (${tagName}):`, fetchError);
                    continue; // 跳过这个标签，继续处理其他标签
                }
                
                if (existingTag) {
                    tagIds.push(existingTag.id);
                } else {
                    // 创建新标签
                    const { data: newTag, error: insertError } = await client
                        .from('tags')
                        .insert({
                            user_id: userId,
                            name: tagName,
                            color: getRandomTagColor()
                        })
                        .select('id')
                        .single();
                    
                    if (insertError) {
                        console.error(`❌ 创建标签失败 (${tagName}):`, insertError);
                        continue; // 跳过这个标签，继续处理其他标签
                    }
                    
                    if (newTag) {
                        tagIds.push(newTag.id);
                    }
                }
            } catch (tagError) {
                console.error(`❌ 处理标签失败 (${tagName}):`, tagError);
                // 继续处理其他标签
            }
        }
        
        return tagIds;
        
    } catch (error) {
        console.error('❌ 获取或创建标签失败:', error);
        return []; // 返回空数组而不是抛出错误
    }
}

/**
 * 获取随机标签颜色
 * @returns {string} 颜色值
 */
function getRandomTagColor() {
    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
        '#f59e0b', '#10b981', '#06b6d4', '#84cc16'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ==================== 统计相关操作 ====================

/**
 * 获取用户统计信息
 * @returns {Object} 统计信息
 */
async function getUserStats() {
    const client = getSupabaseClientOptimized();
    if (!client) return null;
    
    const user = await getCurrentUserOptimized();
    if (!user) return null;
    
    try {
        const { data, error } = await client
            .rpc('get_user_stats', { user_uuid: user.id });
        
        if (error) throw error;
        
        return data;
        
    } catch (error) {
        console.error('获取用户统计失败:', error);
        return null;
    }
}

// ==================== 数据同步相关操作 ====================

/**
 * 将当前应用状态同步到数据库
 */
async function syncAppStateToDatabase() {
    const client = getSupabaseClientOptimized();
    if (!client) {
        console.warn('Supabase 客户端未初始化，无法同步数据');
        return;
    }
    
    const user = await getCurrentUserOptimized();
    if (!user) {
        console.warn('用户未登录，无法同步数据');
        return;
    }
    
    try {
        console.log('开始同步应用状态到数据库...');

        // 1) 先将整个 AppState 作为快照写入 user_states（便于离线/快速恢复）
        const stateSnapshot = {
            notes: Array.isArray(AppState?.notes) ? AppState.notes : [],
            projects: Array.isArray(AppState?.projects) ? AppState.projects : [],
            tags: Array.isArray(AppState?.tags) ? AppState.tags : []
        };
        const { error: stateError } = await client
            .from('user_states')
            .upsert({
                user_id: user.id,
                state: stateSnapshot,
                version: 'v1',
                client_updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        if (stateError) {
            console.warn('写入 user_states 失败（不会阻止逐条同步）:', stateError.message);
        } else {
            console.log('✅ user_states 快照已写入');
        }
        
        // 2) 逐条同步笔记
        for (const note of AppState.notes) {
            await saveNoteToDatabase(note);
        }
        
        // 3) 逐条同步项目
        for (const project of AppState.projects) {
            await saveProjectToDatabase(project);
        }
        
        console.log('应用状态同步完成');
        
    } catch (error) {
        console.error('应用状态同步失败:', error);
        throw error;
    }
}

/**
 * 同步本地数据到数据库
 */
async function syncLocalDataToDatabase() {
    console.log('开始同步本地数据到数据库...');
    
    try {
        // 同步笔记
        for (const note of AppState.notes) {
            await saveNoteToDatabase(note);
        }
        
        // 同步项目
        for (const project of AppState.projects) {
            await saveProjectToDatabase(project);
        }
        
        console.log('本地数据同步完成');
        showNotification('数据同步成功', 'success');
        
    } catch (error) {
        console.error('数据同步失败:', error);
        showNotification('数据同步失败: ' + error.message, 'error');
    }
}

/**
 * 设置实时数据监听
 */
function setupRealtimeListeners() {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    // 监听笔记变化
    client
        .channel('notes_changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'notes' },
            (payload) => {
                console.log('笔记数据变化:', payload);
                // 根据需要更新本地状态
                handleNoteChange(payload);
            }
        )
        .subscribe();
    
    // 监听项目变化
    client
        .channel('projects_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'projects' },
            (payload) => {
                console.log('项目数据变化:', payload);
                // 根据需要更新本地状态
                handleProjectChange(payload);
            }
        )
        .subscribe();
}

/**
 * 处理笔记变化
 * @param {Object} payload - 变化数据
 */
function handleNoteChange(payload) {
    console.log('处理笔记变化:', payload);
    
    if (!window.AppState) return;
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            // 新增笔记
            if (newRecord && !AppState.notes.find(n => n.id === newRecord.id)) {
                const note = {
                    id: newRecord.id,
                    title: newRecord.title,
                    content: newRecord.content,
                    tags: [], // 标签需要单独加载
                    createdAt: newRecord.created_at,
                    updatedAt: newRecord.updated_at,
                    projectId: newRecord.project_id
                };
                AppState.notes.unshift(note);
                
                // 更新UI
                if (typeof updateNotesDisplay === 'function') {
                    updateNotesDisplay();
                }
            }
            break;
            
        case 'UPDATE':
            // 更新笔记
            if (newRecord) {
                const noteIndex = AppState.notes.findIndex(n => n.id === newRecord.id);
                if (noteIndex !== -1) {
                    AppState.notes[noteIndex] = {
                        ...AppState.notes[noteIndex],
                        title: newRecord.title,
                        content: newRecord.content,
                        updatedAt: newRecord.updated_at,
                        projectId: newRecord.project_id
                    };
                    
                    // 更新UI
                    if (typeof updateNotesDisplay === 'function') {
                        updateNotesDisplay();
                    }
                    
                    // 如果当前正在编辑这个笔记，更新编辑器
                    if (window.currentNoteId === newRecord.id) {
                        if (typeof updateNoteEditor === 'function') {
                            updateNoteEditor(AppState.notes[noteIndex]);
                        }
                    }
                }
            }
            break;
            
        case 'DELETE':
            // 删除笔记
            if (oldRecord) {
                const noteIndex = AppState.notes.findIndex(n => n.id === oldRecord.id);
                if (noteIndex !== -1) {
                    AppState.notes.splice(noteIndex, 1);
                    
                    // 更新UI
                    if (typeof updateNotesDisplay === 'function') {
                        updateNotesDisplay();
                    }
                    
                    // 如果当前正在编辑这个笔记，清空编辑器
                    if (window.currentNoteId === oldRecord.id) {
                        if (typeof clearNoteEditor === 'function') {
                            clearNoteEditor();
                        }
                    }
                }
            }
            break;
    }
}

/**
 * 处理项目变化
 * @param {Object} payload - 变化数据
 */
function handleProjectChange(payload) {
    console.log('处理项目变化:', payload);
    
    if (!window.AppState) return;
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            // 新增项目
            if (newRecord && !AppState.projects.find(p => p.id === newRecord.id)) {
                const project = {
                    id: newRecord.id,
                    name: newRecord.name,
                    description: newRecord.description,
                    status: newRecord.status,
                    priority: newRecord.priority,
                    tags: [], // 标签需要单独加载
                    tasks: [], // 任务需要单独加载
                    members: [], // 成员需要单独加载
                    createdAt: newRecord.created_at,
                    updatedAt: newRecord.updated_at
                };
                AppState.projects.unshift(project);
                
                // 更新UI
                if (typeof updateProjectsDisplay === 'function') {
                    updateProjectsDisplay();
                }
            }
            break;
            
        case 'UPDATE':
            // 更新项目
            if (newRecord) {
                const projectIndex = AppState.projects.findIndex(p => p.id === newRecord.id);
                if (projectIndex !== -1) {
                    AppState.projects[projectIndex] = {
                        ...AppState.projects[projectIndex],
                        name: newRecord.name,
                        description: newRecord.description,
                        status: newRecord.status,
                        priority: newRecord.priority,
                        updatedAt: newRecord.updated_at
                    };
                    
                    // 更新UI
                    if (typeof updateProjectsDisplay === 'function') {
                        updateProjectsDisplay();
                    }
                }
            }
            break;
            
        case 'DELETE':
            // 删除项目
            if (oldRecord) {
                const projectIndex = AppState.projects.findIndex(p => p.id === oldRecord.id);
                if (projectIndex !== -1) {
                    AppState.projects.splice(projectIndex, 1);
                    
                    // 更新UI
                    if (typeof updateProjectsDisplay === 'function') {
                        updateProjectsDisplay();
                    }
                }
            }
            break;
    }
}

// 导出主要函数（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadNotesFromDatabase,
        saveNoteToDatabase,
        deleteNoteFromDatabase,
        loadProjectsFromDatabase,
        saveProjectToDatabase,
        deleteProjectFromDatabase,
        loadTagsFromDatabase,
        getUserStats,
        syncAppStateToDatabase,
        syncLocalDataToDatabase,
        setupRealtimeListeners
    };
}

// 绑定函数到 window 对象（用于浏览器环境）
if (typeof window !== 'undefined') {
    window.loadNotesFromDatabase = loadNotesFromDatabase;
    window.saveNoteToDatabase = saveNoteToDatabase;
    window.deleteNoteFromDatabase = deleteNoteFromDatabase;
    window.loadProjectsFromDatabase = loadProjectsFromDatabase;
    window.saveProjectToDatabase = saveProjectToDatabase;
    window.deleteProjectFromDatabase = deleteProjectFromDatabase;
    window.loadTagsFromDatabase = loadTagsFromDatabase;
    window.getUserStats = getUserStats;
    window.syncAppStateToDatabase = syncAppStateToDatabase;
    window.syncLocalDataToDatabase = syncLocalDataToDatabase;
    window.setupRealtimeListeners = setupRealtimeListeners;
}