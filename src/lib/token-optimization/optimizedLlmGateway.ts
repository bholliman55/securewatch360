import { compressContext } from "@/lib/token-optimization/contextCompressor";
import { getReusableSummary, writeReusableSummary } from "@/lib/token-optimization/contextSummaryService";
import { sanitizeContextBundle } from "@/lib/token-optimization/contextSanitizer";
import { getCachedResponse, shouldUseCache, writeCachedResponse } from "@/lib/token-optimization/llmCacheService";
import {
  createPromptLogStart,
  updatePromptLogFailure,
  updatePromptLogSuccess,
} from "@/lib/token-optimization/llmPromptLogService";
import { MockLlmProviderAdapter } from "@/lib/token-optimization/mockLlmProviderAdapter";
import type { LlmProviderAdapter } from "@/lib/token-optimization/providerAdapter";
import { enforcePromptBudget, getPromptBudget } from "@/lib/token-optimization/promptBudgetManager";
import { createPromptHash, hashPrompt } from "@/lib/token-optimization/promptHash";
import { estimateTokens } from "@/lib/token-optimization/tokenEstimator";
import type { OptimizedPromptRequest, OptimizedPromptResult } from "@/lib/token-optimization/types";

function buildPrompt(instruction: string, contextText: string): string {
  return [
    "You are an assistant for SecureWatch360.",
    "Follow these strict rules:",
    "- Never output secrets, credentials, tokens, cookies, private webhook URLs, or private keys.",
    "- Do not make policy decisions. Explain and summarize only.",
    "- Do not execute actions. Recommend wording only.",
    "",
    `Task: ${instruction}`,
    "",
    "Context:",
    contextText,
  ].join("\n");
}

export function getDefaultProviderAdapter(): LlmProviderAdapter {
  return new MockLlmProviderAdapter();
}

