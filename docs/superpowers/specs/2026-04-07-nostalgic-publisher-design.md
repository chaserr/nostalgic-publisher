# 怀旧老歌公众号自动发布工具 — 设计文档

**日期**：2026-04-07  
**状态**：待实现

---

## 1. 产品概述

一款本地运行的 Mac 桌面应用，帮助「怀旧老歌」公众号运营者：
- 用 AI 自动生成「一首老歌 + 一段青春故事」的文章
- 在 App 内审查、编辑、排期
- 自动发布到微信公众号、今日头条（后续可扩展视频号、抖音等）

---

## 2. 技术栈

| 层级 | 技术选型 |
|------|----------|
| 桌面框架 | Electron |
| 前端 UI | React + TypeScript |
| 样式 | Tailwind CSS（支持深色/浅色模式） |
| 本地数据库 | SQLite（via better-sqlite3） |
| 定时任务 | node-cron |
| AI 内容生成 | Claude API（claude-sonnet-4-6） |
| 平台 API | 微信公众号 API、今日头条创作者 API |
| 打包 | electron-builder（输出 .dmg / .app） |

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────┐
│                  Electron Shell                  │
│  ┌───────────────────────────────────────────┐  │
│  │           React + TypeScript UI           │  │
│  │  Dashboard · 待审队列 · 编辑器 · 历史 · 设置 │  │
│  └───────────────────────────────────────────┘  │
│                       ↕                         │
│  ┌──────────────┐  ┌───────────┐  ┌──────────┐  │
│  │ 内容生成模块  │  │ 发布调度器 │  │ 平台连接器│  │
│  │ Claude API   │  │ node-cron │  │ 微信/头条 │  │
│  └──────────────┘  └───────────┘  └──────────┘  │
│                       ↕                         │
│  ┌───────────────────────────────────────────┐  │
│  │           SQLite 本地数据库               │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 4. 数据模型

### articles 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| song_name | TEXT | 歌曲名称 |
| year | INTEGER | 年份 |
| title | TEXT | 文章标题 |
| content | TEXT | 正文内容 |
| status | TEXT | pending / approved / published / rejected |
| tags | TEXT | JSON 数组，如 ["暗恋","90年代"] |
| scheduled_at | DATETIME | 计划发布时间（NULL=立即） |
| created_at | DATETIME | 生成时间 |
| published_at | DATETIME | 实际发布时间 |

### publish_records 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| article_id | INTEGER FK | 关联文章 |
| platform | TEXT | wechat / toutiao |
| status | TEXT | success / failed |
| platform_id | TEXT | 平台返回的文章 ID |
| published_at | DATETIME | 发布时间 |
| error | TEXT | 失败原因（可空） |

### platforms 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| name | TEXT | wechat / toutiao |
| access_token | TEXT | 加密存储 |
| refresh_token | TEXT | 加密存储 |
| expires_at | DATETIME | Token 过期时间 |
| enabled | INTEGER | 0/1 |

### settings 表
| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | 配置键 |
| value | TEXT | 配置值（JSON） |

关键配置项：`claude_api_key`、`auto_schedule`（cron 表达式）、`auto_generate_count`（每次批量生成数量）、`theme`（system/light/dark）

---

## 5. 主界面与导航

```
侧边栏（跟随系统深浅色，支持手动切换）
├── 仪表盘        — 待审数量、本周发布、即将发布列表
├── 待审队列      — 所有 pending 内容，支持批量操作
├── 编辑器        — 单篇审查/编辑（从待审队列进入）
├── 发布计划      — 日历视图，展示已排期内容
├── 发布历史      — 已发布记录，含各平台状态
└── 设置          — 平台账号、AI 参数、自动计划
```

---

## 6. 核心功能详述

### 6.1 内容生成

**批量自动生成**
- 用户在设置中配置 cron 表达式（如每天 07:00）和每次生成数量（如 3 篇）
- App 启动后后台运行，到时间自动调用 Claude API 生成
- 生成的内容状态为 `pending`，推送系统通知提醒审查

**手动生成**
- 用户在仪表盘或待审队列点击「生成新内容」
- 输入歌曲名称（可选），点击生成
- 若不填歌名，Claude 从内置歌曲库中随机选一首

