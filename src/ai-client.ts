import { createOpenAI, openai } from '@ai-sdk/openai';
import { APICallError, generateObject, generateText } from 'ai';
import { z } from 'zod';
import { Config } from './index';
import { Context } from 'koishi';

const subcategorySchema = z.object({
  subcategory: z.string(),
  emoji: z.string(),
  items: z.array(z.string()),
});

const categoryGroupSchema = z.object({
  general: z.array(z.string()),
  subcategories: z.array(subcategorySchema),
});

const minecraftSummarySchema = z.object({
  new_features: categoryGroupSchema,
  improvements: categoryGroupSchema,
  balancing: categoryGroupSchema,
  bug_fixes: categoryGroupSchema,
  technical_changes: categoryGroupSchema,
});

export type MinecraftSummary = z.infer<typeof minecraftSummarySchema>;

function normalizeBaseUrl(baseUrl: string): string | undefined {
  const trimmed = baseUrl.trim();
  if (!trimmed) return undefined;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function getCandidateModels(cfg: Config): string[] {
  const fromList = cfg.models
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

  const legacyModel = cfg.model.trim();
  if (legacyModel && !fromList.includes(legacyModel)) {
    fromList.push(legacyModel);
  }

  return fromList;
}

function createProvider(cfg: Config) {
  return createOpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.aiProvider === 'openai' ? undefined : normalizeBaseUrl(cfg.baseApiUrl),
    name: cfg.providerName?.trim() || undefined,
    organization: cfg.organization?.trim() || undefined,
    project: cfg.project?.trim() || undefined,
  });
}

function createModelFactory(cfg: Config) {
  const provider = createProvider(cfg);
  if (cfg.aiProvider === 'openai') {
    return {
      model: (modelId: string) => provider.responses(modelId),
      webSearchTool: provider.tools.webSearchPreview({}),
    };
  }

  return {
    model: (modelId: string) => provider.chat(modelId),
    webSearchTool: undefined,
  };
}

function getAbortSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== 'function') {
    return undefined;
  }
  return AbortSignal.timeout(timeoutMs);
}

export async function summarizeWithAi(
  ctx: Context,
  cfg: Config,
  systemPrompt: string,
  userPrompt: string
): Promise<MinecraftSummary | null> {
  const models = getCandidateModels(cfg);
  if (models.length === 0) {
    ctx.logger('minecraft-notifier').error('No AI model configured. Please set model or models.');
    return null;
  }

  const modelFactory = createModelFactory(cfg);

  for (const modelId of models) {
    const commonOptions = {
      model: modelFactory.model(modelId),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: cfg.temperature,
      maxOutputTokens: cfg.maxOutputTokens,
      maxRetries: cfg.maxRetries,
      timeout: cfg.timeoutMs,
      abortSignal: getAbortSignal(cfg.timeoutMs),
    };

    try {
      const objectResult = await generateObject({
        ...commonOptions,
        schema: minecraftSummarySchema,
      });

      ctx.logger('minecraft-notifier').info(`AI summarization succeeded with model ${modelId}`);
      return objectResult.object;
    } catch (error) {
      if (cfg.enableWebSearch && modelFactory.webSearchTool) {
        try {
          const fallbackResult = await generateText({
            ...commonOptions,
            tools: {
              web_search: modelFactory.webSearchTool,
            },
          });

          const parsed = JSON.parse(fallbackResult.text);
          const validated = minecraftSummarySchema.safeParse(parsed);
          if (!validated.success) {
            ctx
              .logger('minecraft-notifier')
              .warn(`AI summarization result schema validation failed with model ${modelId}`);
            continue;
          }

          ctx
            .logger('minecraft-notifier')
            .info(`AI summarization succeeded with model ${modelId} via web search fallback`);
          return validated.data;
        } catch (fallbackError) {
          if (APICallError.isInstance(fallbackError)) {
            ctx
              .logger('minecraft-notifier')
              .warn(
                `AI summarization web-search fallback failed with model ${modelId}: status=${fallbackError.statusCode}, message=${fallbackError.message}`
              );
          } else {
            ctx
              .logger('minecraft-notifier')
              .warn(
                `AI summarization web-search fallback failed with model ${modelId}:`,
                fallbackError
              );
          }
        }
      }

      if (APICallError.isInstance(error)) {
        ctx
          .logger('minecraft-notifier')
          .warn(
            `AI summarization failed with model ${modelId}: status=${error.statusCode}, message=${error.message}`
          );
      } else {
        ctx
          .logger('minecraft-notifier')
          .warn(`AI summarization failed with model ${modelId}:`, error);
      }
    }
  }

  return null;
}
