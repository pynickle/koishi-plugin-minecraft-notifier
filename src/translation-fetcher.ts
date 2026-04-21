import axios from 'axios';
import * as cheerio from 'cheerio';
import { Context } from 'koishi';

import { Config } from './index';

const TRANSLATION_SHEET_URL =
  'https://light-beacon.github.io/Minecraft-ZH-Translation-Sheet/translations.json';

const DEFAULT_GITHUB_API_VERSION = '2022-11-28';

/**
 * 翻译对类型
 */
interface TranslationPair {
  english: string;
  chinese: string;
}

interface GitHubContentsFileResponse {
  type?: string;
  encoding?: string;
  content?: string;
}

/**
 * 从 GitCode 仓库读取硬编码的翻译列表
 * @param ctx - Koishi 上下文
 * @param owner - 仓库所有者
 * @param repo - 仓库名称
 * @param path - 文件路径
 * @param token - GitCode Access Token
 * @param branch - 分支名（默认 'master'）
 * @returns Promise<TranslationPair[]>
 */
async function fetchGitCodeTranslations(
  ctx: Context,
  owner: string,
  repo: string,
  path: string,
  token: string,
  branch: string = 'master'
): Promise<TranslationPair[]> {
  try {
    const url = `https://api.gitcode.com/api/v5/repos/${owner}/${repo}/contents/${path}`;
    const response = await axios.get(url, {
      params: { ref: branch, access_token: token },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.data?.content) {
      ctx.logger('translation-extractor').warn('GitCode file has no content');
      return [];
    }

    // 解码 Base64 内容
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

    // 解析翻译列表（支持多种格式）
    return parseTranslationContent(content);
  } catch (error: any) {
    ctx
      .logger('translation-extractor')
      .warn('Failed to fetch GitCode translations:', error.response?.data || error.message);
    return [];
  }
}

/**
 * 解析翻译文件内容
 * 支持格式：
 * 1. JSON: [{"english": "...", "chinese": "..."}, ...]
 * 2. JSON对象: {"english1": "chinese1", "english2": "chinese2"}
 * 3. 行分隔: english: chinese（每行一对）
 * 4. 逗号分隔: english,chinese（每行一对）
 */
function parseTranslationContent(content: string): TranslationPair[] {
  const translations: TranslationPair[] = [];

  try {
    // 尝试解析为 JSON
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      // JSON 数组格式
      for (const item of parsed) {
        if (item.english && item.chinese) {
          translations.push({
            english: item.english.trim(),
            chinese: item.chinese.trim(),
          });
        }
      }
    } else if (typeof parsed === 'object') {
      // JSON 对象格式 {"english": "chinese"}
      for (const [english, chinese] of Object.entries(parsed)) {
        if (typeof chinese === 'string') {
          translations.push({
            english: english.trim(),
            chinese: chinese.trim(),
          });
        }
      }
    }

    return translations;
  } catch {
    // 不是 JSON，按行解析
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue; // 跳过空行和注释
      }

      // 尝试冒号分隔
      if (trimmed.includes(':')) {
        const [english, chinese] = trimmed.split(':').map((s) => s.trim());
        if (english && chinese) {
          translations.push({ english, chinese });
        }
      }
      // 尝试逗号分隔
      else if (trimmed.includes(',')) {
        const [english, chinese] = trimmed.split(',').map((s) => s.trim());
        if (english && chinese) {
          translations.push({ english, chinese });
        }
      }
    }

    return translations;
  }
}

/**
 * 从 Minecraft Wiki 提取翻译
 */
async function fetchWikiTranslations(ctx: Context): Promise<TranslationPair[]> {
  try {
    const response = await axios.get(
      'https://zh.minecraft.wiki/w/Minecraft_Wiki:%E8%AF%91%E5%90%8D%E6%A0%87%E5%87%86%E5%8C%96'
    );
    const html = response.data;
    const $ = cheerio.load(html);

    const translations: TranslationPair[] = [];

    $('.data-table').each((index, table) => {
      const rows = $(table).find('tr');
      let englishCol = -1;
      let chineseCol = -1;

      rows.each((rowIndex, row) => {
        const cells = $(row).find('td, th');
        if (rowIndex === 0) {
          // 解析表头
          cells.each((colIndex, cell) => {
            const headerText = $(cell).text().trim();
            if (headerText.includes('英文') || headerText.includes('English')) {
              englishCol = colIndex;
            }
            if (headerText.includes('中文') || headerText.includes('Chinese')) {
              chineseCol = colIndex;
            }
          });
          // 默认列位置
          if (englishCol === -1) englishCol = 1;
          if (chineseCol === -1) chineseCol = 2;
        } else {
          // 数据行
          const english = $(cells[englishCol]).text().trim();
          const chinese = $(cells[chineseCol]).text().trim();

          if (english && chinese) {
            translations.push({ english, chinese });
          }
        }
      });
    });

    return translations;
  } catch (error) {
    ctx.logger('translation-extractor').warn('Failed to fetch Wiki translations:', error);
    return [];
  }
}

