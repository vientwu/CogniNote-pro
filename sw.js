// CogniNote Pro Service Worker
// 版本号
const CACHE_VERSION = 'cogninote-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// 需要缓存的静态资源
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/config/supabase.js',
    '/api/database.js',
    '/utils/migration.js',
    '/utils/onboarding.js',
    '/utils/offline-cache.js',
    '/utils/data-migration.js',
    '/utils/backup-restore.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 不应该被缓存的 URL 模式
const UNCACHEABLE_PATTERNS = [
    /\/auth\//,
    /\/api\/.*\/(login|register|logout)/,
    /supabase\.co/,
    /\.supabase\.co/
];

// Service Worker 安装事件
self.addEventListener('install', event => {
    console.log('Service Worker 正在安装...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('正在缓存静态资源...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('静态资源缓存完成');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('静态资源缓存失败:', error);
            })
    );
});

// Service Worker 激活事件
self.addEventListener('activate', event => {
    console.log('Service Worker 正在激活...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('删除旧缓存:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker 激活完成');
                return self.clients.claim();
            })
    );
});

// 网络请求拦截
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // 只处理 GET 请求的缓存
    if (request.method !== 'GET') {
        console.log(`跳过非 GET 请求: ${request.method} ${request.url}`);
        return; // 让非 GET 请求直接通过，不进行缓存处理
    }
    
    // 检查是否为不应缓存的 URL
    const shouldNotCache = UNCACHEABLE_PATTERNS.some(pattern => pattern.test(request.url));
    if (shouldNotCache) {
        console.log(`跳过不可缓存的 URL: ${request.url}`);
        return; // 让这些请求直接通过
    }
    
    // 对于可缓存的 GET 请求，使用缓存策略
    event.respondWith(handleRequest(request));
});

// 处理请求的主要函数
async function handleRequest(request) {
    try {
        // 首先尝试从缓存获取
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            console.log(`从缓存返回: ${request.url}`);
            
            // 对于动态内容，在后台更新缓存
            if (!isStaticAsset(request.url)) {
                updateCacheInBackground(request);
            }
            
            return cachedResponse;
        }
        
        // 缓存中没有，从网络获取
        console.log(`从网络获取: ${request.url}`);
        const networkResponse = await fetch(request);
        
        // 只缓存成功的响应
        if (networkResponse.ok) {
            await updateCache(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error(`请求失败: ${request.url}`, error);
        
        // 如果是导航请求且网络失败，返回离线页面
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match('/index.html');
            if (offlineResponse) {
                return offlineResponse;
            }
        }
        
        // 其他情况抛出错误
        throw error;
    }
}

// 检查是否为静态资源
function isStaticAsset(url) {
    return STATIC_ASSETS.some(asset => url.includes(asset)) ||
           url.includes('.css') ||
           url.includes('.js') ||
           url.includes('.png') ||
           url.includes('.jpg') ||
           url.includes('.svg') ||
           url.includes('.woff') ||
           url.includes('.woff2');
}

// 更新缓存
async function updateCache(request, response) {
    try {
        const cacheName = isStaticAsset(request.url) ? STATIC_CACHE : DYNAMIC_CACHE;
        const cache = await caches.open(cacheName);
        await cache.put(request, response);
        console.log(`已缓存: ${request.url}`);
    } catch (error) {
        console.error(`缓存更新失败: ${request.url}`, error);
    }
}

// 在后台更新缓存
async function updateCacheInBackground(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            await updateCache(request, response);
        }
    } catch (error) {
        console.log(`后台缓存更新失败: ${request.url}`, error);
    }
}

// 消息处理
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            console.log('所有缓存已清除');
            event.ports[0].postMessage({ success: true });
        }).catch(error => {
            console.error('清除缓存失败:', error);
            event.ports[0].postMessage({ success: false, error: error.message });
        });
    }
});

// 错误处理
self.addEventListener('error', event => {
    console.error('Service Worker 错误:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker 未处理的 Promise 拒绝:', event.reason);
});

console.log('Service Worker 已加载');