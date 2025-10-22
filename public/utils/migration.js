/**
 * 数据迁移工具
 * 用于将 localStorage 数据迁移到 Supabase 数据库
 */

/**
 * 数据迁移主函数
 * @returns {Object} 迁移结果
 */
async function migrateLocalStorageToDatabase() {
    console.log('开始数据迁移...');
    
    const migrationResult = {
        success: false,
        notes: { migrated: 0, failed: 0, errors: [] },
        projects: { migrated: 0, failed: 0, errors: [] },
        tags: { migrated: 0, failed: 0, errors: [] },
        totalErrors: []
    };
    
    try {
        // 检查用户登录状态
        const user = await getCurrentUserOptimized();
        if (!user) {
            throw new Error('用户未登录，无法进行数据迁移');
        }
        
        // 确保用户配置文件存在
        await ensureUserProfile();
        
        // 备份现有数据
        const backupResult = await backupLocalStorageData();
        if (!backupResult.success) {
            throw new Error('数据备份失败: ' + backupResult.error);
        }
        
        // 获取 localStorage 中的数据
        const localData = getLocalStorageData();
        
        // 迁移标签（需要先迁移，因为笔记和项目依赖标签）
        if (localData.tags && localData.tags.length > 0) {
            const tagResult = await migrateTags(localData.tags, user.id);
            migrationResult.tags = tagResult;
        }
        
        // 迁移笔记
        if (localData.notes && localData.notes.length > 0) {
            const noteResult = await migrateNotes(localData.notes, user.id);
            migrationResult.notes = noteResult;
        }
        
        // 迁移项目
        if (localData.projects && localData.projects.length > 0) {
            const projectResult = await migrateProjects(localData.projects, user.id);
            migrationResult.projects = projectResult;
        }
        
        // 检查迁移结果
        const totalMigrated = migrationResult.notes.migrated + 
                             migrationResult.projects.migrated + 
                             migrationResult.tags.migrated;
        
        const totalFailed = migrationResult.notes.failed + 
                           migrationResult.projects.failed + 
                           migrationResult.tags.failed;
        
        if (totalFailed === 0) {
            migrationResult.success = true;
            console.log(`数据迁移完成！共迁移 ${totalMigrated} 条记录`);
            
            // 迁移成功后，清理 localStorage（可选）
            if (confirm('数据迁移成功！是否清理本地存储的旧数据？')) {
                clearLocalStorageData();
            }
            
        } else {
            console.warn(`数据迁移部分成功。成功: ${totalMigrated}, 失败: ${totalFailed}`);
            migrationResult.totalErrors = [
                ...migrationResult.notes.errors,
                ...migrationResult.projects.errors,
                ...migrationResult.tags.errors
            ];
        }
        
        return migrationResult;
        
    } catch (error) {
        console.error('数据迁移失败:', error);
        migrationResult.totalErrors.push(error.message);
        return migrationResult;
    }
}

/**
 * 获取 localStorage 中的数据
 * @returns {Object} 本地数据
 */
function getLocalStorageData() {
    const data = {
        notes: [],
        projects: [],
        tags: []
    };
    
    try {
        // 获取笔记数据
        const notesData = localStorage.getItem('cogninote_notes');
        if (notesData) {
            data.notes = JSON.parse(notesData);
        }
        
        // 获取项目数据
        const projectsData = localStorage.getItem('cogninote_projects');
        if (projectsData) {
            data.projects = JSON.parse(projectsData);
        }
        
        // 获取标签数据（如果存在）
        const tagsData = localStorage.getItem('cogninote_tags');
        if (tagsData) {
            data.tags = JSON.parse(tagsData);
        } else {
            // 从笔记和项目中提取标签
            const allTags = new Set();
            
            data.notes.forEach(note => {
                if (note.tags) {
                    note.tags.forEach(tag => allTags.add(tag));
                }
            });
            
            data.projects.forEach(project => {
                if (project.tags) {
                    project.tags.forEach(tag => allTags.add(tag));
                }
            });
            
            data.tags = Array.from(allTags).map(tagName => ({
                name: tagName,
                color: getRandomTagColor()
            }));
        }
        
        console.log('本地数据统计:', {
            notes: data.notes.length,
            projects: data.projects.length,
            tags: data.tags.length
        });
        
        return data;
        
    } catch (error) {
        console.error('读取本地数据失败:', error);
        return data;
    }
}

/**
 * 迁移标签
 * @param {Array} tags - 标签数组
 * @param {string} userId - 用户ID
 * @returns {Object} 迁移结果
 */
