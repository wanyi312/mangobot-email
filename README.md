# Mangobot Email Service

基于 Cloudflare Workers 和 Resend 构建的无服务器邮件服务，支持邮件订阅管理和自动转发功能。

## 功能特性

1. **邮件发送** - 通过 Resend API 发送邮件
2. **订阅管理** - 用户可以订阅和取消订阅邮件列表
3. **邮件自动转发** - 接收指定发件人的邮件，自动转发给所有订阅者（实时触发，无需轮询）

## 架构说明

- **Cloudflare Workers** - 处理 HTTP API 请求
- **Email Workers** - 接收入站邮件并实时转发
- **Cloudflare KV** - 存储订阅者列表和已处理邮件 ID
- **Resend** - 邮件发送服务

## 环境准备

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.dev.vars.example` 到 `.dev.vars` 并填入实际值：

```bash
cp .dev.vars.example .dev.vars
```

需要配置的环境变量：

- `RESEND_API_KEY` - `/api/send` 接口使用的 Resend API 密钥
- `SENDER_EMAIL` - `/api/send` 接口使用的发件人邮箱（可选，默认为 `onboarding@resend.dev`）
- `FORWARD_RESEND_API_KEY` - 订阅转发使用的 Resend API 密钥（可选，默认回退到 `RESEND_API_KEY`）
- `FORWARD_SENDER_EMAIL` - 订阅转发邮件使用的发件人邮箱（可选，默认回退到 `SENDER_EMAIL`）

### 3. 创建 KV 命名空间

```bash
wrangler kv:namespace create PROCESSED_EMAILS
wrangler kv:namespace create SUBSCRIBERS
```

将返回的 namespace ID 填入 `wrangler.toml` 中对应的位置。

### 4. 配置 Cloudflare Email Routing

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择你的域名
3. 进入 **Email** > **Email Routing**
4. 启用 Email Routing 并验证域名
5. 创建一个邮箱地址（如 `inbox@yourdomain.com`）
6. 在 **Email Workers** 中绑定到这个 Worker

## 本地开发

启动本地开发服务器：

```bash
npm run dev
```

服务将运行在 `http://localhost:8787`。

注意：本地开发时 Email Worker 无法测试，需要部署到 Cloudflare 后才能接收真实邮件。

## API 接口

### 1. 发送邮件

**端点:** `POST /api/send`

**请求体:**
```json
{
  "to": "recipient@example.com",
  "subject": "Hello World",
  "html": "<p>This is a test email.</p>",
  "text": "This is a test email."
}
```

**响应:**
```json
{
  "message": "Email sent successfully",
  "id": "re_123..."
}
```

### 2. 订阅邮件

**端点:** `POST /api/subscribe`

**请求体:**
```json
{
  "email": "user@example.com"
}
```

**响应:**
```json
{
  "message": "Subscription successful"
}
```

### 3. 取消订阅

**端点:** `GET /api/cancel`

**参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| email | string | 要取消订阅的邮箱地址 |

**示例:**
```
GET /api/cancel?email=user@example.com
```

**响应:**
```json
{
  "message": "Cancel subscription successful"
}
```

## 邮件转发工作流程

1. 发件人发送邮件到你的 Cloudflare 域名邮箱（如 `inbox@yourdomain.com`）
2. Email Worker 实时接收邮件
3. 检查发件人是否匹配 `FILTER_SENDER`（默认：`wy776723419@gmail.com`）
4. 检查邮件主题是否以 `FILTER_SUBJECT_PREFIX` 开头（默认：`mangobot最新`）
5. 检查邮件是否已处理（通过 Message-ID 去重）
6. 读取订阅者列表
7. 通过 Resend 转发给所有订阅者
8. 标记邮件为已处理（KV 中保存 30 天）

## 配置说明

在 `wrangler.toml` 中可以配置以下参数：

- `FILTER_SENDER` - 允许转发的发件人邮箱（默认: `wy776723419@gmail.com`）
- `FILTER_SUBJECT_PREFIX` - 邮件标题前缀过滤（默认: `mangobot最新`）

## 部署

### 部署到 Cloudflare Workers

```bash
wrangler deploy
```

### 配置 Email Routing

部署后，在 Cloudflare Dashboard 中：

1. 进入 **Email** > **Email Routing** > **Email Workers**
2. 点击 **Create** 创建新的 Email Worker 路由
3. 选择你的 Worker（`mangobot-email`）
4. 配置接收邮箱地址（如 `inbox@yourdomain.com`）

## 项目结构

```
mangobot-email/
├── src/
│   ├── index.js              # Worker 主入口（HTTP + Email）
│   └── handlers/
│       ├── send.js           # 邮件发送接口
│       ├── subscribe.js      # 订阅接口
│       └── cancel.js         # 取消订阅接口
├── public/
│   └── index.html            # 静态页面（可选）
├── wrangler.toml             # Cloudflare 配置
└── package.json
```

## 注意事项

1. Email Workers 只能接收发往你 Cloudflare 域名的邮件
2. 如果你想继续用 Gmail 收信，可以设置 Gmail 自动转发到 Cloudflare 邮箱
3. Resend 免费版限制：100 封/天，3000 封/月
4. 已处理的邮件 ID 在 KV 中保存 30 天后自动过期
5. 本地开发时无法测试 Email Worker，需要部署后才能接收真实邮件

## 从 Gmail 转发到 Cloudflare（可选）

如果你想保留 Gmail 作为主邮箱，可以设置自动转发：

1. 登录 Gmail
2. 进入 **设置** > **转发和 POP/IMAP**
3. 添加转发地址：`inbox@yourdomain.com`
4. 验证转发地址
5. 创建过滤器：
   - 发件人：`wy776723419@gmail.com`
   - 主题：包含 `mangobot最新`
   - 操作：转发到 `inbox@yourdomain.com`
