/**
 * 用户引导和首次使用体验
 * 为新用户提供欢迎界面和初始化选择
 */

/**
 * 显示欢迎引导界面
 * @param {Object} user - 用户对象
 */
function showWelcomeOnboarding(user) {
    const modal = createOnboardingModal(user);
    document.body.appendChild(modal);
    
    // 添加动画效果
    setTimeout(() => {
        modal.classList.add('show');
    }, 100);
}

/**
 * 创建引导模态框
 * @param {Object} user - 用户对象
 * @returns {HTMLElement} 模态框元素
 */
function createOnboardingModal(user) {
    const modal = document.createElement('div');
    modal.className = 'onboarding-modal';
    modal.innerHTML = `
        <div class="onboarding-overlay"></div>
        <div class="onboarding-content">
            <div class="onboarding-header">
                <div class="welcome-icon">🎉</div>
                <h1>欢迎使用 CogniNote Pro！</h1>
                <p>您好，${user.email.split('@')[0]}！让我们开始您的智能记事之旅。</p>
            </div>
            
            <div class="onboarding-body">
                <div class="feature-highlights">
                    <div class="feature-item">
                        <div class="feature-icon">📝</div>
                        <h3>智能笔记</h3>
                        <p>支持 Markdown 格式，实时保存，让您的想法永不丢失</p>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">📁</div>
                        <h3>项目管理</h3>
                        <p>组织您的笔记，跟踪项目进度，提高工作效率</p>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">🏷️</div>
                        <h3>标签系统</h3>
                        <p>灵活的标签分类，快速找到您需要的内容</p>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">☁️</div>
                        <h3>云端同步</h3>
                        <p>数据安全存储在云端，多设备无缝同步</p>
                    </div>
                </div>
                
                <div class="setup-options">
                    <h3>选择您的开始方式：</h3>
                    <div class="option-cards">
                        <div class="option-card" data-option="sample">
                            <div class="option-icon">🚀</div>
                            <h4>体验示例</h4>
                            <p>创建示例项目和笔记，快速了解功能</p>
                            <div class="option-badge recommended">推荐</div>
                        </div>
                        <div class="option-card" data-option="blank">
                            <div class="option-icon">✨</div>
                            <h4>空白开始</h4>
                            <p>从空白工作空间开始，完全自定义</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="onboarding-footer">
                <button class="btn-secondary" onclick="skipOnboarding()">跳过</button>
                <button class="btn-primary" id="startButton" disabled onclick="startWithOption()">
                    开始使用
                </button>
            </div>
        </div>
    `;
    
    // 添加样式
    addOnboardingStyles();
    
    // 添加事件监听器
    setupOnboardingEvents(modal);
    
    return modal;
}

/**
 * 设置引导界面事件监听器
 * @param {HTMLElement} modal - 模态框元素
 */
function setupOnboardingEvents(modal) {
    const optionCards = modal.querySelectorAll('.option-card');
    const startButton = modal.querySelector('#startButton');
    let selectedOption = null;
    
    optionCards.forEach(card => {
        card.addEventListener('click', () => {
            // 移除其他卡片的选中状态
            optionCards.forEach(c => c.classList.remove('selected'));
            
            // 选中当前卡片
            card.classList.add('selected');
            selectedOption = card.dataset.option;
            
            // 启用开始按钮
            startButton.disabled = false;
            startButton.textContent = selectedOption === 'sample' ? '创建示例数据' : '创建空白工作空间';
        });
    });
    
    // 存储选择的选项
    window.onboardingSelectedOption = selectedOption;
}

/**
 * 跳过引导
 */
