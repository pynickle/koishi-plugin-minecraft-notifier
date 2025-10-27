import axios from 'axios';
import fs from 'fs';
import { Context, Schema } from 'koishi';
import { promises } from 'node:fs';
import path from 'node:path';
import { checkNewVersionArticle } from './changelog-summarizer';

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
    apiKey: string;
    notifyChannel: string[];
    giteeApiToken?: string;
    giteeOwner?: string;
    giteeRepo?: string;
}

export const Config: Schema<Config> = Schema.object({
    checkInterval: Schema.number()
        .default(3)
        .description('在线状态检查间隔（分钟）'),
    baseApiUrl: Schema.string()
        .default('https://api.openai.com/v1')
        .description('AI 接口的基础 URL'),
    model: Schema.string().default('gpt-5').description('使用的 AI 模型'),
    apiKey: Schema.string()
        .default('')
        .description('AI 接口的 API 密钥')
        .required(),
    notifyChannel: Schema.array(String)
        .default([])
        .description('用于接收更新通知的频道 ID 列表'),
    giteeApiToken: Schema.string()
        .default('')
        .description('Gitee API 访问令牌，用于上传 XAML 文件'),
    giteeOwner: Schema.string()
        .default('')
        .description('Gitee 仓库所有者用户名'),
    giteeRepo: Schema.string().default('').description('Gitee 仓库名称'),
});

export function apply(ctx: Context, cfg: Config & { articleTracker: any }) {
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

    let lastRelease = '';
    let lastSnapshot = '';

    const loadData = async () => {
        const record = (await ctx.database.get('minecraft_notifier', 1))[0];
        if (record) {
            lastRelease = record.lastRelease;
            lastSnapshot = record.lastSnapshot;
        }
    };

    const saveData = async () => {
        await ctx.database.upsert('minecraft_notifier', [
            { id: 1, lastRelease, lastSnapshot },
        ]);
    };

    const getLatestVersions = async () => {
        let retries = 0;
        while (retries <= 3) {
            try {
                const response = await axios.get(
                    'https://launchermeta.mojang.com/mc/game/version_manifest.json',
                    {
                        timeout: 10000,
                    }
                );
                const data = response.data;
                return {
                    release: data.latest.release,
                    snapshot: data.latest.snapshot,
                };
            } catch (error) {
                retries++;
                if (retries <= 3) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, Math.pow(2, retries) * 1000)
                    );
                }
            }
        }
    };

    const xamlPath = path.join(
        ctx.baseDir,
        'data',
        'minecraft-notifier',
        'xaml'
    );

    if (!fs.existsSync(xamlPath)) {
        fs.mkdirSync(xamlPath, { recursive: true });
    }

    ctx.server.get('/PCL', async (koaCtx: any) => {
        // 设置响应头：Content-Type 为 XAML/XML，Content-Disposition 为内联下载（可选）
        koaCtx.set('Content-Type', 'application/xml; charset=utf-8');
        koaCtx.set(
            'Content-Disposition',
            'inline; filename="PCL.HomePage.xaml"'
        );

        let fullHomePagePath = path.join(xamlPath, 'PCL.HomePage.xaml');
        koaCtx.response.body = await promises.readFile(fullHomePagePath);
    });

    ctx.setInterval(async () => {
        try {
            await loadData();
            const latest = await getLatestVersions();

            const bot = ctx.bots[0];
            if (lastRelease !== latest.release) {
                for (const channel of cfg.notifyChannel) {
                    await bot.sendMessage(
                        channel,
                        `Minecraft 新正式版发布了：${latest.release}`
                    );
                }
                lastRelease = latest.release;
            }

            if (
                lastSnapshot !== latest.snapshot &&
                lastRelease != latest.snapshot
            ) {
                for (const channel of cfg.notifyChannel) {
                    await bot.sendMessage(
                        channel,
                        `Minecraft 新快照版发布了：${latest.snapshot}`
                    );
                }
                lastSnapshot = latest.snapshot;
            }

            await saveData();

            await checkNewVersionArticle(ctx, cfg);
        } catch (error) {
            ctx.logger('minecraft-notifier').error(
                '检查 Minecraft 版本时出错：',
                error
            );
        }
    }, 60000 * cfg.checkInterval);
}
