import axios from 'axios';
import * as cheerio from 'cheerio';
import { Context } from 'koishi';

// 函数：提取所有 data-table 中的中英文对，并过滤匹配的
export async function extractTranslations(ctx: Context, searchStr: string) {
    try {
        // 获取网页
        const response = await axios.get(
            'https://zh.minecraft.wiki/w/Minecraft_Wiki:%E8%AF%91%E5%90%8D%E6%A0%87%E5%87%86%E5%8C%96'
        );
        const html = response.data;
        const $ = cheerio.load(html);

        // 存储匹配的中英文对
        const matches = [];

        // 查找所有 class="data-table" 的表格
        $('.data-table').each((index, table) => {
            const rows = $(table).find('tr');
            let headers = null;
            let englishCol = -1;
            let chineseCol = -1;

            rows.each((rowIndex, row) => {
                const cells = $(row).find('td, th');
                if (rowIndex === 0) {
                    // 第一行通常是表头
                    headers = [];
                    cells.each((colIndex, cell) => {
                        const headerText = $(cell).text().trim();
                        headers.push(headerText);
                        if (
                            headerText.includes('英文') ||
                            headerText.includes('English')
                        ) {
                            englishCol = colIndex;
                        }
                        if (
                            headerText.includes('中文') ||
                            headerText.includes('Chinese')
                        ) {
                            chineseCol = colIndex;
                        }
                    });
                    // 如果没有明确列，假设第二列英文、第三列中文（基于示例）
                    if (englishCol === -1) englishCol = 1;
                    if (chineseCol === -1) chineseCol = 2;
                } else {
                    // 数据行
                    const english = $(cells[englishCol]).text().trim();
                    const chinese = $(cells[chineseCol]).text().trim();

                    if (english && chinese) {
                        // 判断英文名（小写）是否在搜索字符串中
                        if (searchStr.includes(english.toLowerCase())) {
                            matches.push({ english, chinese });
                        }
                    }
                }
            });
        });

        // 输出格式：${english}: ${chinese}
        return matches
            .map(({ english, chinese }) => `${english}: ${chinese}`)
            .join('\n');
    } catch (error) {
        ctx.logger('minecraft-notifier').warn(
            'Failed to fetch or parse translations:',
            error
        );
        return;
    }
}
