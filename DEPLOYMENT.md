# CogniNote Pro - Vercel 部署指南

## 📋 部署前准备

### 1. 环境要求
- Node.js 18+ 
- Git 版本控制
- GitHub 账户
- Vercel 账户
- Supabase 项目

### 2. 项目文件检查
确保以下文件已正确配置：
- ✅ `vercel.json` - Vercel 部署配置
- ✅ `package.json` - 项目依赖和脚本
- ✅ `.env.example` - 环境变量模板
- ✅ `config/supabase.js` - Supabase 配置

## 🚀 部署步骤

### 第一步：准备代码仓库

1. **初始化 Git 仓库**（如果还没有）：
```bash
git init
git add .
git commit -m "Initial commit: CogniNote Pro ready for deployment"
```

2. **推送到 GitHub**：
```bash
git remote add origin https://github.com/your-username/CogniNote-pro.git
git branch -M main
git push -u origin main
```

### 第二步：配置 Vercel 项目

1. **登录 Vercel**：
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub 账户登录

2. **创建新项目**：
   - 点击 "New Project"
   - 选择 GitHub 仓库 `CogniNote-pro`
   - 点击 "Import"

3. **配置项目设置**：
   - **Project Name**: `cogninote-pro`
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - **Build Command**: 留空（静态站点）
   - **Output Directory**: `./`
   - **Install Command**: 留空

### 第三步：配置环境变量

在 Vercel 项目设置中添加以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_NAME=CogniNote Pro
NEXT_PUBLIC_APP_VERSION=1.0.0
NODE_ENV=production
```

### 第四步：部署验证

1. **自动部署**：
   - Vercel 会自动开始部署
   - 等待部署完成（通常 1-2 分钟）

2. **访问应用**：
   - 部署完成后，Vercel 会提供访问链接
   - 默认格式：`https://cogninote-pro.vercel.app`

3. **功能测试**：
   - 测试用户注册/登录
   - 测试笔记创建/编辑
   - 测试项目管理功能
   - 验证数据持久化

## 🔧 高级配置

### 自定义域名

1. **在 Vercel 项目设置中**：
   - 进入 "Domains" 选项卡
   - 添加自定义域名
   - 配置 DNS 记录

2. **SSL 证书**：
   - Vercel 自动提供 SSL 证书
   - 支持自动续期

### 性能优化

1. **缓存策略**：
   - 静态资源缓存：1年
   - HTML 文件：无缓存
   - API 响应：根据需要配置

2. **CDN 分发**：
   - Vercel 全球 CDN 自动启用
   - 支持边缘计算

### 监控和分析

1. **Vercel Analytics**：
   - 在项目设置中启用
   - 查看访问统计和性能指标

2. **错误监控**：
   - 配置 Sentry（可选）
   - 监控生产环境错误

## 🔄 持续部署

### 自动部署

- **主分支推送**：自动触发生产环境部署
- **功能分支**：自动创建预览部署
- **Pull Request**：自动生成预览链接

### 部署回滚

如果部署出现问题：
1. 在 Vercel 控制台找到上一个稳定版本
2. 点击 "Promote to Production"
3. 确认回滚操作

## 📝 部署检查清单

部署完成后，请验证以下功能：

- [ ] 应用正常加载，无 JavaScript 错误
- [ ] 用户注册功能正常
- [ ] 用户登录功能正常
- [ ] 笔记创建和编辑功能正常
- [ ] 项目管理功能正常
- [ ] 数据在 Supabase 中正确保存
- [ ] 响应式设计在移动端正常
- [ ] 页面加载速度满意
- [ ] SSL 证书正常工作
- [ ] 自定义域名（如配置）正常访问

## 🆘 常见问题

### 部署失败

1. **检查构建日志**：
   - 在 Vercel 控制台查看详细错误信息
   - 确认所有文件路径正确

2. **环境变量问题**：
   - 确认所有必需的环境变量已配置
   - 检查变量名称拼写

3. **Supabase 连接问题**：
   - 验证 Supabase URL 和 API 密钥
   - 确认 Supabase 项目状态正常

### 功能异常

1. **用户认证问题**：
   - 检查 Supabase Auth 配置
   - 验证重定向 URL 设置

2. **数据库操作失败**：
   - 确认数据库表结构正确
   - 检查 RLS 策略配置

## 📞 技术支持

如果遇到部署问题，可以：
1. 查看 Vercel 官方文档
2. 检查 Supabase 状态页面
3. 在项目 GitHub 仓库提交 Issue

---

**部署成功后，您的 CogniNote Pro 应用就可以在全球范围内访问了！** 🎉