async function migrateTags(tags, userId) {
    const result = { migrated: 0, failed: 0, errors: [] };
    const client = getSupabaseClientOptimized();
    
    if (!client) {
        result.errors.push('Supabase 客户端未初始化');
        return result;
    }
    
    for (const tag of tags) {
        try {
            const tagData = {
                user_id: userId,
                name: tag.name || tag,
                color: tag.color || getRandomTagColor()
            };
            
            // 检查标签是否已存在
            const { data: existingTag } = await client
                .from('tags')
                .select('id')
                .eq('user_id', userId)
                .eq('name', tagData.name)
                .single();
            
            if (!existingTag) {
                const { error } = await client
                    .from('tags')
                    .insert(tagData);
                
                if (error) throw error;
            }
            
            result.migrated++;
            
        } catch (error) {
            result.failed++;
            result.errors.push(`标签 "${tag.name || tag}" 迁移失败: ${error.message}`);
            console.error('标签迁移失败:', error);
        }
    }
    
    return result;
}

/**
 * 迁移笔记
 * @param {Array} notes - 笔记数组
 * @param {string} userId - 用户ID
 * @returns {Object} 迁移结果
 */
async function migrateNotes(notes, userId) {
    const result = { migrated: 0, failed: 0, errors: [] };
    const client = getSupabaseClientOptimized();
    
    if (!client) {
        result.errors.push('Supabase 客户端未初始化');
        return result;
    }
    
    for (const note of notes) {
        try {
            const noteData = {
                user_id: userId,
                title: note.title || '无标题',
                content: note.content || '',
                is_favorite: note.isFavorite || false,
                project_id: null, // 暂时设为 null，后续可以根据需要关联项目
                created_at: note.createdAt || new Date().toISOString(),
                updated_at: note.updatedAt || new Date().toISOString()
            };
            
            // 插入笔记
            const { data: insertedNote, error: noteError } = await client
                .from('notes')
                .insert(noteData)
                .select()
                .single();
            
            if (noteError) throw noteError;
            
            // 处理标签关联
            if (note.tags && note.tags.length > 0) {
                await migrateNoteTags(insertedNote.id, note.tags, userId);
            }
            
            result.migrated++;
            
        } catch (error) {
            result.failed++;
            result.errors.push(`笔记 "${note.title}" 迁移失败: ${error.message}`);
            console.error('笔记迁移失败:', error);
        }
    }
    
    return result;
}

/**
 * 迁移笔记标签关联
 * @param {string} noteId - 笔记ID
 * @param {Array} tagNames - 标签名称数组
 * @param {string} userId - 用户ID
 */
async function migrateNoteTags(noteId, tagNames, userId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        for (const tagName of tagNames) {
            // 获取标签ID
            const { data: tag } = await client
                .from('tags')
                .select('id')
                .eq('user_id', userId)
                .eq('name', tagName)
                .single();
            
            if (tag) {
                // 创建标签关联
                await client
                    .from('note_tags')
                    .insert({
                        note_id: noteId,
                        tag_id: tag.id
                    });
            }
        }
    } catch (error) {
        console.error('笔记标签关联迁移失败:', error);
    }
}

/**
 * 迁移项目
 * @param {Array} projects - 项目数组
 * @param {string} userId - 用户ID
 * @returns {Object} 迁移结果
 */
async function migrateProjects(projects, userId) {
    const result = { migrated: 0, failed: 0, errors: [] };
    const client = getSupabaseClientOptimized();
    
    if (!client) {
        result.errors.push('Supabase 客户端未初始化');
        return result;
    }
    
    for (const project of projects) {
        try {
            const projectData = {
                user_id: userId,
                name: project.name || '无标题项目',
                description: project.description || '',
                status: project.status || 'active',
                progress: project.progress || 0,
                deadline: project.deadline || null,
                created_at: project.createdAt || new Date().toISOString(),
                updated_at: project.updatedAt || new Date().toISOString()
            };
            
            // 插入项目
            const { data: insertedProject, error: projectError } = await client
                .from('projects')
                .insert(projectData)
                .select()
                .single();
            
            if (projectError) throw projectError;
            
            // 处理标签关联
            if (project.tags && project.tags.length > 0) {
                await migrateProjectTags(insertedProject.id, project.tags, userId);
            }
            
            // 处理任务
            if (project.tasks && project.tasks.length > 0) {
                await migrateProjectTasks(insertedProject.id, project.tasks, userId);
            }
            
            result.migrated++;
            
        } catch (error) {
            result.failed++;
            result.errors.push(`项目 "${project.name}" 迁移失败: ${error.message}`);
            console.error('项目迁移失败:', error);
        }
    }
    
    return result;
}

