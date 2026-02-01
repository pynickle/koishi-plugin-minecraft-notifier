import axios, { AxiosResponse } from 'axios';
import { Context } from 'koishi';

/**
 * Git 平台类型
 */
export enum GitPlatform {
    GITCODE = 'gitcode',
}

/**
 * Git 平台配置
 */
const PLATFORM_CONFIG = {
    [GitPlatform.GITCODE]: {
        baseUrl: 'https://api.gitcode.com/api/v5',
        name: 'GitCode',
    },
} as const;

/**
 * 操作结果类型
 */
interface OperationResult {
    success: boolean;
    data?: AxiosResponse;
    error?: string;
}

/**
 * 文件上传参数
 */
interface FileUploadParams {
    owner: string;
    repo: string;
    path: string;
    content: string;
    message: string;
    token: string;
    branch?: string;
}

/**
 * 核心上传逻辑（适用于 Gitee 和 GitCode）
 */
async function upsertFileToGitPlatform(
    ctx: Context,
    platform: GitPlatform,
    params: FileUploadParams
): Promise<OperationResult> {
    const { owner, repo, path, content, message, token, branch = 'master' } = params;
    const config = PLATFORM_CONFIG[platform];
    const loggerName = `${platform}-uploader`;

    // Base64 编码内容
    const base64Content = Buffer.from(content, 'utf-8').toString('base64');

    // 步骤 1: 检查文件是否存在
    const checkUrl = `${config.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    let fileSha: string | null = null;

    try {
        const checkResponse = await axios.get(checkUrl, {
            headers: { Authorization: `Bearer ${token}` },
            params: { ref: branch, access_token: token },
        });

        // 检查文件是否存在并提取 SHA
        if (checkResponse.status === 200 && checkResponse.data?.sha) {
            fileSha = checkResponse.data.sha;
        }
    } catch (checkError: any) {
        // 404 表示文件不存在，这是预期情况
        if (checkError.response?.status !== 404) {
            ctx.logger(loggerName).warn(
                `${config.name} Check Error:`,
                checkError.response?.data || checkError.message
            );
            return {
                success: false,
                error: checkError.response?.data?.message || checkError.message,
            };
        }
    }

    // 步骤 2: 创建或更新文件
    const apiUrl = `${config.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    const requestBody = {
        access_token: token,
        content: base64Content,
        message,
        branch,
        ...(fileSha && { sha: fileSha }), // 如果存在 SHA，则添加到请求体
    };

    try {
        const response = fileSha
            ? await axios.put(apiUrl, requestBody, {
                  headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                  },
              })
            : await axios.post(apiUrl, requestBody, {
                  headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                  },
              });

        return { success: true, data: response };
    } catch (error: any) {
        const operation = fileSha ? 'Update' : 'Create';
        ctx.logger(loggerName).warn(
            `${config.name} ${operation} Error:`,
            error.response?.data || error.message
        );
        return {
            success: false,
            error: error.response?.data?.message || error.message,
        };
    }
}

/**
 * 上传或更新 GitCode 仓库中的文本文件
 * @param ctx - Koishi 上下文
 * @param owner - 仓库所有者用户名
 * @param repo - 仓库名称
 * @param path - 文件路径（例如 'docs/update.txt'）
 * @param content - 文件内容（纯文本字符串，会自动 Base64 编码）
 * @param message - Commit 消息
 * @param token - GitCode Personal Access Token
 * @param branch - 分支名（默认 'master'）
 * @returns Promise<OperationResult>
 */
export async function upsertFileToGitCode(
    ctx: Context,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    token: string,
    branch: string = 'master'
): Promise<OperationResult> {
    return upsertFileToGitPlatform(ctx, GitPlatform.GITCODE, {
        owner,
        repo,
        path,
        content,
        message,
        token,
        branch,
    });
}

/**
 * 通用上传函数（可指定平台）
 * @param ctx - Koishi 上下文
 * @param platform - Git 平台类型
 * @param params - 上传参数
 * @returns Promise<OperationResult>
 */
export async function upsertFileToGit(
    ctx: Context,
    platform: GitPlatform,
    params: FileUploadParams
): Promise<OperationResult> {
    return upsertFileToGitPlatform(ctx, platform, params);
}
