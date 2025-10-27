import axios, { AxiosResponse } from 'axios';

/**
 * 上传或更新 Gitee 仓库中的文本文件（如果不存在则创建，如果存在则更新）
 * @param owner - 仓库所有者用户名
 * @param repo - 仓库名称
 * @param path - 文件路径（例如 'docs/update.txt'）
 * @param content - 文件内容（纯文本字符串，会自动 Base64 编码）
 * @param message - Commit 消息
 * @param token - Gitee Personal Access Token
 * @param branch - 分支名（默认 'master'）
 * @returns Promise<{ success: boolean; data?: AxiosResponse; error?: string }>
 */
export async function upsertFileToGitee(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    token: string,
    branch: string = 'master'
): Promise<{ success: boolean; data?: AxiosResponse; error?: string }> {
    // 将内容编码为 Base64
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    // 步骤 1: GET 检查文件是否存在
    const checkUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}?ref=${branch}&access_token=${token}`;
    let fileSha: string | null = null;

    try {
        const checkResponse: AxiosResponse = await axios.get(checkUrl);

        if (checkResponse.status === 200) {
            fileSha = checkResponse.data.sha; // 提取 SHA
        } else {
            throw new Error(`Unexpected status: ${checkResponse.status}`);
        }
    } catch (checkError: any) {
        if (checkError.response?.status === 404) {
            // 文件不存在，使用 POST 创建
            const createUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}`;
            try {
                const createResponse: AxiosResponse = await axios.post(
                    createUrl,
                    {
                        access_token: token,
                        content: base64Content,
                        message,
                        branch,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
                return { success: true, data: createResponse };
            } catch (createError: any) {
                console.error(
                    'Gitee Create Error:',
                    createError.response?.data || createError.message
                );
                return {
                    success: false,
                    error:
                        createError.response?.data?.message ||
                        createError.message,
                };
            }
        } else {
            // 其他检查错误
            console.error(
                'Gitee Check Error:',
                checkError.response?.data || checkError.message
            );
            return {
                success: false,
                error: checkError.response?.data?.message || checkError.message,
            };
        }
    }

    // 文件存在，使用 PUT 更新
    if (fileSha) {
        const updateUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}`;
        try {
            const updateResponse: AxiosResponse = await axios.put(
                updateUrl,
                {
                    access_token: token,
                    content: base64Content,
                    sha: fileSha,
                    message,
                    branch,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
            return { success: true, data: updateResponse };
        } catch (updateError: any) {
            console.error(
                'Gitee Update Error:',
                updateError.response?.data || updateError.message
            );
            return {
                success: false,
                error:
                    updateError.response?.data?.message || updateError.message,
            };
        }
    }

    // 备用错误（不应到达）
    return { success: false, error: 'Failed to determine file existence' };
}
