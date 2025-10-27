import axios, { AxiosResponse } from 'axios';

export async function uploadFileToGitee(
    owner: string, // 仓库所有者用户名
    repo: string, // 仓库名称
    path: string, // 文件路径（例如 'docs/update.txt'）
    content: string, // 文件内容（纯文本字符串）
    message: string, // Commit 消息
    token: string, // Gitee Personal Access Token
    branch: string = 'master' // 分支名称，默认为 'master'
): Promise<{ success: boolean; data?: AxiosResponse; error?: string }> {
    // 将内容编码为 Base64
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    const url = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}`;

    try {
        const response: AxiosResponse = await axios.post(
            url,
            {
                content: base64Content,
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
            'Gitee Upload Error:',
            error.response?.data || error.message
        );
        return {
            success: false,
            error: error.response?.data?.message || error.message,
        };
    }
}
