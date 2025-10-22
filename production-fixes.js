/**
 * 生产环境修复脚本
 * 用于修复部署后可能出现的问题
 */

console.log('🔧 生产环境修复脚本已加载');

// 确保所有按钮事件正确绑定
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 开始应用生产环境修复...');
    
    // 修复按钮事件绑定问题
    setTimeout(function() {
        // 确保新建笔记按钮事件正确绑定
        const createNoteButtons = document.querySelectorAll('[onclick*="createNewNote"]');
        createNoteButtons.forEach(button => {
            if (button && !button.hasAttribute('data-event-fixed')) {
                button.setAttribute('data-event-fixed', 'true');
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔧 修复后的新建笔记按钮被点击');
                    if (typeof createNewNote === 'function') {
                        createNewNote().catch(console.error);
                    } else {
                        console.error('createNewNote 函数未定义');
                    }
                });
                console.log('🔧 已修复新建笔记按钮事件绑定');
            }
        });
        
        // 确保新建项目按钮事件正确绑定
        const createProjectButtons = document.querySelectorAll('[onclick*="createNewProject"]');
        createProjectButtons.forEach(button => {
            if (button && !button.hasAttribute('data-event-fixed')) {
                button.setAttribute('data-event-fixed', 'true');
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔧 修复后的新建项目按钮被点击');
                    if (typeof createNewProject === 'function') {
                        createNewProject().catch(console.error);
                    } else {
                        console.error('createNewProject 函数未定义');
                    }
                });
                console.log('🔧 已修复新建项目按钮事件绑定');
            }
        });
        
        console.log('🔧 生产环境修复完成');
    }, 1000); // 延迟1秒确保页面完全加载
});

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('🔧 捕获到全局错误:', e.error);
    // 如果是按钮相关的错误，尝试重新绑定事件
    if (e.error && e.error.message && e.error.message.includes('createNew')) {
        console.log('🔧 检测到按钮相关错误，尝试重新修复...');
        setTimeout(function() {
            location.reload();
        }, 2000);
    }
});

// 确保函数在全局作用域可用
window.addEventListener('load', function() {
    // 检查关键函数是否存在
    const requiredFunctions = ['createNewNote', 'createNewProject', 'getCurrentUser'];
    requiredFunctions.forEach(funcName => {
        if (typeof window[funcName] !== 'function') {
            console.warn(`🔧 警告: ${funcName} 函数未在全局作用域中找到`);
        } else {
            console.log(`🔧 确认: ${funcName} 函数可用`);
        }
    });
});

