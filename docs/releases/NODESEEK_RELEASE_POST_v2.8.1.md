# NodeSeek v2.8.1 发布帖

标题：`[开源/油猴] NodeSeek 用户 AI 画像 v2.8.1：悬停速览、私信直达与多标签性能修复`

正文：

**NodeSeek 用户 AI 画像 v2.8.1** 已经在 GitHub 和 Greasy Fork 发布。

这一版主要不是继续增加 AI 分析负载，而是完善日常浏览体验，并处理大量 NodeSeek 标签页同时打开时的性能问题。

安装与源码：

- **Greasy Fork（推荐）：** [NodeSeek 用户 AI 画像 - DeepSeek / OpenAI](https://greasyfork.org/zh-CN/scripts/591948-nodeseek-%E7%94%A8%E6%88%B7-ai-%E7%94%BB%E5%83%8F-deepseek-openai)
- **GitHub：** [yellow13441/nodeseek-ai-profile](https://github.com/yellow13441/nodeseek-ai-profile)
- **v2.8.1 Release：** [GitHub Release](https://github.com/yellow13441/nodeseek-ai-profile/releases/tag/v2.8.1)
- **Raw 脚本：** [nodeseek-ai-profile.user.js](https://raw.githubusercontent.com/yellow13441/nodeseek-ai-profile/main/nodeseek-ai-profile.user.js)
- **完整更新记录：** [CHANGELOG.md](https://github.com/yellow13441/nodeseek-ai-profile/blob/main/CHANGELOG.md)

> 本工具只整理公开论坛资料，不是 NodeSeek 官方信用评分，也不能替代交易中介、身份核验或你自己的判断。

---

## 👤 新增可选的悬停账号速览

在 `设置 → 页面增强` 中可以手动开启“悬停账号速览”。

开启后，把鼠标停在用户名旁的 `AI 画像` 按钮约 0.5 秒，会显示一张紧凑账号卡：

- Lv1–Lv6 使用不同等级色，Lv1 是红色，Lv6 是紫蓝渐变；
- 注册天数、鸡腿、星尘根据数值区间显示不同强调色；
- 主题与评论保留为次要信息，不和等级争夺注意力；
- 如果同一次账号响应里已经有关注 / 粉丝数量，会在底部低调显示；
- 卡片不再重复展示“30 分钟缓存、几点读取、未调用 AI”等说明，这些信息统一放在设置页。

这个功能默认关闭，因为它会额外读取 NodeSeek 的公开账号接口。开启后也有请求保护：同一 UID 复用 30 分钟缓存、并发自动合并、请求单并发、至少间隔 1 秒、每分钟最多 8 个，遇到 403 / 429 后会进入冷却。

如果检测到 Nodeseek Pro 已经接管同一作者资料，本脚本不会自动重复请求，只会说明兼容状态，并保留一次明确的手动加载入口。

---

## 🔗 主题、评论和私信可以直接点

悬停卡底部现在有三个直接入口：

- 点击主题数量：打开该用户的 `/space/{uid}#/discussions`；
- 点击评论数量：打开该用户的 `/space/{uid}#/comments`；
- 点击 `✉ 私信`：打开 `/notification#/message?mode=talk&to={uid}`，直接进入与该用户的站内对话。

三个入口都会在新标签页打开，不会把当前正在阅读或回复的帖子覆盖掉。

---

## 📅 修复注册天数稳定少一天

旧算法把实际经过时间向下取整，所以论坛显示“加入 16 天”时，插件经常显示 15 天。

v2.8.1 改为与 NodeSeek 当前展示更一致的注册日口径。已经存在的账号缓存也会根据 `createdAt` 动态重新计算，不需要手动清缓存或等待 30 分钟。

---

## ⚡ 多标签页性能修复

此前版本有两个会在大量 NodeSeek 标签页中被明显放大的常驻开销：

1. 作者按钮更新可能触发 MutationObserver，再次扫描整页，形成脚本 UI 自己触发自己的循环；
2. 每个 NodeSeek 标签页都会每 1.8 秒枚举一次 Tampermonkey 全部存储，用来查找跨刷新任务。

v2.8.1 已经重构这两条路径：

- 只扫描新加入的作者子树，忽略脚本自身 UI 的 DOM 变化；
- 按钮内容没变化时不重复写 DOM；
- 隐藏标签页暂停 DOM 观察与注入；
- 跨页面任务主要使用变更事件和 UID / mode 定向读取；
- 只有已经知道存在活动任务时才保留低频兜底检查；
- 临时任务窗口的全量扫描、进度广播和 DOM 重绘全部降频或去重；
- 临时窗口关闭前再确认一次队列，避免遗漏刚启动的第二个任务。

本地真实 DOM 压力测试使用 100 个不同用户和动态新增作者：页面稳定后没有持续 GM 存储读写、没有全量枚举、没有常驻普通页面轮询，也没有 MutationObserver 自激循环。

---

## 🧩 Nodeseek Pro 兼容修复

同时开启 Nodeseek Pro 和本脚本时，过去可能在同一个作者后面出现两个 `AI 画像` 按钮。

v2.8.1 改为按作者锚点登记和复用自己的按钮，并清理重复实例；账号速览同时识别 Nodeseek Pro 已经发起的资料读取，尽量避免两个脚本短时间访问相同接口。

---

## 本次验证

- Userscript JavaScript 语法检查通过；
- 完整 smoke test 通过；
- 100 用户真实 DOM 压力测试通过；
- Lv1 / Lv6 等级色、注册天数与数值分级测试通过；
- 主题、评论、私信直达路由测试通过；
- 多任务定向唤醒、并发接管、取消竞态与关闭前队列确认测试通过；
- Git whitespace 与敏感信息扫描通过。

如果升级后仍遇到 Tampermonkey CPU 长时间异常、按钮重复、悬浮请求过多或私信入口不正确，欢迎在 GitHub Issue 或帖子中反馈。为了方便复现，最好附上浏览器版本、同时启用的脚本、操作路径和脱敏截图，不要粘贴 API Key、Cookie 或图床删除凭据。