function skipOnboarding() {
    const modal = document.querySelector('.onboarding-modal');
    if (modal) {
        modal.classList.add('hide');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
    
    // 创建空白工作空间
    initializeUserWorkspace(false);
}

/**
 * 使用选择的选项开始
 */
async function startWithOption() {
    const selectedOption = window.onboardingSelectedOption;
    const modal = document.querySelector('.onboarding-modal');
    
    if (!selectedOption) return;
    
    // 显示加载状态
    const startButton = document.querySelector('#startButton');
    const originalText = startButton.textContent;
    startButton.disabled = true;
    startButton.innerHTML = '<span class="loading-spinner"></span> 正在初始化...';
    
    try {
        // 初始化工作空间
        await initializeUserWorkspace(selectedOption === 'sample');
        
        // 关闭模态框
        modal.classList.add('hide');
        setTimeout(() => {
            modal.remove();
        }, 300);
        
        // 显示成功消息
        showNotification('工作空间初始化成功！', 'success');
        
        // 如果创建了示例数据，导航到项目页面
        if (selectedOption === 'sample') {
            setTimeout(() => {
                if (typeof navigateToPage === 'function') {
                    navigateToPage('projects');
                }
            }, 1000);
        }
        
    } catch (error) {
        console.error('初始化工作空间失败:', error);
        showNotification('初始化失败，请重试', 'error');
        
        // 恢复按钮状态
        startButton.disabled = false;
        startButton.textContent = originalText;
    }
}

/**
 * 初始化用户工作空间
 * @param {boolean} createSample - 是否创建示例数据
 */
async function initializeUserWorkspace(createSample) {
    const user = await getCurrentUserOptimized();
    if (!user) {
        throw new Error('用户未登录');
    }
    
    // 调用初始化函数
    await initializeUserData(user.id, createSample);
    
    // 重新加载数据
    await loadUserData();
}

/**
 * 添加引导界面样式
 */
function addOnboardingStyles() {
    if (document.querySelector('#onboarding-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'onboarding-styles';
    styles.textContent = `
        .onboarding-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        
        .onboarding-modal.show {
            opacity: 1;
            visibility: visible;
        }
        
        .onboarding-modal.hide {
            opacity: 0;
            visibility: hidden;
        }
        
        .onboarding-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
        }
        
        .onboarding-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            max-width: 800px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from {
                transform: translate(-50%, -40%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, -50%);
                opacity: 1;
            }
        }
        
        .onboarding-header {
            text-align: center;
            padding: 40px 40px 20px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .welcome-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        
        .onboarding-header h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 10px;
        }
        
        .onboarding-header p {
            font-size: 1.1rem;
            color: #6b7280;
            margin: 0;
        }
        
        .onboarding-body {
            padding: 30px 40px;
        }
        
        .feature-highlights {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .feature-item {
            text-align: center;
            padding: 20px;
            border-radius: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
        }
        
        .feature-icon {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        
        .feature-item h3 {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 8px;
        }
        
        .feature-item p {
            font-size: 0.9rem;
            color: #6b7280;
            margin: 0;
            line-height: 1.4;
        }
        
        .setup-options h3 {
            font-size: 1.3rem;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 20px;
            text-align: center;
        }
        
        .option-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .option-card {
            position: relative;
            padding: 30px 20px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
            background: white;
        }
        
        .option-card:hover {
            border-color: #3b82f6;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }
        
        .option-card.selected {
            border-color: #3b82f6;
            background: #eff6ff;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }
        
        .option-icon {
            font-size: 2.5rem;
            margin-bottom: 15px;
        }
        
        .option-card h4 {
            font-size: 1.2rem;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 10px;
        }
        
        .option-card p {
            font-size: 0.95rem;
            color: #6b7280;
            margin: 0;
            line-height: 1.4;
        }
        
        .option-badge {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #10b981;
            color: white;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 12px;
            text-transform: uppercase;
        }
        
        .option-badge.recommended {
            background: #f59e0b;
        }
        
        .onboarding-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 40px 40px;
            border-top: 1px solid #e5e7eb;
        }
        
        .btn-secondary {
            padding: 12px 24px;
            border: 1px solid #d1d5db;
            background: white;
            color: #6b7280;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .btn-secondary:hover {
            background: #f9fafb;
            border-color: #9ca3af;
        }
        
        .btn-primary {
            padding: 12px 24px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary:hover:not(:disabled) {
            background: #2563eb;
        }
        
        .btn-primary:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        
        .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top: 2px solid currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
        
        @media (max-width: 768px) {
            .onboarding-content {
                width: 95%;
                margin: 20px;
            }
            
            .onboarding-header,
            .onboarding-body,
            .onboarding-footer {
                padding-left: 20px;
                padding-right: 20px;
            }
            
            .feature-highlights {
                grid-template-columns: 1fr;
            }
            
            .option-cards {
                grid-template-columns: 1fr;
            }
            
            .onboarding-footer {
                flex-direction: column;
                gap: 15px;
            }
            
            .btn-secondary,
            .btn-primary {
                width: 100%;
                justify-content: center;
            }
        }
    `;
    
    document.head.appendChild(styles);
}

/**
 * 检查是否需要显示引导界面
 * @param {Object} user - 用户对象
 */
async function checkAndShowOnboarding(user) {
    const client = getSupabaseClientOptimized();
    if (!client) return;
    
    try {
        // 检查用户是否有任何数据
        const { data: notes } = await client
            .from('notes')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);
        
        const { data: projects } = await client
            .from('projects')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);
        
        // 如果是新用户，显示引导界面
        if ((!notes || notes.length === 0) && (!projects || projects.length === 0)) {
            setTimeout(() => {
                showWelcomeOnboarding(user);
            }, 500);
        }
        
    } catch (error) {
        console.error('检查引导状态失败:', error);
    }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showWelcomeOnboarding,
        checkAndShowOnboarding,
        skipOnboarding,
        startWithOption
    };
}