**生成提示词结构**
```
角色：你是一个擅写青春故事的公众号创作者
任务：以《{歌名}》({年份}) 为背景音乐，写一个200字以内的青春故事
要求：
- 聚焦一个具体场景（暗恋/毕业/旅途等）
- 引用歌词一句
- 结尾以问句与读者互动
- 不写歌手生平，主角是读者自己的记忆
```

### 6.2 内容审查与编辑器

编辑器分左右两栏：

**左栏（内容）**
- 可编辑标题
- 富文本正文编辑（支持加粗、斜体）
- 字数统计
- 「重新生成」按钮（保留原内容直到确认）

**右栏（发布配置）**
- 平台选择（开关，可多选）
- 发布时间：「立即发布」或「定时发布」（日期时间选择器）
- 标签管理
- 底部：「通过并排期」/ 「拒绝」

### 6.3 定时发布调度

- 用 `node-cron` 每分钟检查一次 `approved` 状态且 `scheduled_at <= now` 的文章
- 依次调用各平台 API 发布
- 更新状态为 `published`，写入 `publish_records`
- 任一平台失败：状态标记为部分失败，保留其他平台发布记录，可手动重试

### 6.4 平台连接

**微信公众号**
- 授权方式：公众号不支持扫码 OAuth，需填入 AppID + AppSecret（在公众号后台「开发 → 基本配置」获取）。App 提供分步引导 UI，截图说明在哪里找到这两个值。
- App 调用 `/token` 接口自动获取并存储 access_token
- 发布流程：先上传草稿（`/draft/add`），再发布（`/freepublish/submit`）
- Token 自动刷新（有效期 2 小时，App 在过期前 10 分钟自动刷新）

> ⚠️ 注意：公众号自动发布 API 仅支持**服务号**，订阅号需手动发布。

**今日头条**
- 授权流程：OAuth 2.0 网页授权，App 内嵌 WebView 完成登录
- 发布流程：调用头条创作者开放平台 API 发布图文

### 6.5 主题与外观

- 默认跟随 macOS 系统深浅色设置（`prefers-color-scheme`）
- 顶部工具栏提供手动切换按钮（亮色 ☀️ / 暗色 🌙 / 自动 ⚡）
- 配置持久化到 `settings` 表

---

## 7. MVP 范围

**包含**
- [x] 内容生成（Claude API，手动 + 批量）
- [x] 待审队列与编辑器
- [x] 定时发布调度
- [x] 微信公众号发布
- [x] 今日头条发布
- [x] 深色/浅色主题
- [x] 本地 SQLite 数据持久化
- [x] 系统通知（生成完成、发布成功/失败）

**不包含（后续迭代）**
- [ ] 视频号、抖音等视频平台
- [ ] 视频内容自动生成
- [ ] 数据分析（阅读量、点赞数等）
- [ ] 多账号管理
- [ ] 云端同步

---

## 8. 关键约束与风险

| 风险 | 说明 | 应对 |
|------|------|------|
| 公众号 API 限制 | 自动发布仅限服务号 | 文档中明确告知用户，提供手动发布备用方案 |
| Token 过期 | 微信 access_token 2小时过期 | App 启动时检查，后台定时刷新 |
| 今日头条 API 审核 | 需申请创作者开放平台权限 | 提供申请引导文档，未授权时禁用该平台 |
| Claude API 费用 | 批量生成消耗 token | 在设置中限制每日最大生成数量，默认 5 篇 |

---

## 9. 项目目录结构（规划）

```
nostalgic-publisher/
├── electron/
│   ├── main.ts          # Electron 主进程
│   ├── preload.ts       # 预加载脚本
│   └── scheduler.ts     # node-cron 定时任务
├── src/
│   ├── components/      # React 组件
│   ├── pages/           # 页面（Dashboard, Queue, Editor, History, Settings）
│   ├── services/        # 业务逻辑（generator, publisher, platforms）
│   ├── db/              # SQLite 数据库操作
│   └── stores/          # 状态管理（Zustand）
├── docs/
│   └── superpowers/specs/
└── package.json
```
