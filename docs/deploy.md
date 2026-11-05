# 部署到 Cloudflare（免费）

> English version below.

部署完成后会得到一个网址，例如 `https://lazy-guild.<你的子域名>.workers.dev`。它是**一个** Cloudflare Worker，同时提供：

- 网页 App（`/`）
- 推送服务（`/api/*`），每分钟检查一次该给谁发通知

全部在 Cloudflare 免费额度内，每月 0 元。推送密钥会在第一次运行时自动生成，数据库也会由部署流程自动创建，**你不需要在电脑上装任何东西**。

## 你要做的事（大约 10 分钟）

### 1. 注册 Cloudflare

打开 <https://dash.cloudflare.com/sign-up>，用邮箱注册并验证邮箱。

### 2. 开通 workers.dev 子域名（只需一次）

1. 登录后，左侧菜单点 **Compute (Workers)**（有的界面叫 **Workers & Pages**）。
2. 第一次进入时会让你选一个子域名，例如 `ray`。以后的网址就是 `https://lazy-guild.ray.workers.dev`。

### 3. 创建 API 令牌

1. 右上角头像 → **My Profile** → 左侧 **API Tokens** → **Create Token**。
2. 找到模板 **Edit Cloudflare Workers**，点 **Use template**。
3. 在 **Permissions** 里点 **+ Add more**，加一行：**Account** · **D1** · **Edit**。
4. **Account Resources** 选你的账号；**Zone Resources** 选 **All zones**（或保持默认）。
5. 点 **Continue to summary** → **Create Token**，**复制令牌**（只显示一次）。

### 4. 找到 Account ID

回到 **Compute (Workers)** 页面，右侧栏有 **Account ID**，点复制。

### 5. 把这两个值放进 GitHub

1. 打开 <https://github.com/Yokiwa/lazy-guild/settings/secrets/actions>（仓库 → **Settings** → **Secrets and variables** → **Actions**）。
2. 点 **New repository secret**，名字 `CLOUDFLARE_API_TOKEN`，值是第 3 步的令牌。
3. 再点一次，名字 `CLOUDFLARE_ACCOUNT_ID`，值是第 4 步的 Account ID。

### 6. 部署

- 每次代码合并到 `main`、测试通过后，会自动部署。
- 想马上部署：打开仓库的 **Actions** → 左边选 **Deploy** → **Run workflow**。

部署日志最后一步 **Deploy worker** 里会打印网址（`https://lazy-guild.….workers.dev`）。用 iPhone 的 Safari 打开，再按 [iPhone 使用指南](iphone-guide.md) 添加到主屏幕。

## 常见问题

| 现象 | 怎么办 |
|---|---|
| Deploy 显示 “Cloudflare secrets are not set” | 第 5 步的两个 secret 没填，或者名字拼错 |
| `Authentication error` / `10000` | 令牌权限不够：确认有 Workers Scripts Edit 和 **D1 Edit** |
| `You need a workers.dev subdomain` | 第 2 步没做 |
| 网页能开，但设置里显示“不支持推送” | iPhone 要先添加到主屏幕，并且系统是 iOS 16.4 及以上 |
| 收不到通知 | 设置页看通知状态是不是“已开启，已同步”；iPhone 的 设置 → 通知 → 懒人公会 是否允许 |

## 本地开发

```bash
pnpm install
pnpm --filter @lazy-guild/push-worker migrate:local
pnpm --filter @lazy-guild/push-worker dev          # 推送服务 http://localhost:8787
VITE_PUSH_API=/api pnpm dev                         # 网页 http://localhost:5173，/api 自动转发到 8787
```

不需要推送的话，直接 `pnpm dev` 就行，设置页会显示“未配置推送服务”。

---

# Deploying to Cloudflare (free)

The app and its push API run as a single Cloudflare Worker on the free plan. Push keys are generated on first run and the D1 database is created by the deploy workflow, so nothing needs to be installed locally.

1. Sign up at <https://dash.cloudflare.com/sign-up>.
2. Open **Compute (Workers)** once and pick a `workers.dev` subdomain.
3. **My Profile → API Tokens → Create Token**, use the **Edit Cloudflare Workers** template and add **Account · D1 · Edit**. Copy the token.
4. Copy your **Account ID** from the Workers overview sidebar.
5. In GitHub → **Settings → Secrets and variables → Actions**, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
6. Merge to `main` (or run **Actions → Deploy → Run workflow**). The last step prints the URL.

Local development: see the commands above.
