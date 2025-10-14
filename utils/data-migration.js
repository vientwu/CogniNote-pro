/**
 * 数据迁移工具
 * 负责将localStorage中的数据迁移到Supabase数据库
 */
class DataMigrationTool {
    constructor() {
        this.migrationKey = 'cogninote-migration-status';
        this.backupKey = 'cogninote-migration-backup';
    }

    /**
     * 检查是否需要迁移
     */
    needsMigration() {
        // 检查是否已经迁移过
        const migrationStatus = localStorage.getItem(this.migrationKey);
        if (migrationStatus === 'completed') {
            return false;
        }

        // 检查是否有localStorage数据
        const localData = localStorage.getItem('cogninote-app-state');
        if (!localData) {
            return false;
        }

        try {
            const state = JSON.parse(localData);
            return (state.notes && state.notes.length > 0) || 
                   (state.projects && state.projects.length > 0);
        } catch (error) {
            console.error('解析localStorage数据失败:', error);
            return false;
        }
    }

    /**
     * 执行数据迁移
     */
    async migrate() {
        try {
            // 检查用户是否已登录
            const user = getCurrentUser();
            if (!user) {
                throw new Error('用户未登录，无法执行迁移');
            }

            // 获取localStorage数据
            const localData = localStorage.getItem('cogninote-app-state');
            if (!localData) {
                throw new Error('没有找到需要迁移的数据');
            }

            const state = JSON.parse(localData);
            
            // 创建备份
            await this.createBackup(state);

            // 开始迁移
            console.log('开始数据迁移...');
            showNotification('正在迁移数据到云端...', 'info');

            const migrationResults = {
                notes: { success: 0, failed: 0 },
                projects: { success: 0, failed: 0 },
                tags: { success: 0, failed: 0 }
            };

            // 迁移标签
            if (state.tags && state.tags.length > 0) {
                migrationResults.tags = await this.migrateTags(state.tags);
            }

            // 迁移笔记
            if (state.notes && state.notes.length > 0) {
                migrationResults.notes = await this.migrateNotes(state.notes);
            }

            // 迁移项目
            if (state.projects && state.projects.length > 0) {
                migrationResults.projects = await this.migrateProjects(state.projects);
            }

            // 标记迁移完成
            localStorage.setItem(this.migrationKey, 'completed');
            localStorage.setItem(`${this.migrationKey}-date`, new Date().toISOString());

            // 显示迁移结果
            this.showMigrationResults(migrationResults);

            console.log('数据迁移完成:', migrationResults);
            return migrationResults;

        } catch (error) {
            console.error('数据迁移失败:', error);
            showNotification(`数据迁移失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 创建数据备份
     */
    async createBackup(state) {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                data: state,
                version: '1.0'
            };
            
            localStorage.setItem(this.backupKey, JSON.stringify(backup));
            console.log('数据备份已创建');
        } catch (error) {
            console.error('创建备份失败:', error);
            throw new Error('无法创建数据备份');
        }
    }

    /**
     * 迁移标签
     */
    async migrateTags(tags) {
        const results = { success: 0, failed: 0 };
        
        for (const tag of tags) {
            try {
                // 检查标签是否已存在
                const { data: existingTags } = await supabase
                    .from('tags')
                    .select('id')
                    .eq('name', tag.name)
                    .eq('user_id', getCurrentUser().id);

                if (existingTags && existingTags.length > 0) {
                    console.log(`标签 "${tag.name}" 已存在，跳过`);
                    continue;
                }

                // 插入新标签
                const { error } = await supabase
                    .from('tags')
                    .insert({
                        name: tag.name,
                        color: tag.color || '#3b82f6',
                        user_id: getCurrentUser().id
                    });

                if (error) throw error;
                results.success++;
                
            } catch (error) {
                console.error(`迁移标签 "${tag.name}" 失败:`, error);
                results.failed++;
            }
        }

        return results;
    }

    /**
     * 迁移笔记
     */
    async migrateNotes(notes) {
        const results = { success: 0, failed: 0 };
        
        for (const note of notes) {
            try {
                // 检查笔记是否已存在（通过标题和创建时间）
                const { data: existingNotes } = await supabase
                    .from('notes')
                    .select('id')
                    .eq('title', note.title)
                    .eq('user_id', getCurrentUser().id);

                if (existingNotes && existingNotes.length > 0) {
                    console.log(`笔记 "${note.title}" 已存在，跳过`);
                    continue;
                }

                // 插入笔记
                const { data: insertedNote, error: noteError } = await supabase
                    .from('notes')
                    .insert({
                        title: note.title || '无标题',
                        content: note.content || '',
                        project_id: note.projectId || null,
                        user_id: getCurrentUser().id,
                        created_at: note.createdAt || new Date().toISOString(),
                        updated_at: note.updatedAt || new Date().toISOString()
                    })
                    .select()
                    .single();

                if (noteError) throw noteError;

                // 处理笔记标签
                if (note.tags && note.tags.length > 0) {
                    await this.migrateNoteTags(insertedNote.id, note.tags);
                }

                results.success++;
                
            } catch (error) {
                console.error(`迁移笔记 "${note.title}" 失败:`, error);
                results.failed++;
            }
        }

        return results;
    }

    /**
     * 迁移项目
     */
    async migrateProjects(projects) {
        const results = { success: 0, failed: 0 };
        
        for (const project of projects) {
            try {
                // 检查项目是否已存在
                const { data: existingProjects } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('name', project.name)
                    .eq('user_id', getCurrentUser().id);

                if (existingProjects && existingProjects.length > 0) {
                    console.log(`项目 "${project.name}" 已存在，跳过`);
                    continue;
                }

                // 插入项目
                const { data: insertedProject, error: projectError } = await supabase
                    .from('projects')
                    .insert({
                        name: project.name || '无标题项目',
                        description: project.description || '',
                        status: project.status || 'active',
                        priority: project.priority || 'medium',
                        user_id: getCurrentUser().id,
                        created_at: project.createdAt || new Date().toISOString(),
                        updated_at: project.updatedAt || new Date().toISOString()
                    })
                    .select()
                    .single();

                if (projectError) throw projectError;

                // 处理项目标签
                if (project.tags && project.tags.length > 0) {
                    await this.migrateProjectTags(insertedProject.id, project.tags);
                }

                // 处理项目任务
                if (project.tasks && project.tasks.length > 0) {
                    await this.migrateProjectTasks(insertedProject.id, project.tasks);
                }

                results.success++;
                
            } catch (error) {
                console.error(`迁移项目 "${project.name}" 失败:`, error);
                results.failed++;
            }
        }

        return results;
    }

    /**
     * 迁移笔记标签关联
     */
    async migrateNoteTags(noteId, tagNames) {
        for (const tagName of tagNames) {
            try {
                // 查找标签ID
                const { data: tag } = await supabase
                    .from('tags')
                    .select('id')
                    .eq('name', tagName)
                    .eq('user_id', getCurrentUser().id)
                    .single();

                if (tag) {
                    // 插入笔记标签关联
                    await supabase
                        .from('note_tags')
                        .insert({
                            note_id: noteId,
                            tag_id: tag.id
                        });
                }
            } catch (error) {
                console.error(`关联笔记标签 "${tagName}" 失败:`, error);
            }
        }
    }

    /**
     * 迁移项目标签关联
     */
    async migrateProjectTags(projectId, tagNames) {
        for (const tagName of tagNames) {
            try {
                // 查找标签ID
                const { data: tag } = await supabase
                    .from('tags')
                    .select('id')
                    .eq('name', tagName)
                    .eq('user_id', getCurrentUser().id)
                    .single();

                if (tag) {
                    // 插入项目标签关联
                    await supabase
                        .from('project_tags')
                        .insert({
                            project_id: projectId,
                            tag_id: tag.id
                        });
                }
            } catch (error) {
                console.error(`关联项目标签 "${tagName}" 失败:`, error);
            }
        }
    }

    /**
     * 迁移项目任务
     */
    async migrateProjectTasks(projectId, tasks) {
        for (const task of tasks) {
            try {
                await supabase
                    .from('tasks')
                    .insert({
                        title: task.title || '无标题任务',
                        description: task.description || '',
                        status: task.status || 'todo',
                        priority: task.priority || 'medium',
                        project_id: projectId,
                        assignee_id: null, // 暂时不迁移分配者信息
                        due_date: task.dueDate || null,
                        created_at: task.createdAt || new Date().toISOString(),
                        updated_at: task.updatedAt || new Date().toISOString()
                    });
            } catch (error) {
                console.error(`迁移任务 "${task.title}" 失败:`, error);
            }
        }
    }

    /**
     * 显示迁移结果
     */
    showMigrationResults(results) {
        const totalSuccess = results.notes.success + results.projects.success + results.tags.success;
        const totalFailed = results.notes.failed + results.projects.failed + results.tags.failed;

        if (totalFailed === 0) {
            showNotification(`数据迁移完成！成功迁移 ${totalSuccess} 项数据`, 'success');
        } else {
            showNotification(`数据迁移完成！成功 ${totalSuccess} 项，失败 ${totalFailed} 项`, 'warning');
        }

        // 详细结果日志
        console.log('迁移详细结果:', {
            笔记: `成功 ${results.notes.success} 项，失败 ${results.notes.failed} 项`,
            项目: `成功 ${results.projects.success} 项，失败 ${results.projects.failed} 项`,
            标签: `成功 ${results.tags.success} 项，失败 ${results.tags.failed} 项`
        });
    }

    /**
     * 恢复备份数据
     */
    async restoreBackup() {
        try {
            const backup = localStorage.getItem(this.backupKey);
            if (!backup) {
                throw new Error('没有找到备份数据');
            }

            const backupData = JSON.parse(backup);
            localStorage.setItem('cogninote-app-state', JSON.stringify(backupData.data));
            
            showNotification('备份数据已恢复', 'success');
            console.log('备份数据已恢复:', backupData.timestamp);
            
        } catch (error) {
            console.error('恢复备份失败:', error);
            showNotification(`恢复备份失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 清理迁移数据
     */
    cleanupMigration() {
        try {
            // 清理备份（可选）
            // localStorage.removeItem(this.backupKey);
            
            // 重置迁移状态（用于测试）
            // localStorage.removeItem(this.migrationKey);
            // localStorage.removeItem(`${this.migrationKey}-date`);
            
            console.log('迁移数据清理完成');
        } catch (error) {
            console.error('清理迁移数据失败:', error);
        }
    }

    /**
     * 获取迁移状态
     */
    getMigrationStatus() {
        const status = localStorage.getItem(this.migrationKey);
        const date = localStorage.getItem(`${this.migrationKey}-date`);
        
        return {
            completed: status === 'completed',
            date: date ? new Date(date) : null,
            hasBackup: !!localStorage.getItem(this.backupKey)
        };
    }
}

// 全局实例
window.dataMigrationTool = new DataMigrationTool();