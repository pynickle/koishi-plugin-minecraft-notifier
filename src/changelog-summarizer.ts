import '@pynickle/koishi-plugin-adapter-onebot';
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { Context } from 'koishi';
import TurndownService from 'turndown';
import { Config } from './index';
import { createBotTextMsgNode } from './onebot-helper';
import { systemPrompt } from './prompt-const';
import { getRandomUserAgent } from './web_helper';

export async function checkNewVersionArticle(ctx: Context, cfg: Config) {
    const [articleRecord, notifierRecord] = await Promise.all([
        ctx.database
            .get('minecraft_article_version', 1)
            .then((records) => records[0]),
        ctx.database.get('minecraft_notifier', 1).then((records) => records[0]),
    ]);

    // 检查快照版本更新
    const snapshotUpdated = await checkVersionUpdate(
        ctx,
        cfg,
        articleRecord,
        notifierRecord,
        'lastSnapshot',
        'snapshotTryTime',
        true
    );

    // 如果快照更新成功，直接返回
    if (snapshotUpdated) return;

    // 检查正式版本更新
    await checkVersionUpdate(
        ctx,
        cfg,
        articleRecord,
        notifierRecord,
        'lastRelease',
        'releaseTryTime',
        false
    );
}

async function checkVersionUpdate(
    ctx: Context,
    cfg: Config,
    articleRecord: any,
    notifierRecord: any,
    versionKey: 'lastSnapshot' | 'lastRelease',
    tryTimeKey: 'snapshotTryTime' | 'releaseTryTime',
    isSnapshot: boolean
): Promise<boolean> {
    // 版本未变化，无需处理
    if (articleRecord[versionKey] === notifierRecord[versionKey]) {
        return false;
    }

    const currentTryTime = articleRecord[tryTimeKey];
    const newVersion = notifierRecord[versionKey];

    // 尝试处理新版本文章
    const success = await processNewVersionArticle(
        ctx,
        cfg,
        newVersion,
        isSnapshot
    );

    if (success) {
        // 成功：更新版本记录并重置尝试次数
        await updateArticleRecord(ctx, {
            [versionKey]: newVersion,
            [tryTimeKey]: 0,
        });
        return true;
    }

    // 失败：增加尝试次数
    const newTryTime = currentTryTime + 1;

    // 达到最大尝试次数，重置计数器并跳过此版本
    if (newTryTime >= 5) {
        await updateArticleRecord(ctx, {
            [versionKey]: newVersion,
            [tryTimeKey]: 0,
        });
    } else {
        // 未达到最大次数，仅更新尝试次数
        await updateArticleRecord(ctx, {
            [tryTimeKey]: newTryTime,
        });
    }

    return false;
}

async function updateArticleRecord(ctx: Context, updates: Record<string, any>) {
    await ctx.database.upsert('minecraft_article_version', [
        { id: 1, ...updates },
    ]);
}

export async function processNewVersionArticle(
    ctx: Context,
    cfg: Config,
    version: string,
    isSnapshot: boolean
) {
    ctx.logger('minecraft-notifier').info(
        `Processing new ${isSnapshot ? 'snapshot' : 'release'} version: ${version}`
    );
    const content = await fetchArticleContent(ctx, version, isSnapshot);
    if (!content) {
        ctx.logger('minecraft-notifier').warn(
            `No content found for version ${version}`
        );
        return;
    }
    ctx.logger('minecraft-notifier').info(
        `Fetched content for version ${version}, starting summarization...`
    );
    return await summarizeMinecraftUpdate(ctx, cfg, version, content);
}

const minecraftSummaryTypeMap: Record<string, string> = {
    new_features: '✨ 新特性',
    improvements: '🔧 改进与优化',
    balancing: '⚖️ 平衡调整',
    bug_fixes: '🐛 错误修复',
    technical_changes: '⚙️ 技术变更',
};