export async function optimizedLlmGateway(
  adapter: LlmProviderAdapter,
  request: OptimizedPromptRequest
): Promise<OptimizedPromptResult> {
  const budget = await getPromptBudget({
    tenantId: request.tenantId,
    agent: request.agent,
    taskType: request.taskType,
  });

  const sanitizedBundle = sanitizeContextBundle(request.contextBundle, {
    taskType: request.taskType,
  });
  const rawContextText = JSON.stringify(sanitizedBundle.data);
  let contextText = rawContextText;
  let fromSummary = false;
  const warnings: string[] = [];

  if (request.allowSummaryReuse !== false) {
    const summary = await getReusableSummary({
      tenantId: request.tenantId,
      agent: request.agent,
      taskType: request.taskType,
      rawContextText,
    });
    if (summary) {
      contextText = summary;
      fromSummary = true;
    }
  }

  const budgetEnforcement = await enforcePromptBudget({
    tenantId: request.tenantId,
    agentName: request.agent,
    taskType: request.taskType,
    instruction: request.instruction,
    contextBundle: sanitizedBundle,
  });
  warnings.push(...budgetEnforcement.warnings);
  if (budgetEnforcement.rejected) {
    throw new Error(budgetEnforcement.rejectReason ?? "Prompt rejected by budget manager");
  }

  const compressed = compressContext(
    JSON.stringify(budgetEnforcement.adjustedContextBundle.data),
    budget.maxPromptTokens * 4
  );
  const prompt = buildPrompt(request.instruction, compressed.compressedText);
  const promptHash = createPromptHash(prompt);
  const inputFingerprint = hashPrompt({
    tenantId: request.tenantId,
    agent: request.agent,
    taskType: request.taskType,
    model: request.model,
    instruction: request.instruction,
    context: budgetEnforcement.adjustedContextBundle.data,
  });
  const estimatedPromptTokens = estimateTokens(prompt);
  const promptLogId = await createPromptLogStart({
    tenantId: request.tenantId,
    workflowRunId: null,
    agentName: request.agent,
    taskType: request.taskType,
    modelProvider: adapter.providerName,
    modelName: request.model,
    promptHash,
    cacheHit: false,
  });

  try {
    if (request.allowCache !== false && shouldUseCache(request.taskType, request.agent)) {
      const cached = await getCachedResponse({
        tenantId: request.tenantId,
        agentName: request.agent,
        taskType: request.taskType,
        promptHash,
        inputFingerprint,
        allowGlobalFallback: true,
      });
      if (cached.hit && cached.responseText) {
        if (promptLogId) {
          await updatePromptLogSuccess(promptLogId, {
            cacheHit: true,
            inputTokens: cached.tokenUsage?.promptTokens ?? estimatedPromptTokens,
            outputTokens: cached.tokenUsage?.completionTokens ?? 0,
          });
        }

        return {
          response: cached.responseText,
          cacheHit: true,
          promptLogId,
          warnings,
          tokenEstimate: {
            promptTokens: cached.tokenUsage?.promptTokens ?? estimatedPromptTokens,
            completionTokens: cached.tokenUsage?.completionTokens ?? 0,
            totalTokens: cached.tokenUsage?.totalTokens ?? estimatedPromptTokens,
          },
          provider: adapter.providerName,
          model: request.model,
          responseText: cached.responseText,
          cache: {
            hit: true,
            cacheKey: promptHash,
            responseText: cached.responseText,
            tokenUsage: {
              promptTokens: cached.tokenUsage?.promptTokens ?? estimatedPromptTokens,
              completionTokens: cached.tokenUsage?.completionTokens ?? 0,
              totalTokens: cached.tokenUsage?.totalTokens ?? estimatedPromptTokens,
            },
          },
          tokenUsage: {
            promptTokens: cached.tokenUsage?.promptTokens ?? estimatedPromptTokens,
            completionTokens: cached.tokenUsage?.completionTokens ?? 0,
            totalTokens: cached.tokenUsage?.totalTokens ?? estimatedPromptTokens,
            estimatedPromptTokens,
          },
          compression: {
            wasCompressed: compressed.wasCompressed,
            originalChars: compressed.originalChars,
            compressedChars: compressed.compressedChars,
          },
          promptHash,
          fromSummary,
        };
      }
    }

    const maxCompletionTokens = Math.min(
      request.maxCompletionTokens ?? budget.maxCompletionTokens,
      budget.maxCompletionTokens
    );
    const response = await adapter.complete({
      model: request.model,
      prompt,
      maxOutputTokens: maxCompletionTokens,
      temperature: request.temperature ?? 0.2,
    });
    const promptTokens = response.inputTokens ?? estimatedPromptTokens;
    const completionTokens = response.outputTokens ?? estimateTokens(response.content);
    const totalTokens = promptTokens + completionTokens;

    if (!fromSummary && request.allowSummaryReuse !== false) {
      await writeReusableSummary({
        tenantId: request.tenantId,
        agent: request.agent,
        taskType: request.taskType,
        rawContextText,
        summaryText: compressed.compressedText,
      });
    }

    if (request.allowCache !== false && shouldUseCache(request.taskType, request.agent)) {
      await writeCachedResponse({
        tenantId: request.tenantId,
        agentName: request.agent,
        taskType: request.taskType,
        promptHash,
        inputFingerprint,
        responseText: response.content,
        promptTokens,
        completionTokens,
        totalTokens,
        responsePayload: {
          responseText: response.content,
          promptTokens,
          completionTokens,
          totalTokens,
          provider: adapter.providerName,
          model: request.model,
          parsedJson: response.parsedJson ?? null,
          rawResponse: response.rawResponse ?? null,
        },
        rawInputForSafety: request.contextBundle.data,
      });
    }

    if (promptLogId) {
      await updatePromptLogSuccess(promptLogId, {
        cacheHit: false,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
      });
    }

    return {
      response: response.content,
      cacheHit: false,
      promptLogId,
      warnings,
      tokenEstimate: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
      provider: adapter.providerName,
      model: request.model,
      responseText: response.content,
      cache: {
        hit: false,
        cacheKey: promptHash,
      },
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedPromptTokens,
      },
      compression: {
        wasCompressed: compressed.wasCompressed,
        originalChars: compressed.originalChars,
        compressedChars: compressed.compressedChars,
      },
      promptHash,
      fromSummary,
    };
  } catch (error) {
    if (promptLogId) {
      await updatePromptLogFailure(promptLogId, error);
    }
    throw error;
  }
}
