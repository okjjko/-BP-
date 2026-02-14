# 🚀 部署指南 - 植物大战僵尸 BP 对战工具

本文档介绍如何将项目部署到 Vercel，实现远程访问。

---

## 📋 部署前准备

确保你的电脑已安装：
- Node.js (建议 v18+)
- npm 或 yarn
- Git

---

## 🔧 方法一：通过 Vercel 网站部署（最简单）

### 步骤 1：注册 Vercel 账号
1. 访问 [vercel.com](https://vercel.com)
2. 点击 "Sign Up" 注册
3. 推荐使用 GitHub 账号登录（方便后续自动部署）

### 步骤 2：导入项目
1. 登录后点击 "Add New Project"
2. 选择 "Import Git Repository"
3. 如果项目已推送到 GitHub，直接选择仓库
4. 如果没有，选择 "Upload" 上传项目文件夹

### 步骤 3：配置项目
Vercel 会自动检测到 Vite 项目，配置如下：
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

直接点击 "Deploy" 即可！

### 步骤 4：等待部署
- 首次部署大约需要 1-2 分钟
- 完成后会得到一个 `https://你的项目名.vercel.app` 的域名

---

## ⚡ 方法二：通过 Vercel CLI 部署（最快）

### 步骤 1：安装 Vercel CLI
```bash
npm install -g vercel
```

### 步骤 2：登录
```bash
vercel login
```
按照提示选择登录方式（推荐 GitHub）

### 步骤 3：在项目目录部署
```bash
# 进入项目目录
cd "d:\.文档\pvz\麦版文档\神秘小工具\bp图形化工具"

# 开始部署
vercel
```

首次部署会问你几个问题：
```
? Set up and deploy "~/bp-tool"? [Y/n] y
? Which scope do you want to deploy to? (选择你的账号)
? Link to existing project? [y/N] n
? What's your project's name? (输入项目名，如：bp-tool)
? In which directory is your code located? ./
? Want to override the settings? [y/N] n
```

### 步骤 4：完成！
部署成功后会显示：
```
✅ Production: https://bp-tool.vercel.app
```

---

## 🔄 方法三：连接 GitHub 自动部署（推荐长期使用）

适合场景：代码在 GitHub 上，每次 push 自动重新部署

### 步骤 1：推送代码到 GitHub
```bash
# 初始化 Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "准备部署到 Vercel"

# 推送到 GitHub
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin master
```

### 步骤 2：在 Vercel 导入
1. 登录 [vercel.com](https://vercel.com)
2. 点击 "Add New Project" → "Import Git Repository"
3. 选择刚才的仓库
4. 点击 "Deploy"

### 步骤 3：享受自动部署
以后每次 `git push`，Vercel 都会自动重新部署！

---

## ✅ 部署后验证

访问你的 Vercel 域名，测试以下功能：

1. ✅ 页面能否正常加载
2. ✅ BP 流程是否完整工作
3. ✅ 刷新页面后 localStorage 数据是否保留
4. ✅ 手机访问是否正常（响应式布局）
5. ✅ 植物图片是否显示

---

## 🎨 自定义域名（可选）

### 绑定自己的域名
1. 在 Vercel 项目设置中点击 "Domains"
2. 添加你的域名（如 `bp.yourdomain.com`）
3. 按照提示在域名服务商处配置 DNS：
   - 类型：CNAME
   - 名称：bp
   - 值：cname.vercel-dns.com

### 免费域名服务
如果不想买域名，可以使用免费服务：
- [EU.org](https://nic.eu.org/) - 完全免费，但申请较慢
- [Freenom](https://www.freenom.com/) - .tk .ml .ga 等免费域名

---

## 🔒 环境变量（如需要）

如果项目需要环境变量：

1. 在 Vercel 项目设置中点击 "Environment Variables"
2. 添加变量名和值
3. 重新部署后生效

**注意**：本项目当前不需要环境变量。

---

## 📊 监控和分析

Vercel 提供免费的分析工具：
- 访问量统计
- 性能监控
- 错误日志

在 Vercel 项目的 "Analytics" 标签页查看。

---

## ❓ 常见问题

### Q: 部署后页面空白？
**A**: 检查浏览器控制台是否有错误。可能是：
- 路径问题（确保 `vercel.json` 的 rewrites 配置正确）
- 构建失败（查看 Vercel 部署日志）

### Q: 图片无法加载？
**A**: 检查：
- 图片路径是否正确（使用 `/` 开头的绝对路径）
- 图片文件是否已推送到仓库

### Q: 国内访问太慢？
**A**: 可以考虑：
1. 使用国内 CDN 加速（如 Cloudflare）
2. 换成腾讯云/阿里云等国内平台
3. 压缩图片资源

### Q: 如何更新部署？
**A**:
- **方法 1/2**：重新执行部署命令
- **方法 3**：直接 `git push`，Vercel 自动部署

---

## 🎉 完成！

现在圈子内的人就可以通过 Vercel 提供的域名访问你的 BP 工具了！

分享链接格式：`https://你的项目名.vercel.app`

---

## 📞 需要帮助？

- Vercel 官方文档：https://vercel.com/docs
- Vercel 支持：https://vercel.com/support
