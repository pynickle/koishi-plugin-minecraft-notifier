import axios from 'axios';
import { Context } from 'koishi';
import { checkNewVersionArticle } from './changelog-summarizer';
import { Config } from './index';

interface VersionData {
    lastRelease: string;
    lastSnapshot: string;
}

interface LatestVersions {
    release: string;
    snapshot: string;
}

const loadData = async (ctx: Context): Promise<VersionData> => {
    const record = (await ctx.database.get('minecraft_notifier', 1))[0];
    if (record) {
        return {
            lastRelease: record.lastRelease,
            lastSnapshot: record.lastSnapshot,
        };
    }
    return { lastRelease: '', lastSnapshot: '' };
};

const saveData = async (ctx: Context, data: VersionData): Promise<void> => {
    await ctx.database.upsert('minecraft_notifier', [
        {
            id: 1,
            lastRelease: data.lastRelease,
            lastSnapshot: data.lastSnapshot,
        },
    ]);
};

const getLatestVersions = async (): Promise<LatestVersions | undefined> => {
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

const notifyReleaseVersion = async (
    ctx: Context,
    cfg: Config,
    version: string
): Promise<void> => {
    const bot = ctx.bots[0];
    for (const channel of cfg.notifyChannel) {
        await bot.sendMessage(channel, `📢 Minecraft 新正式版发布了：${version}`);
    }
};

const notifySnapshotVersion = async (
    ctx: Context,
    cfg: Config,
    version: string
): Promise<void> => {
    const bot = ctx.bots[0];
    for (const channel of cfg.notifyChannel) {
        await bot.sendMessage(channel, `🎉 Minecraft 新快照版发布了：${version}`);
    }
};

export const checkMinecraftVersion = async (
    ctx: Context,
    cfg: Config
): Promise<void> => {
    try {
        const versionData = await loadData(ctx);
        const latest = await getLatestVersions();

        let updatedData = { ...versionData };

        if (versionData.lastRelease !== latest.release) {
            await notifyReleaseVersion(ctx, cfg, latest.release);
            updatedData.lastRelease = latest.release;
        }

        if (
            versionData.lastSnapshot !== latest.snapshot &&
            versionData.lastRelease != latest.snapshot
        ) {
            await notifySnapshotVersion(ctx, cfg, latest.snapshot);
            updatedData.lastSnapshot = latest.snapshot;
        }

        await saveData(ctx, updatedData);

        await checkNewVersionArticle(ctx, cfg);
    } catch (error) {
        ctx.logger('minecraft-notifier').error(
            'Error checking Minecraft versions:',
            error
        );
    }
};
