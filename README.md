# 🎮 minecraft-notifier

[![npm](https://img.shields.io/npm/v/koishi-plugin-minecraft-notifier?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-minecraft-notifier)
[![downloads](https://img.shields.io/npm/dm/koishi-plugin-minecraft-notifier?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-minecraft-notifier)
[![license](https://img.shields.io/github/license/pynickle/koishi-plugin-minecraft-notifier?style=flat-square)](LICENSE)

## 🌌 插件简介

**koishi-plugin-minecraft-notifier** 是一个为 Koishi 机器人框架设计的 Minecraft 版本更新通知插件。它能够定期检测 Mojang 官方发布的最新 Minecraft 版本，自动抓取更新日志并通过 AI 生成结构化中文摘要，及时通知玩家新版本信息，同时支持生成 PCL 启动器可用的 XAML 文件。

## ✨ 功能特性

- 🔍 **版本更新检测**：定期从 Mojang 官方 API 获取最新版本信息，支持正式版和快照版
- 📝 **更新日志处理**：自动抓取并解析官方更新日志，转换为结构化格式
- 🤖 **AI 摘要生成**：调用 AI 模型生成高质量中文更新摘要，按类别清晰呈现
- 📢 **多渠道通知**：配置通知频道，自动发送版本更新消息
- 📱 **PCL 启动器支持**：生成 XAML 文件供 PCL 启动器使用，展示更新摘要
- 📊 **历史版本管理**：数据库存储版本历史和文章内容
- 🎯 **手动触发检查**：提供命令手动触发版本检查
- 🌍 **多语言支持**：支持多种语言的更新日志处理

## 📋 命令列表

| 命令               | 说明                      | 权限要求            |
|--------------------|---------------------------|---------------------|
| `mc.version`       | 查询当前最新的 Minecraft 版本信息 | 所有人             |
| `mc.trigger`       | 手动触发版本检查          | 管理员             |

## 🚀 使用指南

### 安装插件

```bash
npm install koishi-plugin-minecraft-notifier
```

或在插件商城中搜索 `minecraft-notifier` 进行安装。

## 🛠️ 配置选项

| 配置项               | 类型       | 默认值        | 说明                    |
|-------------------|----------|------------|-----------------------|
| `notifyChannels`  | string[] | `[]`       | 接收版本更新通知的频道列表         |
| `checkInterval`   | number   | `3600000`  | 版本检查间隔（毫秒），默认1小时      |
| `apiKey`          | string   | `''`       | AI 模型 API 密钥（必填）      |
| `aiProvider`      | string   | `'openai'` | 提供商类型：`openai` 或 `openai-compatible` |
| `baseApiUrl`      | string   | `https://api.openai.com/v1` | OpenAI 兼容接口基础地址 |
| `providerName`    | string   | `''`       | 兼容提供商标识（可选）        |
| `organization`    | string   | `''`       | OpenAI Organization（可选） |
| `project`         | string   | `''`       | OpenAI Project（可选）      |
| `model`           | string   | `'gpt-5'`  | 默认模型（当 `models` 为空时使用） |
| `models`          | string[] | `[]`       | 候选模型列表，按顺序自动回退    |
| `temperature`     | number   | `0.8`      | 采样温度（0-2）            |
| `maxOutputTokens` | number   | `4096`     | 单次输出最大 token          |
| `timeoutMs`       | number   | `45000`    | AI 请求超时时间（毫秒）      |
| `maxRetries`      | number   | `2`        | AI SDK 层重试次数           |
| `enableWebSearch` | boolean  | `true`     | 启用 OpenAI Web Search 工具 |
| `enableSnapshot`  | boolean  | `true`     | 是否检测快照版本              |
| `enableXaml`      | boolean  | `true`     | 是否生成 XAML 文件          |
| `xamlOutputPath`  | string   | `'./xaml'` | XAML 文件输出路径           |
| `webServerPort`   | number   | `8080`     | XAML 文件 HTTP 服务端口     |
| `gitRepoUrl`      | string   | `''`       | Git 仓库地址，用于上传 XAML 文件 |
| `gitBranch`       | string   | `'main'`   | Git 仓库分支              |
| `translateApiKey` | string   | `''`       | 翻译服务 API 密钥           |

## 📝 注意事项

- 插件需要配置 AI API 密钥才能生成更新摘要
- 快照版本检测可能会有延迟
- 自动发送通知需要正确配置通知频道
- 首次运行会立即检查一次版本信息

## 🤝 贡献指南

欢迎提交 Issue 或 Pull Request 来帮助改进这个插件！

## 📄 许可证

本项目采用 AGPL v3.0 许可证 - 详情请查看 [LICENSE](LICENSE) 文件
