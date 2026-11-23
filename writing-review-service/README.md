# UNLOCK 写作复盘服务

写作复盘沿用原来的四个栏目。教师选择学生，学生直接查看自己的复盘。服务端根据实际登录会话选择稿件。

## 部署

1. 将随本地接入候选生成的私有资料放在 `private/`，包括 `reviews.json` 及 `figures/`。如需指定教师下拉框中的排列顺序，可在私有资料的 `reviews.json` 中设置 `students`。缺原稿的条目在资料中保存为 `null`。
2. 从同一候选复制简体中文思源黑体 Regular 和 Bold 两份 TTF 到 `site/assets/fonts/`。页面引用 `SourceHanSansSC-Regular.ttf` 和 `SourceHanSansSC-Bold.ttf`。原许可证随服务提供。
3. 将 `UNLOCK_WRITING_ORIGIN` 配成实际的 HTTPS 地址。`UNLOCK_WRITING_ACCOUNT_FILE` 指向服务可读的私有账号文件。文件以 `teacher` 和各学生账号的小写形式为键。每个账号的 `salt` 是 16 字节随机盐的十六进制形式，`hash` 是密码经 Node.js `scrypt` 默认参数生成的 64 字节结果的十六进制形式。
4. 用 `node server.mjs` 启动。服务监听 `127.0.0.1`。`UNLOCK_WRITING_PORT` 可指定内部端口，默认 8796。反向代理应配置 TLS 并保留外部的 Host。用教师和学生账号实际登录验收后，把平台的写作复盘入口接到该服务的 `/writing-review.html`。如需回退，将入口恢复为原地址。

本地用 `node server.mjs --preview` 预览，访问启动日志给出的本机角色链接。公开仓库保存界面与服务代码，原稿、题图、批注、评分和账号放在私有服务端。