async function summarizeMinecraftUpdate(
    ctx: Context,
    cfg: Config,
    version: string,
    updateContent: string
): Promise<boolean> {
    const url = cfg.baseApiUrl.endsWith('/')
        ? `${cfg.baseApiUrl}chat/completions`
        : `${cfg.baseApiUrl}/chat/completions`;

    const userPrompt = `
Input:
- Update log content in Markdown format: 
${updateContent}
`;

    let response: AxiosResponse;
    try {
        response = await axios.post(
            url,
            {
                model: cfg.model,
                temperature: 0.8,
                tools: [{ type: 'web_search_preview' }],
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
                web_search: true,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'minecraft_update_summary',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                new_features: {
                                    $ref: '#/definitions/categoryGroup',
                                },
                                improvements: {
                                    $ref: '#/definitions/categoryGroup',
                                },
                                balancing: {
                                    $ref: '#/definitions/categoryGroup',
                                },
                                bug_fixes: {
                                    $ref: '#/definitions/categoryGroup',
                                },
                                technical_changes: {
                                    $ref: '#/definitions/categoryGroup',
                                },
                            },
                            required: [
                                'new_features',
                                'improvements',
                                'balancing',
                                'bug_fixes',
                                'technical_changes',
                            ],
                            additionalProperties: false,
                            definitions: {
                                categoryGroup: {
                                    type: 'object',
                                    properties: {
                                        general: {
                                            type: 'array',
                                            description:
                                                '属于该大类但未细分的小项',
                                            items: { type: 'string' },
                                        },
                                        subcategories: {
                                            type: 'array',
                                            description:
                                                '该大类下的细分类（带 emoji）',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    subcategory: {
                                                        type: 'string',
                                                    },
                                                    emoji: {
                                                        type: 'string',
                                                        description:
                                                            '小类前的 emoji 图标',
                                                    },
                                                    items: {
                                                        type: 'array',
                                                        items: {
                                                            type: 'string',
                                                        },
                                                    },
                                                },
                                                required: [
                                                    'subcategory',
                                                    'emoji',
                                                    'items',
                                                ],
                                                additionalProperties: false,
                                            },
                                        },
                                    },
                                    required: ['general', 'subcategories'],
                                    additionalProperties: false,
                                },
                            },
                        },
                    },
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${cfg.apiKey}`,
                },
            }
        );
    } catch (e) {
        ctx.logger('minecraft-notifier').error(
            'Summarization API error:',
            e.response?.data
        );
        return false;
    }

    const content = response.data.choices[0].message.content;
    const summary = JSON.parse(content);

    const messages = [
        createBotTextMsgNode(ctx.bots[0], `=== ${version} 更新总结 ===`),
    ];

    const orderedCategories = Object.keys(minecraftSummaryTypeMap);

    for (const category of orderedCategories) {
        const catData = summary[category];
        if (!catData) continue;

        const { general = [], subcategories = [] } = catData;
        if (general.length === 0 && subcategories.length === 0) continue;

        const categoryTitle = `【${minecraftSummaryTypeMap[category]}】`;

        // 大类通用项
        if (general.length > 0) {
            const generalList = general
                .map((msg: string) => `- ${msg}`)
                .join('\n');
            messages.push(
                createBotTextMsgNode(
                    ctx.bots[0],
                    `${categoryTitle}\n${generalList}`
                )
            );
        } else if (subcategories.length > 0) {
            // 无通用项但有子类时，先推送单独的大类标题
            messages.push(createBotTextMsgNode(ctx.bots[0], categoryTitle));
        }

        // 子类分组
        for (const sub of subcategories) {
            const subHeader = `${sub.emoji} ${sub.subcategory}`;
            const subList = sub.items
                .map((msg: string) => `- ${msg}`)
                .join('\n');
            messages.push(
                createBotTextMsgNode(ctx.bots[0], `${subHeader}\n${subList}`)
            );
        }
    }

    for (const groupId of cfg.notifyChannel) {
        await ctx.bots[0].internal.sendGroupForwardMsg(groupId, messages);
    }

    return true;
}

export function generateArticleUrl(
    version: string,
    isSnapshot: boolean
): string {
    const cleanVersion = version.replace(/\s/g, '-').toLowerCase();
    const baseUrl = 'https://www.minecraft.net/zh-hans/article';

    if (isSnapshot) {
        return generateSnapshotUrl(baseUrl, version, cleanVersion);
    }

    return `${baseUrl}/minecraft-java-edition-${cleanVersion.replaceAll('.', '-')}`;
}

function generateSnapshotUrl(
    baseUrl: string,
    version: string,
    cleanVersion: string
): string {
    if (version.includes('rc')) {
        return buildReleaseUrl(baseUrl, version, 'release-candidate');
    }

    if (version.includes('pre')) {
        return buildReleaseUrl(baseUrl, version, 'pre-release');
    }

    return `${baseUrl}/minecraft-snapshot-${cleanVersion}`;
}

function buildReleaseUrl(
    baseUrl: string,
    version: string,
    releaseType: string
): string {
    const [mainVersion] = version.split('-');
    const buildNumber = version.slice(-1);
    const formattedVersion = mainVersion.replaceAll('.', '-');

    return `${baseUrl}/minecraft-${formattedVersion}-${releaseType}-${buildNumber}`;
}

const turndownService = new TurndownService({});

export async function fetchArticleContent(
    ctx: Context,
    version: string,
    isSnapshot: boolean
): Promise<string> {
    const url = generateArticleUrl(version, isSnapshot);

    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': getRandomUserAgent(),
            },
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const content = $('div.article-text').html().trim();
        return turndownService.turndown(content.trim());
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            ctx.logger('minecraft-notifier').warn(`Article not found: ${url}`);
        } else {
            ctx.logger('minecraft-notifier').warn(
                `Error retrieving article content (${url}):\n`,
                error
            );
        }
    }
}
