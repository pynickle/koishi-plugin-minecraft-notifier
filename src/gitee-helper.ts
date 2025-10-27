import axios, { AxiosResponse } from 'axios';

/**
 * 更新 Gitee 仓库中的文本文件
 * @param owner - 仓库所有者用户名
 * @param repo - 仓库名称
 * @param path - 文件路径（例如 'docs/update.txt'）
 * @param content - 文件内容（纯文本字符串，会自动 Base64 编码）
 * @param sha - 文件的当前 SHA 值（通过 GET contents API 获取，用于更新）
 * @param message - Commit 消息
 * @param token - Gitee Personal Access Token
 * @param branch - 分支名（默认 'master'）
 * @returns Promise<{ success: boolean; data?: AxiosResponse; error?: string }>
 */
export async function updateFileOnGitee(
    owner: string,
    repo: string,
    path: string,
    content: string,
    sha: string,
    message: string,
    token: string,
    branch: string = 'master'
): Promise<{ success: boolean; data?: AxiosResponse; error?: string }> {
    // 将内容编码为 Base64
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}`;

    try {
        const response: AxiosResponse = await axios.put(
            url,
            {
                content: base64Content,
                sha,
                message,
                branch,
            },
            {
                headers: {
                    Authorization: `token ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return { success: true, data: response };
    } catch (error: any) {
        console.error(
            'Gitee Update Error:',
            error.response?.data || error.message
        );
        return {
            success: false,
            error: error.response?.data?.message || error.message,
        };
    }
}
