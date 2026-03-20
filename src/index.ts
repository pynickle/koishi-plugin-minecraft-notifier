import { generateArticleUrl } from './helper/article-helper';
import { forceRefreshVersionArticle } from './changelog-summarizer';
import { checkMinecraftVersion } from './version-checker';
import fs from 'fs';
import { Context, Schema } from 'koishi';
import { promises } from 'node:fs';
import path from 'node:path';

export const name = 'minecraft-notifier';

export const inject = ['database', 'server'];

export interface LatestVersion {
  id: number;
  lastRelease: string;
  lastSnapshot: string;
}

export interface ArticleLatestVersion {
  id: number;
  lastRelease: string;
  lastSnapshot: string;
  releaseTryTime: number;
  snapshotTryTime: number;
  latestVersion: string;
}

export interface ArticleRecord {
  id: number;
  version: string;
  isSnapshot: boolean;
  articleUrl: string;
  articleContent: string;
}

declare module 'koishi' {
  interface Tables {
    minecraft_notifier: LatestVersion;
    minecraft_article_version: ArticleLatestVersion;
    minecraft_article_record: ArticleRecord;
  }
}

export interface Config {
  checkInterval: number;
  baseApiUrl: string;
  aiProvider: 'openai' | 'openai-compatible';
  providerName: string;
  organization: string;
  project: string;
  model: string;
  models: string[];
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: number;
  enableWebSearch: boolean;
  apiKey: string;
  notifyChannel: string[];
  gitcodeApiToken?: string;
  gitcodeOwner?: string;
  gitcodeRepo?: string;
}

export const Config: Schema<Config> = Schema.object({
  checkInterval: Schema.number().default(3).description('在线状态检查间隔（分钟）'),
  aiProvider: Schema.union(['openai', 'openai-compatible'])
    .default('openai')
    .description('AI 提供商类型：OpenAI 官方或 OpenAI 兼容接口'),
  baseApiUrl: Schema.string().default('https://api.openai.com/v1').description('AI 接口的基础 URL'),
  providerName: Schema.string()
    .default('')
    .description('OpenAI 兼容提供商名称（可选，用于日志/标识）'),
  organization: Schema.string().default('').description('OpenAI Organization（可选）'),
  project: Schema.string().default('').description('OpenAI Project（可选）'),
  model: Schema.string().default('gpt-5').description('使用的 AI 模型'),
  models: Schema.array(String)
    .default([])
    .description('候选模型列表（按顺序回退；为空时使用单一 model）'),
  temperature: Schema.number().min(0).max(2).default(0.8).description('AI 生成温度'),
  maxOutputTokens: Schema.number().min(1).default(4096).description('单次输出最大 token 数'),
  timeoutMs: Schema.number().min(1000).default(45000).description('AI 请求超时时间（毫秒）'),
  maxRetries: Schema.number().min(0).default(2).description('AI 请求失败时最大重试次数'),
  enableWebSearch: Schema.boolean().default(true).description('是否启用网络搜索功能'),
  apiKey: Schema.string().role('secret').default('').description('AI 接口的 API 密钥').required(),
  notifyChannel: Schema.array(String).default([]).description('用于接收更新通知的频道 ID 列表'),
  gitcodeApiToken: Schema.string()
    .role('secret')
    .default('')
    .description('GitCode API 访问令牌，用于上传 XAML 文件'),
  gitcodeOwner: Schema.string().default('').description('GitCode 仓库所有者用户名'),
  gitcodeRepo: Schema.string().default('').description('GitCode 仓库名称'),
});

export function apply(ctx: Context, cfg: Config) {
  ctx.database.extend(
    'minecraft_notifier',
    {
      id: 'integer',
      lastRelease: 'string',
      lastSnapshot: 'string',
    },
    { primary: 'id' }
  );

  ctx.database.extend(
    'minecraft_article_version',
    {
      id: 'integer',
      lastRelease: 'string',
      lastSnapshot: 'string',
      releaseTryTime: 'integer',
      snapshotTryTime: 'integer',
      latestVersion: 'string',
    },
    { primary: 'id' }
  );

  ctx.database.extend(
    'minecraft_article_record',
    {
      id: 'integer',
      version: 'string',
      isSnapshot: 'boolean',
      articleUrl: 'string',
      articleContent: 'string',
    },
    { primary: 'id' }
  );

  const xamlPath = path.join(ctx.baseDir, 'data', 'minecraft-notifier', 'xaml');

  if (!fs.existsSync(xamlPath)) {
    fs.mkdirSync(xamlPath, { recursive: true });
  }

  ctx.server.get('/Custom.xaml', async (koaCtx: any) => {
    koaCtx.set('Content-Type', 'application/xml; charset=utf-8');
    koaCtx.set('Content-Disposition', 'inline; filename="PCL.HomePage.xaml"');

    let fullHomePagePath = path.join(xamlPath, 'PCL.HomePage.xaml');
    koaCtx.response.body = await promises.readFile(fullHomePagePath);
  });

  ctx.server.get('/Custom.xaml.ini', async (koaCtx: any) => {
    koaCtx.set('Content-Type: text/plain; charset=utf-8');

    const articleRecord = (await ctx.database.get('minecraft_article_version', 1))[0];

    koaCtx.response.body = articleRecord.latestVersion;
  });

  ctx.server.get('/Custom.json', async (koaCtx: any) => {
    koaCtx.set('Content-Type', 'application/json; charset=utf-8');

    koaCtx.response.body = JSON.stringify({
      Title: 'Minecraft 更新摘要',
    });
  });

  ctx
    .command('mc.trigger', '手动触发检查 Minecraft 版本更新', {
      authority: 4,
    })
    .action(async () => await checkMinecraftVersion(ctx, cfg));

  ctx
    .command('mc.article.trigger <version:text>', '强制触发指定版本文章总结更新（不写入数据库）', {
      authority: 4,
    })
    .action(async (_, version) => {
      if (!version?.trim()) {
        return '❌ 请提供要更新的版本号，例如：mc.article.trigger 1.21.5';
      }

      const success = await forceRefreshVersionArticle(ctx, cfg, version);
      if (success) {
        return `✅ 已强制更新 ${version.trim()} 的文章总结（未写入数据库）。`;
      }

      return `❌ 强制更新 ${version.trim()} 的文章总结失败，请检查日志。`;
    });

  ctx.setInterval(async () => await checkMinecraftVersion(ctx, cfg), 60000 * cfg.checkInterval);

  ctx.command('mc.version', '查询当前已记录的 Minecraft 版本信息').action(async () => {
    const record = (await ctx.database.get('minecraft_notifier', 1))[0];

    if (!record) {
      return '❌ 当前暂无已记录的版本信息，请稍后再试。';
    }

    return `📢 当前已记录的最新 Minecraft 版本信息：
            
📢 正式版：${record.lastRelease}
🌟 正式版更新日志：${generateArticleUrl(record.lastRelease)}

🎉 快照版：${record.lastSnapshot}
🧪 快照版更新日志：${generateArticleUrl(record.lastSnapshot)}`;
  });
}
