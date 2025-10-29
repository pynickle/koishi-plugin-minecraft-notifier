import fs from 'fs';
import { Context, Schema } from 'koishi';
import { promises } from 'node:fs';
import path from 'node:path';
import { generateArticleUrl } from './helper/article-helper';
import { checkMinecraftVersion } from './version-checker';

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
    model: string;
    enableWebSearch: boolean;
    apiKey: string;
    notifyChannel: string[];
    giteeApiToken?: string;
    giteeOwner?: string;
    giteeRepo?: string;
    gitcodeApiToken?: string;
    gitcodeOwner?: string;
    gitcodeRepo?: string;
}

export const Config: Schema<Config> = Schema.object({
    checkInterval: Schema.number()
        .default(3)
        .description('在线状态检查间隔（分钟）'),
    baseApiUrl: Schema.string()
        .default('https://api.openai.com/v1')
        .description('AI 接口的基础 URL'),
    model: Schema.string().default('gpt-5').description('使用的 AI 模型'),
    enableWebSearch: Schema.boolean()
        .default(true)
        .description('是否启用网络搜索功能'),
    apiKey: Schema.string()
        .role('secret')
        .default('')
        .description('AI 接口的 API 密钥')
        .required(),
    notifyChannel: Schema.array(String)
        .default([])
        .description('用于接收更新通知的频道 ID 列表'),
    giteeApiToken: Schema.string()
        .role('secret')
        .default('')
        .description('Gitee API 访问令牌，用于上传 XAML 文件'),
    giteeOwner: Schema.string()
        .default('')
        .description('Gitee 仓库所有者用户名'),
    giteeRepo: Schema.string().default('').description('Gitee 仓库名称'),
    gitcodeApiToken: Schema.string()
        .role('secret')
        .default('')
        .description('GitCode API 访问令牌，用于上传 XAML 文件'),
    gitcodeOwner: Schema.string()
        .default('')
        .description('GitCode 仓库所有者用户名'),
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

    const xamlPath = path.join(
        ctx.baseDir,
        'data',
        'minecraft-notifier',
        'xaml'
    );

    if (!fs.existsSync(xamlPath)) {
        fs.mkdirSync(xamlPath, { recursive: true });
    }

    ctx.server.get('/Custom.xaml', async (koaCtx: any) => {
        koaCtx.set('Content-Type', 'application/xml; charset=utf-8');
        koaCtx.set(
            'Content-Disposition',
            'inline; filename="PCL.HomePage.xaml"'
        );

        let fullHomePagePath = path.join(xamlPath, 'PCL.HomePage.xaml');
        koaCtx.response.body = await promises.readFile(fullHomePagePath);
    });

    ctx.server.get('/Custom.xaml.ini', async (koaCtx: any) => {
        koaCtx.set('Content-Type: text/plain; charset=utf-8');

        const articleRecord = (
            await ctx.database.get('minecraft_article_version', 1)
        )[0];

        koaCtx.response.body = articleRecord.latestVersion;
    });

    ctx.server.get('/Custom.json', async (koaCtx: any) => {
        koaCtx.set('Content-Type', 'application/json; charset=utf-8');

        koaCtx.response.body = JSON.stringify({
            Title: 'Minecraft 更新摘要',
        });
    });

    ctx.command('mc.trigger', '手动触发检查 Minecraft 版本更新', {
        authority: 4,
    }).action(async () => await checkMinecraftVersion(ctx, cfg));

    ctx.setInterval(
        async () => await checkMinecraftVersion(ctx, cfg),
        60000 * cfg.checkInterval
    );

    ctx.command('mc.version', '查询当前已记录的 Minecraft 版本信息').action(
        async () => {
            const record = (await ctx.database.get('minecraft_notifier', 1))[0];

            if (!record) {
                return '❌ 当前暂无已记录的版本信息，请稍后再试。';
            }

            return `📢 当前已记录的最新 Minecraft 版本信息：
            
📢 正式版：${record.lastRelease}
🌟 正式版更新日志：${generateArticleUrl(record.lastRelease, false)}

🎉 快照版：${record.lastSnapshot}
🧪 快照版更新日志：${generateArticleUrl(record.lastSnapshot, true)}`;
        }
    );
}
