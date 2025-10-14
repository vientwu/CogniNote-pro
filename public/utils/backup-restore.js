/**
 * 数据备份和恢复工具
 * 提供完整的数据备份、恢复和导入导出功能
 */
class BackupRestoreTool {
    constructor() {
        this.backupVersion = '1.0';
        this.maxBackups = 10; // 最多保留10个备份
    }

    /**
     * 创建完整数据备份
     */
    async createBackup(description = '') {
        try {
            const user = getCurrentUser();
            if (!user) {
                throw new Error('用户未登录，无法创建备份');
            }

            showNotification('正在创建数据备份...', 'info');

            // 获取所有用户数据
            const backupData = await this.getAllUserData();
            
            // 创建备份对象
            const backup = {
                version: this.backupVersion,
                timestamp: new Date().toISOString(),
                description: description || `自动备份 - ${new Date().toLocaleString()}`,
                userId: user.id,
                userEmail: user.email,
                data: backupData,
                checksum: this.calculateChecksum(backupData)
            };

            // 保存到localStorage
            await this.saveBackupToLocal(backup);

            // 可选：保存到云端（如果有云存储服务）
            // await this.saveBackupToCloud(backup);

            showNotification('数据备份创建成功！', 'success');
            console.log('备份创建完成:', backup.timestamp);
            
            return backup;

        } catch (error) {
            console.error('创建备份失败:', error);
            showNotification(`创建备份失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 获取所有用户数据
     */
    async getAllUserData() {
        const data = {
            notes: [],
            projects: [],
            tasks: [],
            tags: [],
            settings: {}
        };

        try {
            // 获取笔记数据
            const { data: notes, error: notesError } = await supabase
                .from('notes_with_tags')
                .select('*')
                .eq('user_id', getCurrentUser().id)
                .order('created_at', { ascending: false });

            if (notesError) throw notesError;
            data.notes = notes || [];

            // 获取项目数据
            const { data: projects, error: projectsError } = await supabase
                .from('projects_with_tags')
                .select('*')
                .eq('user_id', getCurrentUser().id)
                .order('created_at', { ascending: false });

            if (projectsError) throw projectsError;
            data.projects = projects || [];

            // 获取任务数据
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select(`
                    *,
                    project:projects(name),
                    assignee:profiles(display_name, email)
                `)
                .in('project_id', data.projects.map(p => p.id));

            if (tasksError) throw tasksError;
            data.tasks = tasks || [];

            // 获取标签数据
            const { data: tags, error: tagsError } = await supabase
                .from('tags')
                .select('*')
                .eq('user_id', getCurrentUser().id)
                .order('name');

            if (tagsError) throw tagsError;
            data.tags = tags || [];

            // 获取用户设置
            data.settings = {
                theme: AppState.currentTheme,
                isKanbanView: AppState.isKanbanView,
                // 可以添加更多设置
            };

            return data;

        } catch (error) {
            console.error('获取用户数据失败:', error);
            throw error;
        }
    }

    /**
     * 保存备份到本地存储
     */
    async saveBackupToLocal(backup) {
        try {
            // 获取现有备份列表
            const backups = this.getLocalBackups();
            
            // 添加新备份
            backups.unshift(backup);
            
            // 限制备份数量
            if (backups.length > this.maxBackups) {
                backups.splice(this.maxBackups);
            }
            
            // 保存到localStorage
            localStorage.setItem('cogninote-backups', JSON.stringify(backups));
            
            // 同时保存最新备份的单独副本
            localStorage.setItem('cogninote-latest-backup', JSON.stringify(backup));
            
        } catch (error) {
            console.error('保存备份到本地失败:', error);
            throw error;
        }
    }

    /**
     * 获取本地备份列表
     */
    getLocalBackups() {
        try {
            const backupsData = localStorage.getItem('cogninote-backups');
            return backupsData ? JSON.parse(backupsData) : [];
        } catch (error) {
            console.error('获取本地备份列表失败:', error);
            return [];
        }
    }

    /**
     * 恢复数据从备份
     */
    async restoreFromBackup(backup, options = {}) {
        try {
            const user = getCurrentUser();
            if (!user) {
                throw new Error('用户未登录，无法恢复数据');
            }

            // 验证备份完整性
            if (!this.validateBackup(backup)) {
                throw new Error('备份文件损坏或格式不正确');
            }

            // 验证用户权限
            if (backup.userId !== user.id && !options.allowCrossUser) {
                throw new Error('无法恢复其他用户的备份数据');
            }

            showNotification('正在恢复数据...', 'info');

            // 创建当前数据的备份（以防恢复失败）
            const currentBackup = await this.createBackup('恢复前自动备份');

            try {
                // 清空现有数据（可选）
                if (options.clearExisting) {
                    await this.clearUserData();
                }

                // 恢复数据
                await this.restoreData(backup.data, options);

                // 更新应用状态
                await loadUserData();
                updateDashboard();
                updateNotesTabCounts();
                updateNotesOverviewContent('all-notes');

                showNotification('数据恢复成功！', 'success');
                console.log('数据恢复完成:', backup.timestamp);

            } catch (restoreError) {
                // 恢复失败，尝试回滚
                console.error('数据恢复失败，尝试回滚:', restoreError);
                try {
                    await this.restoreData(currentBackup.data, { clearExisting: true });
                    showNotification('数据恢复失败，已回滚到原始状态', 'warning');
                } catch (rollbackError) {
                    console.error('回滚也失败了:', rollbackError);
                    showNotification('数据恢复失败，回滚也失败，请手动恢复', 'error');
                }
                throw restoreError;
            }

        } catch (error) {
            console.error('恢复数据失败:', error);
            showNotification(`恢复数据失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 恢复具体数据
     */
    async restoreData(data, options = {}) {
        const results = {
            notes: { success: 0, failed: 0 },
            projects: { success: 0, failed: 0 },
            tasks: { success: 0, failed: 0 },
            tags: { success: 0, failed: 0 }
        };

        try {
            // 恢复标签
            if (data.tags && data.tags.length > 0) {
                results.tags = await this.restoreTags(data.tags, options);
            }

            // 恢复项目
            if (data.projects && data.projects.length > 0) {
                results.projects = await this.restoreProjects(data.projects, options);
            }

            // 恢复笔记
            if (data.notes && data.notes.length > 0) {
                results.notes = await this.restoreNotes(data.notes, options);
            }

            // 恢复任务
            if (data.tasks && data.tasks.length > 0) {
                results.tasks = await this.restoreTasks(data.tasks, options);
            }

            // 恢复设置
            if (data.settings) {
                this.restoreSettings(data.settings);
            }

            console.log('数据恢复结果:', results);
            return results;

        } catch (error) {
            console.error('恢复数据过程中出错:', error);
            throw error;
        }
    }

    /**
     * 恢复标签
     */
    async restoreTags(tags, options) {
        const results = { success: 0, failed: 0 };
        
        for (const tag of tags) {
            try {
                const { error } = await supabase
                    .from('tags')
                    .upsert({
                        id: options.preserveIds ? tag.id : undefined,
                        name: tag.name,
                        color: tag.color,
                        user_id: getCurrentUser().id
                    }, {
                        onConflict: options.preserveIds ? 'id' : 'name,user_id'
                    });

                if (error) throw error;
                results.success++;
                
            } catch (error) {
                console.error(`恢复标签 "${tag.name}" 失败:`, error);
                results.failed++;
            }
        }

        return results;
    }

    /**
     * 恢复项目
     */
    async restoreProjects(projects, options) {
        const results = { success: 0, failed: 0 };
        
        for (const project of projects) {
            try {
                const { error } = await supabase
                    .from('projects')
                    .upsert({
                        id: options.preserveIds ? project.id : undefined,
                        name: project.name,
                        description: project.description,
                        status: project.status,
                        priority: project.priority,
                        user_id: getCurrentUser().id,
                        created_at: project.created_at,
                        updated_at: project.updated_at
                    }, {
                        onConflict: options.preserveIds ? 'id' : 'name,user_id'
                    });

                if (error) throw error;
                results.success++;
                
            } catch (error) {
                console.error(`恢复项目 "${project.name}" 失败:`, error);
                results.failed++;
            }
        }

        return results;
    }

    /**
     * 恢复笔记
     */
    async restoreNotes(notes, options) {
        const results = { success: 0, failed: 0 };
        
        for (const note of notes) {
            try {
                const { error } = await supabase
                    .from('notes')
                    .upsert({
                        id: options.preserveIds ? note.id : undefined,
                        title: note.title,
                        content: note.content,
                        project_id: note.project_id,
                        user_id: getCurrentUser().id,
                        created_at: note.created_at,
                        updated_at: note.updated_at
                    }, {
                        onConflict: options.preserveIds ? 'id' : 'title,user_id'
                    });

                if (error) throw error;
                results.success++;
                
            } catch (error) {
                console.error(`恢复笔记 "${note.title}" 失败:`, error);
                results.failed++;
            }
        }

        return results;
    }

    /**
     * 恢复任务
     */
    async restoreTasks(tasks, options) {
        const results = { success: 0, failed: 0 };
        
        for (const task of tasks) {
            try {
                const { error } = await supabase
                    .from('tasks')
                    .upsert({
                        id: options.preserveIds ? task.id : undefined,
                        title: task.title,
                        description: task.description,
                        status: task.status,
                        priority: task.priority,
                        project_id: task.project_id,
                        assignee_id: task.assignee_id,
                        due_date: task.due_date,
                        created_at: task.created_at,
                        updated_at: task.updated_at
                    }, {
                        onConflict: options.preserveIds ? 'id' : undefined
                    });

                if (error) throw error;
                results.success++;
                
            } catch (error) {
                console.error(`恢复任务 "${task.title}" 失败:`, error);
                results.failed++;
            }
        }

        return results;
    }

    /**
     * 恢复设置
     */
    restoreSettings(settings) {
        try {
            if (settings.theme) {
                AppState.currentTheme = settings.theme;
                setTheme(settings.theme);
            }
            
            if (settings.isKanbanView !== undefined) {
                AppState.isKanbanView = settings.isKanbanView;
            }
            
            // 保存设置到localStorage
            saveAppState();
            
        } catch (error) {
            console.error('恢复设置失败:', error);
        }
    }

    /**
     * 清空用户数据
     */
    async clearUserData() {
        try {
            const userId = getCurrentUser().id;
            
            // 删除任务
            await supabase.from('tasks').delete().in('project_id', 
                AppState.projects.map(p => p.id));
            
            // 删除笔记标签关联
            await supabase.from('note_tags').delete().in('note_id',
                AppState.notes.map(n => n.id));
            
            // 删除项目标签关联
            await supabase.from('project_tags').delete().in('project_id',
                AppState.projects.map(p => p.id));
            
            // 删除笔记
            await supabase.from('notes').delete().eq('user_id', userId);
            
            // 删除项目
            await supabase.from('projects').delete().eq('user_id', userId);
            
            // 删除标签
            await supabase.from('tags').delete().eq('user_id', userId);
            
            console.log('用户数据已清空');
            
        } catch (error) {
            console.error('清空用户数据失败:', error);
            throw error;
        }
    }

    /**
     * 导出数据为JSON文件
     */
    async exportToFile(format = 'json') {
        try {
            const backup = await this.createBackup('手动导出');
            
            let content, filename, mimeType;
            
            if (format === 'json') {
                content = JSON.stringify(backup, null, 2);
                filename = `cogninote-backup-${new Date().toISOString().split('T')[0]}.json`;
                mimeType = 'application/json';
            } else {
                throw new Error('不支持的导出格式');
            }
            
            // 创建下载链接
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('数据导出成功！', 'success');
            
        } catch (error) {
            console.error('导出数据失败:', error);
            showNotification(`导出数据失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 从文件导入数据
     */
    async importFromFile(file) {
        try {
            const content = await this.readFileContent(file);
            const backup = JSON.parse(content);
            
            // 验证备份格式
            if (!this.validateBackup(backup)) {
                throw new Error('无效的备份文件格式');
            }
            
            // 确认导入
            const shouldImport = confirm(`确定要导入备份数据吗？\n\n备份时间: ${new Date(backup.timestamp).toLocaleString()}\n描述: ${backup.description}\n\n这将覆盖当前数据！`);
            
            if (shouldImport) {
                await this.restoreFromBackup(backup, { 
                    clearExisting: true,
                    preserveIds: false 
                });
            }
            
        } catch (error) {
            console.error('导入数据失败:', error);
            showNotification(`导入数据失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 读取文件内容
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    /**
     * 验证备份完整性
     */
    validateBackup(backup) {
        try {
            // 检查必要字段
            if (!backup || typeof backup !== 'object') return false;
            if (!backup.version || !backup.timestamp || !backup.data) return false;
            
            // 检查数据结构
            const data = backup.data;
            if (!data || typeof data !== 'object') return false;
            
            // 检查校验和（如果存在）
            if (backup.checksum) {
                const calculatedChecksum = this.calculateChecksum(data);
                if (calculatedChecksum !== backup.checksum) {
                    console.warn('备份校验和不匹配，可能数据已损坏');
                    return false;
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('验证备份失败:', error);
            return false;
        }
    }

    /**
     * 计算数据校验和
     */
    calculateChecksum(data) {
        try {
            const str = JSON.stringify(data);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            return hash.toString(16);
        } catch (error) {
            console.error('计算校验和失败:', error);
            return '';
        }
    }

    /**
     * 删除本地备份
     */
    deleteLocalBackup(timestamp) {
        try {
            const backups = this.getLocalBackups();
            const filteredBackups = backups.filter(backup => backup.timestamp !== timestamp);
            localStorage.setItem('cogninote-backups', JSON.stringify(filteredBackups));
            showNotification('备份已删除', 'success');
        } catch (error) {
            console.error('删除备份失败:', error);
            showNotification('删除备份失败', 'error');
        }
    }

    /**
     * 清理所有本地备份
     */
    clearAllLocalBackups() {
        try {
            localStorage.removeItem('cogninote-backups');
            localStorage.removeItem('cogninote-latest-backup');
            showNotification('所有备份已清理', 'success');
        } catch (error) {
            console.error('清理备份失败:', error);
            showNotification('清理备份失败', 'error');
        }
    }
}

// 全局实例
window.backupRestoreTool = new BackupRestoreTool();