// ========================
// AI 对话窗口（OpenRouter）集成 - 更舒适的标准聊天界面
// ========================
(function() {
    // 配置（警告：前端暴露密钥仅用于开发，请改为服务端代理在生产环境使用）
    const OPENROUTER = {
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: '', // 统一从设置页读取，不再在前端硬编码默认密钥
        model: 'google/gemini-2.5-flash-image-preview',
        siteUrl: (typeof location !== 'undefined' ? location.origin : 'http://127.0.0.1:5173'),
        siteTitle: 'CogniNote Pro'
    };
    // 动态配置（本地存储优先）
    const STORAGE = { KEY: 'CN_OPENROUTER_KEY', MODEL: 'CN_OPENROUTER_MODEL', MODE: 'CN_OPENROUTER_MODE' };
    function getApiKey() { return (localStorage.getItem(STORAGE.KEY) || OPENROUTER.apiKey || '').trim(); }
    function setApiKey(v) { localStorage.setItem(STORAGE.KEY, v || ''); }
    function getModel() { return (localStorage.getItem(STORAGE.MODEL) || OPENROUTER.model || '').trim(); }
    function setModel(v) { localStorage.setItem(STORAGE.MODEL, v || ''); }
    function getMode() { return (localStorage.getItem(STORAGE.MODE) || 'auto').trim(); }
    function setMode(v) { localStorage.setItem(STORAGE.MODE, v || 'auto'); }
    function isLikelyInvalidKey(k) { return !k || k.length < 20; }

    // 注入样式（更宽、更通透，标准聊天布局）
    function injectAIStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .ai-chat-modal { position: fixed; inset: 0; display:none; z-index: 9999; }
            .ai-chat-modal.open { display:block; }
            .ai-chat-backdrop { position:absolute; inset:0; background: rgba(0,0,0,.28); }
            .ai-chat-window { position:absolute; right: 28px; bottom: 28px; width: 680px; max-width: 95vw; height: 82vh; max-height: 95vh; background: var(--bg-secondary); border:1px solid var(--border-light); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); display:flex; flex-direction:column; overflow:hidden; backdrop-filter: saturate(1.2) blur(6px); }
            .ai-chat-window.max { height: 94vh; max-height: 96vh; }
            
            .ai-chat-header { display:flex; align-items:center; justify-content:space-between; padding: 14px 16px; border-bottom:1px solid var(--border-light); background: var(--bg-card); }
            .ai-chat-title { font-weight:600; font-size: 16px; }
            .ai-chat-close { border:none; background:transparent; font-size:20px; cursor:pointer; color:var(--text-secondary); }
            .ai-chat-expand { border:none; background:transparent; font-size:18px; cursor:pointer; color:var(--text-secondary); margin-right:8px; }
            
            .ai-chat-body { padding:16px; overflow:auto; flex:1; background: var(--bg-tertiary); display:flex; flex-direction:column; gap: 12px; }
            .ai-msg { margin: 0; padding: 12px 14px; border-radius: 14px; max-width: 80%; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
            .ai-msg-user { background: var(--primary-color); color: var(--text-inverse); margin-left:auto; }
            .ai-msg-assistant { background: var(--bg-card); color: var(--text-primary); border:1px solid var(--border-light); }
            .ai-msg-error { background: var(--error-gradient); color: var(--text-inverse); }
            .ai-msg img { max-width: 100%; border-radius: 8px; border: 1px solid var(--border-light); margin-top: 8px; cursor: zoom-in; }
            /* 图片预览 */
            .ai-img-preview { position: fixed; inset:0; display:none; z-index:10000; }
            .ai-img-preview.open { display:block; }
            .ai-img-preview-backdrop { position:absolute; inset:0; background: rgba(0,0,0,.6); }
            .ai-img-preview-window { position:absolute; left:50%; top:50%; transform: translate(-50%, -50%); max-width: 92vw; max-height: 92vh; box-shadow: var(--shadow-xxl); }
            .ai-img-preview-window img { max-width: 92vw; max-height: 92vh; border-radius: 12px; background: var(--bg-card); }
            /* 下载按钮覆盖样式 */
            .ai-img-wrap { position: relative; display: inline-block; }
            .ai-img-download { position: absolute; right: 8px; bottom: 8px; padding: 4px 8px; background: rgba(0,0,0,.6); color: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; user-select: none; box-shadow: var(--shadow-sm); display: none; }
            .ai-img-wrap:hover .ai-img-download { display: inline-flex; align-items: center; gap: 4px; }
            
            /* 输入区与动作区重设计（更紧凑） */
            .ai-chat-input { position: relative; padding: 8px 10px; border-top: 1px solid var(--border-light); background: var(--bg-card); }
            .ai-input-text { width: 100%; resize: none; border: 1px solid var(--border-light); border-radius: 10px; padding: 8px 10px; background: var(--bg-tertiary); color: var(--text-primary); outline: none; box-shadow: none; }
            .ai-input-text:focus { border-color: var(--primary-color); box-shadow: 0 0 0 2px var(--primary-ghost); }
            .ai-actions { display:flex; gap:6px; justify-content:flex-end; align-items:center; margin-top:6px; }
            .ai-btn, .ai-send-btn { border:1px solid var(--border-light); background: var(--bg-card); color: var(--text-secondary); height:28px; min-width:28px; border-radius:8px; cursor:pointer; padding:0 8px; }
            .ai-btn { font-size:16px; width:30px; display:inline-flex; align-items:center; justify-content:center; }
            .ai-send-btn { background: var(--primary-color); color: var(--text-inverse); border-color: var(--primary-color); width:40px; }
            .ai-send-btn[disabled] { opacity: .6; cursor: not-allowed; }
            
            /* 附加图片弹层（点击＋显示） */
            .ai-extra { display:none; position:absolute; left:12px; right:12px; bottom:56px; background: var(--bg-card); border:1px solid var(--border-light); border-radius:10px; padding:10px; box-shadow: var(--shadow-lg); z-index:10; }
            .ai-input-image, .ai-input-file { width:100%; margin-top:8px; background: var(--bg-tertiary); border:1px solid var(--border-light); border-radius:8px; padding:8px 10px; font-size:12px; color: var(--text-primary); }
            .ai-extra-tip { font-size:12px; color: var(--text-secondary); margin-top:6px; }
            
            .ai-chat-footer { padding:8px 12px; font-size:12px; color: var(--text-secondary); border-top: 1px dashed var(--border-light); background: var(--bg-card); }
            
            /* 高级设置折叠区（保留样式以兼容旧逻辑，但不再显示于聊天窗） */
            .ai-advanced-panel { display: none; padding-top: 8px; border-top: 1px dashed var(--border-light); margin-top: 8px; }
            .ai-advanced-panel.open { display: block; }
        `;
        document.head.appendChild(style);
    }

    function createAIChatDOM() {
        // 添加导航栏按钮
        const navbarRight = document.querySelector('.navbar-right');
        let aiButton = null;
        if (navbarRight) {
            aiButton = document.createElement('button');
            aiButton.className = 'ai-chat-toggle-btn nav-btn';
            aiButton.title = 'AI 助手';
            aiButton.innerHTML = '<i class="fa-solid fa-robot"></i>';
            navbarRight.appendChild(aiButton);
        } else {
            // 兜底：添加一个悬浮按钮
            aiButton = document.createElement('button');
            aiButton.className = 'ai-chat-toggle-btn';
            aiButton.style.position = 'fixed';
            aiButton.style.right = '24px';
            aiButton.style.bottom = '24px';
            aiButton.innerHTML = '<i class="fa-solid fa-robot"></i>';
            document.body.appendChild(aiButton);
        }

        // 创建对话框（更标准的聊天布局）
        const modal = document.createElement('div');
        modal.className = 'ai-chat-modal';
        modal.innerHTML = `
            <div class="ai-chat-backdrop"></div>
            <div class="ai-chat-window">
                <div class="ai-chat-header">
                    <div class="ai-chat-title">AI 助手（OpenRouter）</div>
                    <div>
                       <button class="ai-chat-expand" title="增高">⤢</button>
                       <button class="ai-chat-close" title="关闭">×</button>
                    </div>
                </div>

                <div class="ai-chat-body" id="ai-chat-body"></div>
                <div class="ai-chat-input">
                    <textarea id="ai-input-text" class="ai-input-text" rows="3" placeholder="输入消息，Enter发送，Shift+Enter换行..."></textarea>
                    <div class="ai-extra" id="ai-extra">
                        <input type="url" id="ai-input-image-url" class="ai-input-image" placeholder="图片URL（可选）" />
                        <input type="file" id="ai-input-image-file" class="ai-input-file" accept="image/*" />
                        <div class="ai-extra-tip">支持本地图片上传或粘贴URL</div>
                    </div>
                    <div class="ai-actions">
                        <button class="ai-btn" id="ai-attach-toggle" title="添加图片">＋</button>
                        <button class="ai-send-btn" id="ai-send-btn" title="发送">➤</button>
                    </div>
                </div>
                <div class="ai-chat-footer">模型：<span id="ai-model-label">google/gemini-2.5-flash-image-preview</span> · 直连 OpenRouter（本地开发）</div>
            </div>
            <div class="ai-img-preview" id="ai-img-preview">
                <div class="ai-img-preview-backdrop"></div>
                <div class="ai-img-preview-window">
                    <img id="ai-img-preview-img" alt="preview" />
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 事件绑定
        const closeBtn = modal.querySelector('.ai-chat-close');
        const backdrop = modal.querySelector('.ai-chat-backdrop');
        const sendBtn = modal.querySelector('#ai-send-btn');
        const inputText = modal.querySelector('#ai-input-text');
        const inputImageUrl = modal.querySelector('#ai-input-image-url');
        const inputImageFile = modal.querySelector('#ai-input-image-file');
        const extraPanel = modal.querySelector('#ai-extra');
        const attachToggle = modal.querySelector('#ai-attach-toggle');
        const body = modal.querySelector('#ai-chat-body');
        const modelLabel = modal.querySelector('#ai-model-label');
        const expandBtn = modal.querySelector('.ai-chat-expand');
        const winEl = modal.querySelector('.ai-chat-window');
        const imgPreview = modal.querySelector('#ai-img-preview');
        const imgPreviewBackdrop = modal.querySelector('.ai-img-preview-backdrop');
        const imgPreviewImg = modal.querySelector('#ai-img-preview-img');
        
        expandBtn && expandBtn.addEventListener('click', () => {
            if (winEl) winEl.classList.toggle('max');
        });
        // 图片预览事件：委托到聊天区域
        body.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.tagName === 'IMG' && target.closest('.ai-msg')) {
                if (imgPreviewImg) imgPreviewImg.src = target.src;
                if (imgPreview) imgPreview.classList.add('open');
            }
        });
        imgPreviewBackdrop && imgPreviewBackdrop.addEventListener('click', () => {
            if (imgPreview) imgPreview.classList.remove('open');
            if (imgPreviewImg) imgPreviewImg.src = '';
        });

        function open() { 
            modal.classList.add('open');
            try { modelLabel && (modelLabel.textContent = getModel()); } catch (_) {}
            inputText.focus(); 
        }
        function close() { modal.classList.remove('open'); }

        aiButton.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        backdrop.addEventListener('click', close);

        // 输入框自动高度
        function autoResize() {
            inputText.style.height = 'auto';
            inputText.style.height = Math.min(inputText.scrollHeight, 220) + 'px';
        }
        inputText.addEventListener('input', autoResize);
        inputText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
        });
        attachToggle.addEventListener('click', () => {
            const show = extraPanel.style.display === 'none' || extraPanel.style.display === '';
            extraPanel.style.display = show ? 'block' : 'none';
        });

        return { modal, body, sendBtn, inputText, inputImageUrl, inputImageFile };
    }

    function createRenderer(bodyEl) {
        function downloadImage(src) {
            try {
                const fileNameFromUrl = () => {
                    try { const u = new URL(src); const path = u.pathname.split('/').pop() || 'image'; return path.split('?')[0]; } catch (_) { return 'image'; }
                };
                const name = `cogninote_${Date.now()}_${fileNameFromUrl()}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
                if (src.startsWith('data:')) {
                    const a = document.createElement('a');
                    a.href = src; a.download = name; a.rel = 'noopener';
                    document.body.appendChild(a); a.click(); a.remove();
                    return;
                }
                fetch(src).then(r => r.blob()).then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
                    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
                }).catch(() => {
                    const a = document.createElement('a'); a.href = src; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
                });
            } catch (e) {
                console.error('下载失败:', e);
            }
        }
        function renderContent(div, content) {
            try {
                if (Array.isArray(content)) {
                    content.forEach(seg => {
                        if (seg && seg.type === 'text') {
                            const p = document.createElement('p');
                            p.textContent = seg.text || '';
                            div.appendChild(p);
                        } else if (seg && seg.type === 'image_url' && seg.image_url && seg.image_url.url) {
                            const img = document.createElement('img');
                            img.src = seg.image_url.url; img.alt = 'image';
                            const wrap = document.createElement('div'); wrap.className = 'ai-img-wrap';
                            wrap.appendChild(img);
                            const btn = document.createElement('button'); btn.className = 'ai-img-download'; btn.textContent = '下载';
                            btn.addEventListener('click', (ev) => { ev.stopPropagation(); downloadImage(img.src); });
                            wrap.appendChild(btn);
                            div.appendChild(wrap);
                        } else if (seg && (seg.type === 'output_image' || seg.type === 'image') && (seg.image_base64 || seg.b64_json || seg.base64)) {
                            const base64 = seg.image_base64 || seg.b64_json || seg.base64;
                            const mime = seg.mime_type || 'image/png';
                            const img = document.createElement('img');
                            img.src = `data:${mime};base64,${base64}`; img.alt = 'image';
                            const wrap = document.createElement('div'); wrap.className = 'ai-img-wrap';
                            wrap.appendChild(img);
                            const btn = document.createElement('button'); btn.className = 'ai-img-download'; btn.textContent = '下载';
                            btn.addEventListener('click', (ev) => { ev.stopPropagation(); downloadImage(img.src); });
                            wrap.appendChild(btn);
                            div.appendChild(wrap);
                        } else if (seg && seg.url) {
                            const img = document.createElement('img');
                            img.src = seg.url; img.alt = 'image';
                            const wrap = document.createElement('div'); wrap.className = 'ai-img-wrap';
                            wrap.appendChild(img);
                            const btn = document.createElement('button'); btn.className = 'ai-img-download'; btn.textContent = '下载';
                            btn.addEventListener('click', (ev) => { ev.stopPropagation(); downloadImage(img.src); });
                            wrap.appendChild(btn);
                            div.appendChild(wrap);
                        } else {
                            const p = document.createElement('p');
                            p.textContent = typeof seg === 'string' ? seg : JSON.stringify(seg);
                            div.appendChild(p);
                        }
                    });
                    return;
                }
                if (typeof content === 'object' && content && (content.text || content.image || content.imageUrl || content.image_base64)) {
                    if (content.text) { const p = document.createElement('p'); p.textContent = content.text; div.appendChild(p); }
                    const url = content.imageUrl || content.image; const b64 = content.image_base64 || content.b64_json || content.base64;
                    if (url) {
                        const img = document.createElement('img'); img.src = url; img.alt = 'image';
                        const wrap = document.createElement('div'); wrap.className = 'ai-img-wrap';
                        wrap.appendChild(img);
                        const btn = document.createElement('button'); btn.className = 'ai-img-download'; btn.textContent = '下载';
                        btn.addEventListener('click', (ev) => { ev.stopPropagation(); downloadImage(img.src); });
                        wrap.appendChild(btn);
                        div.appendChild(wrap);
                    } else if (b64) {
                        const img = document.createElement('img'); img.src = `data:${content.mime_type || 'image/png'};base64,${b64}`; img.alt = 'image';
                        const wrap = document.createElement('div'); wrap.className = 'ai-img-wrap';
                        wrap.appendChild(img);
                        const btn = document.createElement('button'); btn.className = 'ai-img-download'; btn.textContent = '下载';
                        btn.addEventListener('click', (ev) => { ev.stopPropagation(); downloadImage(img.src); });
                        wrap.appendChild(btn);
                        div.appendChild(wrap);
                    }
                    return;
                }
                const text = String(content || '');
                const p = document.createElement('p'); p.textContent = text; div.appendChild(p);
                const mdMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^\)]+)\)/);
                const urlMatch = text.match(/https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)/i);
                const dataMatch = text.match(/^data:image\/(png|jpg|jpeg|gif|webp|svg);base64,[A-Za-z0-9+/=]+$/);
                const imgUrl = (mdMatch && mdMatch[1]) || (urlMatch && urlMatch[0]) || (dataMatch && dataMatch[0]);
                if (imgUrl) {
                    const img = document.createElement('img'); img.src = imgUrl; img.alt = 'image';
                    const wrap = document.createElement('div'); wrap.className = 'ai-img-wrap';
                    wrap.appendChild(img);
                    const btn = document.createElement('button'); btn.className = 'ai-img-download'; btn.textContent = '下载';
                    btn.addEventListener('click', (ev) => { ev.stopPropagation(); downloadImage(img.src); });
                    wrap.appendChild(btn);
                    div.appendChild(wrap);
                }
            } catch (e) {
                const p = document.createElement('p'); p.textContent = typeof content === 'string' ? content : JSON.stringify(content); div.appendChild(p);
            }
        }
        function addBubble(role, content) {
            const div = document.createElement('div');
            div.className = `ai-msg ${role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}`;
            renderContent(div, content);
            bodyEl.appendChild(div); bodyEl.scrollTop = bodyEl.scrollHeight;
        }
        function addError(text) { const div = document.createElement('div'); div.className = 'ai-msg ai-msg-error'; div.textContent = text; bodyEl.appendChild(div); bodyEl.scrollTop = bodyEl.scrollHeight; }
        return { addBubble, addError };
    }

    function createChatLogic({ body, sendBtn, inputText, inputImageUrl, inputImageFile }) {
        const { addBubble, addError } = createRenderer(body);
        const messages = [
            { role: 'system', content: '你是一个集成在 CogniNote Pro 的中文助理，擅长笔记整理、任务拆解与建议。尽量简洁清晰地回答。' }
        ];

        async function callOpenRouter(payload) {
            const apiKey = getApiKey();
            if (isLikelyInvalidKey(apiKey)) {
                throw new Error('未配置有效的 OpenRouter API Key');
            }
            const res = await fetch(`${OPENROUTER.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': (typeof location !== 'undefined' ? location.href : OPENROUTER.siteUrl),
                    'X-Title': OPENROUTER.siteTitle
                },
                body: JSON.stringify(payload)
            });
            const ct = res.headers.get('content-type') || '';
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`OpenRouter 请求失败: ${res.status} ${text}`);
            }
            if (!/application\/json/i.test(ct)) {
                const text = await res.text();
                throw new Error(`OpenRouter 返回非 JSON：content-type=${ct}；片段：${text.slice(0,200)}`);
            }
            return res.json();
        }

        async function callOpenRouterImages(payload) {
            const apiKey = getApiKey();
            if (isLikelyInvalidKey(apiKey)) {
                throw new Error('未配置有效的 OpenRouter API Key');
            }
            const res = await fetch(`${OPENROUTER.baseUrl}/images`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': (typeof location !== 'undefined' ? location.href : OPENROUTER.siteUrl),
                    'X-Title': OPENROUTER.siteTitle
                },
                body: JSON.stringify(payload)
            });
            const ctImg = res.headers.get('content-type') || '';
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`OpenRouter 生图请求失败: ${res.status} ${text}`);
            }
            if (!/application\/json/i.test(ctImg)) {
                const text = await res.text();
                throw new Error(`OpenRouter 生图返回非 JSON：content-type=${ctImg}；片段：${text.slice(0,200)}`);
            }
            return res.json();
        }

        // 意图与模型检测（自动路由）
        function isImageGenerationModel(name) {
            const m = (name || '').toLowerCase();
            return /(flux|stable-diffusion|sdxl|image-preview|midjourney|playground|images)/.test(m);
        }
        function isImageGenerationIntent(t) {
            const s = (t || '').toLowerCase();
            // 中文与英文关键词
            return /生成|生图|出图|绘制|画|制作(海报|logo|插画|banner)|photo|photorealistic|render|image|picture|logo|poster|illustration/.test(s);
        }
        function isVisualAnalysisIntent(t) {
            const s = (t || '').toLowerCase();
            return /识别|是什么|说明这张图|分析这张图|描述这张图|ocr|提取文字|看看这张图片|讲讲这张图片/.test(s);
        }

        // 新增：从文本中提取或推断图片比例（如 9:16 / 16:9 / 1:1）
        function detectAspectRatio(t) {
            const s = (t || '').replace(/[：]/g, ':');
            const m = s.match(/(?:比例|宽高比|aspect|ratio)?\s*(\d{1,2})\s*[:xX*]\s*(\d{1,2})/);
            if (m) return `${m[1]}:${m[2]}`;
            if (/竖版|竖向|竖屏|手机壁纸|抖音|快手/.test(s)) return '9:16';
            if (/横版|横向|横屏|宽屏/.test(s)) return '16:9';
            if (/正方形|方图/.test(s)) return '1:1';
            return null;
        }

        async function send() {
            const text = (inputText.value || '').trim();
            const imageUrl = (inputImageUrl && inputImageUrl.value || '').trim();
            let imageB64 = '';
            const file = (inputImageFile && inputImageFile.files && inputImageFile.files[0]) || null;
            if (!text) return;
            if (!navigator.onLine) {
                addError('当前离线，无法请求 OpenRouter');
                return;
            }
            if (file) {
                imageB64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const dataUrl = String(reader.result || '');
                            const m = dataUrl.match(/^data:image\/(png|jpg|jpeg|gif|webp|svg);base64,(.+)$/i);
                            resolve(m ? m[2] : dataUrl.replace(/^data:.*;base64,/, ''));
                        } catch (e) { resolve(''); }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            // 展示用户消息
            const userContent = imageB64 ? { text, image_base64: imageB64, mime_type: (file && file.type) || 'image/png' } : { text, imageUrl };
            addBubble('user', userContent);
            inputText.value = '';
            if (inputImageUrl) inputImageUrl.value = '';
            if (inputImageFile) inputImageFile.value = '';

            const oldText = sendBtn.textContent;
            sendBtn.textContent = '发送中...';
            sendBtn.disabled = true;

            try {
                const model = getModel();
                const mode = getMode(); // auto/chat/images
                // 决策是否走“生成图片”流程（通过 chat/completions + modalities）
                let useImages = false;
                if (mode === 'images') {
                    useImages = true;
                } else if (mode === 'chat') {
                    useImages = false;
                } else {
                    // 自动：有图片（URL 或 本地）则优先走“视觉理解”聊天；否则根据模型与指令判断生图
                    useImages = !(imageUrl || imageB64) && (isImageGenerationModel(model) && isImageGenerationIntent(text) || isImageGenerationIntent(text) && !isVisualAnalysisIntent(text));
                }

                if (useImages) {
                    // 使用统一 chat/completions 端点 + modalities 来生图（符合官方文档）
                    const aspect = detectAspectRatio(text);
                    const genMessages = [{ role: 'user', content: text }];
                    const payload = { model, messages: genMessages, modalities: ['image', 'text'] };
                    if (aspect) payload.image_config = { aspect_ratio: aspect };
                    const data = await callOpenRouter(payload);
                    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
                    if (msg && Array.isArray(msg.images) && msg.images.length) {
                        const parts = [];
                        if (msg.content) parts.push({ type: 'text', text: msg.content });
                        msg.images.forEach(img => {
                            if (img && img.type === 'image_url' && img.image_url && img.image_url.url) {
                                parts.push({ type: 'image_url', image_url: { url: img.image_url.url } });
                            } else if (img && img.url) {
                                parts.push({ type: 'image_url', image_url: { url: img.url } });
                            }
                        });
                        addBubble('assistant', parts.length ? parts : (msg.content || '（模型已生成图片，但解析失败）'));
                        messages.push({ role: 'assistant', content: msg.content || '' });
                        return;
                    } else {
                        // 未返回 images 字段，退回文本展示
                        const replyText = (msg && msg.content) || '（模型未返回图片，仅文本）';
                        addBubble('assistant', replyText);
                        messages.push({ role: 'assistant', content: replyText });
                        return;
                    }
                }

                // 聊天模式（支持图片URL片段）
                let content;
                if (imageB64) {
                    content = [
                        { type: 'text', text },
                        { type: 'input_image', image_base64: imageB64, mime_type: (file && file.type) || 'image/png' }
                    ];
                } else if (imageUrl) {
                    content = [
                        { type: 'text', text },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ];
                } else {
                    content = text;
                }
                messages.push({ role: 'user', content });
                const payload = { model, messages };
                const data = await callOpenRouter(payload);
                const msg = data && data.choices && data.choices[0] && data.choices[0].message;
                if (msg && Array.isArray(msg.images) && msg.images.length) {
                    const parts = [];
                    if (msg.content) parts.push({ type: 'text', text: msg.content });
                    msg.images.forEach(img => {
                        if (img && img.type === 'image_url' && img.image_url && img.image_url.url) {
                            parts.push({ type: 'image_url', image_url: { url: img.image_url.url } });
                        } else if (img && img.url) {
                            parts.push({ type: 'image_url', image_url: { url: img.url } });
                        }
                    });
                    addBubble('assistant', parts);
                    messages.push({ role: 'assistant', content: msg.content || '' });
                } else {
                    const reply = (msg && msg.content) || '（无响应内容）';
                    messages.push({ role: 'assistant', content: reply });
                    addBubble('assistant', reply);
                }
            } catch (err) {
                console.error(err);
                const msg = String((err && err.message) || err || '');
                if (/401/.test(msg)) {
                    addError('认证失败（401）。请在“设置 > AI 助手”中填写有效的 OpenRouter API Key。');
                } else if (/未配置有效的 OpenRouter API Key/.test(msg)) {
                    addError('未配置有效的 OpenRouter API Key。请在“设置 > AI 助手”中填写有效密钥。');
                } else {
                    addError('请求失败：' + msg);
                }
            } finally {
                sendBtn.disabled = false;
                sendBtn.textContent = oldText;
            }
        }

        sendBtn.addEventListener('click', send);
    }

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        try {
            injectAIStyles();
            const refs = createAIChatDOM();
            createChatLogic(refs);
            console.log('🤖 AI 对话窗口已注入（OpenRouter）- 标准聊天布局');
        } catch (e) {
            console.error('AI 对话窗口初始化失败：', e);
        }
    });
})();