/**
 * 迁移项目标签关联
 * @param {string} projectId - 项目ID
 * @param {Array} tagNames - 标签名称数组
 * @param {string} userId - 用户ID
 */
async function migrateProjectTags(projectId, tagNames, userId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        for (const tagName of tagNames) {
            // 获取标签ID
            const { data: tag } = await client
                .from('tags')
                .select('id')
                .eq('user_id', userId)
                .eq('name', tagName)
                .single();
            
            if (tag) {
                // 创建标签关联
                await client
                    .from('project_tags')
                    .insert({
                        project_id: projectId,
                        tag_id: tag.id
                    });
            }
        }
    } catch (error) {
        console.error('项目标签关联迁移失败:', error);
    }
}

/**
 * 迁移项目任务
 * @param {string} projectId - 项目ID
 * @param {Array} tasks - 任务数组
 * @param {string} userId - 用户ID
 */
async function migrateProjectTasks(projectId, tasks, userId) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        for (const task of tasks) {
            const taskData = {
                project_id: projectId,
                user_id: userId,
                title: task.title || '无标题任务',
                description: task.description || '',
                status: task.status || 'todo',
                priority: task.priority || 'medium',
                assignee_id: userId, // 默认分配给当前用户
                due_date: task.dueDate || null,
                created_at: task.createdAt || new Date().toISOString(),
                updated_at: task.updatedAt || new Date().toISOString()
            };
            
            await client
                .from('tasks')
                .insert(taskData);
        }
    } catch (error) {
        console.error('项目任务迁移失败:', error);
    }
}

/**
 * 备份 localStorage 数据
 * @returns {Object} 备份结果
 */
async function backupLocalStorageData() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupData = {
            timestamp: timestamp,
            notes: JSON.parse(localStorage.getItem('cogninote_notes') || '[]'),
            projects: JSON.parse(localStorage.getItem('cogninote_projects') || '[]'),
            tags: JSON.parse(localStorage.getItem('cogninote_tags') || '[]')
        };
        
        // 将备份数据保存到 localStorage 的特殊键中
        localStorage.setItem(`cogninote_backup_${timestamp}`, JSON.stringify(backupData));
        
        console.log('数据备份完成:', `cogninote_backup_${timestamp}`);
        return { success: true, backupKey: `cogninote_backup_${timestamp}` };
        
    } catch (error) {
        console.error('数据备份失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 清理 localStorage 数据
 */
function clearLocalStorageData() {
    try {
        localStorage.removeItem('cogninote_notes');
        localStorage.removeItem('cogninote_projects');
        localStorage.removeItem('cogninote_tags');
        
        console.log('本地数据清理完成');
        showNotification('本地数据已清理', 'success');
        
    } catch (error) {
        console.error('清理本地数据失败:', error);
        showNotification('清理本地数据失败: ' + error.message, 'error');
    }
}

/**
 * 恢复备份数据
 * @param {string} backupKey - 备份键名
 * @returns {Object} 恢复结果
 */
function restoreBackupData(backupKey) {
    try {
        const backupData = localStorage.getItem(backupKey);
        if (!backupData) {
            throw new Error('备份数据不存在');
        }
        
        const data = JSON.parse(backupData);
        
        // 恢复数据到 localStorage
        localStorage.setItem('cogninote_notes', JSON.stringify(data.notes));
        localStorage.setItem('cogninote_projects', JSON.stringify(data.projects));
        localStorage.setItem('cogninote_tags', JSON.stringify(data.tags));
        
        console.log('数据恢复完成');
        return { success: true };
        
    } catch (error) {
        console.error('数据恢复失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 获取所有备份列表
 * @returns {Array} 备份列表
 */
function getBackupList() {
    const backups = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cogninote_backup_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                backups.push({
                    key: key,
                    timestamp: data.timestamp,
                    notesCount: data.notes.length,
                    projectsCount: data.projects.length,
                    tagsCount: data.tags.length
                });
            } catch (error) {
                console.error('解析备份数据失败:', key, error);
            }
        }
    }
    
    return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * 显示迁移进度
 * @param {string} message - 进度消息
 */
function showMigrationProgress(message) {
    console.log('迁移进度:', message);
    
    // 如果有进度显示组件，在这里更新
    if (typeof showNotification === 'function') {
        showNotification(message, 'info');
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

// 导出主要函数（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        migrateLocalStorageToDatabase,
        backupLocalStorageData,
        clearLocalStorageData,
        restoreBackupData,
        getBackupList
    };
}