/**
 * 离线缓存管理器
 * 处理离线数据存储、同步队列和冲突解决
 */

class OfflineCacheManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.conflictResolver = new ConflictResolver();
        
        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
        
        // 定期检查网络状态并同步
        setInterval(() => {
            if (this.isOnline && this.syncQueue.length > 0) {
                this.processSyncQueue();
            }
        }, 30000); // 每30秒检查一次
    }
    
    /**
     * 保存数据到离线缓存
     * @param {string} type - 数据类型 (note, project, tag)
     * @param {Object} data - 数据对象
     * @param {string} operation - 操作类型 (create, update, delete)
     */
    async saveToCache(type, data, operation = 'update') {
        try {
            const cacheKey = `offline_${type}_${data.id}`;
            const cacheData = {
                ...data,
                _offline: true,
                _operation: operation,
                _timestamp: Date.now()
            };
            
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            
            // 添加到同步队列
            this.addToSyncQueue(type, data, operation);
            
            console.log(`数据已保存到离线缓存: ${type} ${data.id}`);
            
        } catch (error) {
            console.error('保存到离线缓存失败:', error);
        }
    }
    
    /**
     * 从离线缓存加载数据
     * @param {string} type - 数据类型
     * @returns {Array} 缓存的数据数组
     */
    loadFromCache(type) {
        try {
            const cachedData = [];
            const keys = Object.keys(localStorage);
            
            keys.forEach(key => {
                if (key.startsWith(`offline_${type}_`)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data && data._offline) {
                            cachedData.push(data);
                        }
                    } catch (error) {
                        console.error(`解析缓存数据失败: ${key}`, error);
                    }
                }
            });
            
            // 按时间戳排序
            cachedData.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
            
            return cachedData;
            
        } catch (error) {
            console.error('从离线缓存加载数据失败:', error);
            return [];
        }
    }
    
    /**
     * 添加到同步队列
     * @param {string} type - 数据类型
     * @param {Object} data - 数据对象
     * @param {string} operation - 操作类型
     */
    addToSyncQueue(type, data, operation) {
        const syncItem = {
            id: `${type}_${data.id}_${Date.now()}`,
            type,
            data,
            operation,
            timestamp: Date.now(),
            retryCount: 0
        };
        
        // 检查是否已存在相同的同步项
        const existingIndex = this.syncQueue.findIndex(
            item => item.type === type && item.data.id === data.id
        );
        
        if (existingIndex !== -1) {
            // 更新现有项
            this.syncQueue[existingIndex] = syncItem;
        } else {
            // 添加新项
            this.syncQueue.push(syncItem);
        }
        
        // 如果在线，立即尝试同步
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }
    
    /**
     * 处理同步队列
     */
    async processSyncQueue() {
        if (!this.isOnline || this.syncQueue.length === 0) {
            return;
        }
        
        console.log(`开始处理同步队列，共 ${this.syncQueue.length} 项`);
        
        const itemsToRemove = [];
        
        for (let i = 0; i < this.syncQueue.length; i++) {
            const item = this.syncQueue[i];
            
            try {
                const success = await this.syncItem(item);
                
                if (success) {
                    // 同步成功，标记为删除
                    itemsToRemove.push(i);
                    
                    // 从离线缓存中删除
                    this.removeFromCache(item.type, item.data.id);
                    
                } else {
                    // 同步失败，增加重试次数
                    item.retryCount++;
                    
                    // 如果重试次数过多，移除该项
                    if (item.retryCount > 5) {
                        console.error(`同步失败次数过多，移除项目: ${item.id}`);
                        itemsToRemove.push(i);
                        this.removeFromCache(item.type, item.data.id);
                    }
                }
                
            } catch (error) {
                console.error(`同步项目失败: ${item.id}`, error);
                item.retryCount++;
                
                if (item.retryCount > 5) {
                    itemsToRemove.push(i);
                    this.removeFromCache(item.type, item.data.id);
                }
            }
        }
        
        // 从队列中移除已处理的项目（从后往前删除以避免索引问题）
        itemsToRemove.reverse().forEach(index => {
            this.syncQueue.splice(index, 1);
        });
        
        console.log(`同步队列处理完成，剩余 ${this.syncQueue.length} 项`);
    }
    
    /**
     * 同步单个项目到服务器
     * @param {Object} item - 同步项目
     * @returns {boolean} 是否同步成功
     */
    async syncItem(item) {
        try {
            const { type, data, operation } = item;
            
            switch (type) {
                case 'note':
                    return await this.syncNote(data, operation);
                case 'project':
                    return await this.syncProject(data, operation);
                case 'tag':
                    return await this.syncTag(data, operation);
                default:
                    console.error(`未知的同步类型: ${type}`);
                    return false;
            }
            
        } catch (error) {
            console.error('同步项目失败:', error);
            return false;
        }
    }
    
    /**
     * 同步笔记
     * @param {Object} note - 笔记数据
     * @param {string} operation - 操作类型
     * @returns {boolean} 是否同步成功
     */
    async syncNote(note, operation) {
        try {
            switch (operation) {
                case 'create':
                case 'update':
                    if (typeof saveNoteToDatabase === 'function') {
                        await saveNoteToDatabase(note);
                        return true;
                    }
                    break;
                    
                case 'delete':
                    if (typeof deleteNoteFromDatabase === 'function') {
                        await deleteNoteFromDatabase(note.id);
                        return true;
                    }
                    break;
            }
            
            return false;
            
        } catch (error) {
            console.error('同步笔记失败:', error);
            return false;
        }
    }
    
    /**
     * 同步项目
     * @param {Object} project - 项目数据
     * @param {string} operation - 操作类型
     * @returns {boolean} 是否同步成功
     */
    async syncProject(project, operation) {
        try {
            switch (operation) {
                case 'create':
                case 'update':
                    if (typeof saveProjectToDatabase === 'function') {
                        await saveProjectToDatabase(project);
                        return true;
                    }
                    break;
                    
                case 'delete':
                    if (typeof deleteProjectFromDatabase === 'function') {
                        await deleteProjectFromDatabase(project.id);
                        return true;
                    }
                    break;
            }
            
            return false;
            
        } catch (error) {
            console.error('同步项目失败:', error);
            return false;
        }
    }
    
    /**
     * 同步标签
     * @param {Object} tag - 标签数据
     * @param {string} operation - 操作类型
     * @returns {boolean} 是否同步成功
     */
    async syncTag(tag, operation) {
        // 标签同步逻辑（如果需要）
        return true;
    }
    
    /**
     * 从缓存中移除数据
     * @param {string} type - 数据类型
     * @param {string} id - 数据ID
     */
    removeFromCache(type, id) {
        const cacheKey = `offline_${type}_${id}`;
        localStorage.removeItem(cacheKey);
    }
    
    /**
     * 清空所有离线缓存
     */
    clearCache() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('offline_')) {
                localStorage.removeItem(key);
            }
        });
        
        this.syncQueue = [];
        console.log('离线缓存已清空');
    }
    
    /**
     * 获取同步状态
     * @returns {Object} 同步状态信息
     */
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            queueLength: this.syncQueue.length,
            lastSyncTime: localStorage.getItem('lastSyncTime'),
            cacheSize: this.getCacheSize()
        };
    }
    
    /**
     * 获取缓存大小
     * @returns {number} 缓存项目数量
     */
    getCacheSize() {
        const keys = Object.keys(localStorage);
        return keys.filter(key => key.startsWith('offline_')).length;
    }
}