/**
 * 从 Minecraft 中文翻译表获取翻译
 * @param ctx - Koishi 上下文
 * @returns Promise<TranslationPair[]>
 */
async function fetchTranslationSheet(ctx: Context): Promise<TranslationPair[]> {
  try {
    const response = await axios.get(TRANSLATION_SHEET_URL, {
      timeout: 10000,
      headers: {
        Accept: 'application/json',
      },
    });

    const data = response.data;
    const translations: TranslationPair[] = [];

    if (typeof data === 'object' && data !== null) {
      for (const [english, chinese] of Object.entries(data)) {
        if (typeof chinese === 'string') {
          translations.push({
            english: english.trim(),
            chinese: chinese.trim(),
          });
        }
      }
    }

    ctx
      .logger('translation-extractor')
      .info(`Loaded ${translations.length} translations from sheet`);
    return translations;
  } catch (error: any) {
    ctx.logger('translation-extractor').warn('Failed to fetch translation sheet:', error.message);
    return [];
  }
}

/**
 * 从 GitHub Contents API 获取翻译表
 * @param ctx - Koishi 上下文
 * @param url - GitHub Contents API 地址
 * @param token - GitHub PAT Token
 * @returns Promise<TranslationPair[]>
 */
async function fetchGitHubTranslationSheet(
  ctx: Context,
  url: string,
  token?: string
): Promise<TranslationPair[]> {
  if (!url.trim()) {
    ctx.logger('translation-extractor').warn('GitHub translation API URL is empty');
    return [];
  }

  if (!token?.trim()) {
    ctx
      .logger('translation-extractor')
      .warn('GitHub translation API token is empty; skip fetching from GitHub Contents API');
    return [];
  }

  try {
    const response = await axios.get<GitHubContentsFileResponse>(url, {
      timeout: 10000,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.trim()}`,
        'X-GitHub-Api-Version': DEFAULT_GITHUB_API_VERSION,
      },
    });

    const data = response.data;
    if (data?.type !== 'file' || !data.content) {
      ctx
        .logger('translation-extractor')
        .warn('GitHub contents response does not contain file content');
      return [];
    }

    const decodedContent = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    const translations = parseTranslationContent(decodedContent);

    ctx
      .logger('translation-extractor')
      .info(`Loaded ${translations.length} translations from GitHub contents API`);
    return translations;
  } catch (error: any) {
    ctx
      .logger('translation-extractor')
      .warn(
        'Failed to fetch translation sheet from GitHub contents API:',
        error.response?.data || error.message
      );
    return [];
  }
}

/**
 * 提取所有翻译（从 Wiki、GitCode 和翻译表）
 * @param ctx - Koishi 上下文
 * @param cfg - 配置选项
 * @param searchStr - 搜索字符串
 * @returns Promise<string> 格式化的翻译结果
 */
export async function extractTranslations(
  ctx: Context,
  cfg: Config,
  searchStr: string
): Promise<string> {
  try {
    const promises: Promise<TranslationPair[]>[] = [];

    if (cfg.translationSource === 'sheet') {
      promises.push(fetchTranslationSheet(ctx));
    } else if (cfg.translationSource === 'sheet-github-api') {
      promises.push(
        fetchGitHubTranslationSheet(ctx, cfg.githubTranslationApiUrl, cfg.githubTranslationApiToken)
      );
    } else {
      promises.push(fetchWikiTranslations(ctx));
    }

    if (cfg.gitcodeApiToken && cfg.gitcodeOwner && cfg.gitcodeRepo) {
      promises.push(
        fetchGitCodeTranslations(
          ctx,
          cfg.gitcodeOwner,
          cfg.gitcodeRepo,
          'Translations.json',
          cfg.gitcodeApiToken
        )
      );
    }

    const results = await Promise.all(promises);
    const allTranslations: TranslationPair[] = results.flat();

    const translationMap = new Map<string, string>();

    for (const { english, chinese } of allTranslations) {
      translationMap.set(english.toLowerCase(), chinese);
    }

    const lowerSearchStr = searchStr.toLowerCase();
    const matches: TranslationPair[] = [];

    for (const [englishLower, chinese] of translationMap.entries()) {
      if (lowerSearchStr.includes(englishLower)) {
        const originalEnglish =
          allTranslations.find((t) => t.english.toLowerCase() === englishLower)?.english ||
          englishLower;

        matches.push({ english: originalEnglish, chinese });
      }
    }

    return matches.map(({ english, chinese }) => `${english}: ${chinese}`).join('\n');
  } catch (error) {
    ctx.logger('translation-extractor').warn('Failed to extract translations:', error);
    return '';
  }
}