/**
 * 冲突解决器
 * 处理数据同步时的冲突
 */
class ConflictResolver {
    /**
     * 解决数据冲突
     * @param {Object} localData - 本地数据
     * @param {Object} serverData - 服务器数据
     * @param {string} strategy - 解决策略 (local, server, merge, prompt)
     * @returns {Object} 解决后的数据
     */
    resolveConflict(localData, serverData, strategy = 'merge') {
        switch (strategy) {
            case 'local':
                return localData;
                
            case 'server':
                return serverData;
                
            case 'merge':
                return this.mergeData(localData, serverData);
                
            case 'prompt':
                return this.promptUserForResolution(localData, serverData);
                
            default:
                return this.mergeData(localData, serverData);
        }
    }
    
    /**
     * 合并数据
     * @param {Object} localData - 本地数据
     * @param {Object} serverData - 服务器数据
     * @returns {Object} 合并后的数据
     */
    mergeData(localData, serverData) {
        // 简单的合并策略：使用最新的时间戳
        const localTime = new Date(localData.updatedAt || localData.createdAt).getTime();
        const serverTime = new Date(serverData.updatedAt || serverData.createdAt).getTime();
        
        if (localTime > serverTime) {
            return { ...serverData, ...localData, updatedAt: new Date().toISOString() };
        } else {
            return serverData;
        }
    }
    
    /**
     * 提示用户解决冲突
     * @param {Object} localData - 本地数据
     * @param {Object} serverData - 服务器数据
     * @returns {Object} 用户选择的数据
     */
    promptUserForResolution(localData, serverData) {
        // 这里可以实现一个UI对话框让用户选择
        // 暂时返回合并结果
        return this.mergeData(localData, serverData);
    }
}

// 创建全局实例
window.offlineCacheManager = new OfflineCacheManager();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OfflineCacheManager,
        ConflictResolver
    };
}