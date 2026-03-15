/**
 * llm-processor.ts — Optional LLM post-processing of raw transcription text.
 *
 * Main exports:
 *   - processWithLLM(rawText, settings, translate?): Promise<string>
 *       translate=false: Smart Edit — returns cleaned text, or rawText on error/disabled
 *       translate=true:  Translation — throws if LLM unavailable (explicit failure)
 *
 * I/O data types:
 *   - LLMSettings → { enabled, apiKey, baseURL, model, mode }
 *   - string (rawText) → string (processed or passthrough)
 *
 * Execution flow:
 *   1. Guard: return rawText if empty
 *   2. If translate=true: throw if LLM not configured; otherwise call buildTranslationPrompt
 *   3. Smart Edit (only if mode === 'smart-edit'): cleanup via callLLM; fallback = rawText
 *
 * Design notes:
 *   - Translation throws loudly when LLM is unavailable — user sees error widget
 *   - Smart Edit silently falls back to rawText — non-critical enhancement
 *   - Configurable baseURL supports non-OpenAI endpoints (e.g. OpenRouter, local models)
 */
import OpenAI from 'openai';
import { buildSmartEditPrompt } from './prompts';
import { buildTranslationPrompt } from './translation';
import { getActiveAppName } from './active-app';
import type { LLMSettings } from '../../shared/types';

async function callLLM(
  prompt: string,
  settings: LLMSettings,
  fallbackText: string,
): Promise<string> {
  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
    timeout: 15_000,
  });

  try {
    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.1,
    });
    return response.choices[0]?.message?.content?.trim() ?? fallbackText;
  } catch (err) {
    console.error('[LLMProcessor] LLM call failed:', err);
    return fallbackText;
  }
}

export async function processWithLLM(
  rawText: string,
  settings: LLMSettings,
  translate: boolean = false,
): Promise<string> {
  if (!rawText.trim()) return rawText;

  // Translation requires LLM — fail loudly if unavailable
  if (translate) {
    if (!settings.enabled || !settings.apiKey) {
      throw new Error('Translation requires AI Features to be enabled with an API key');
    }
    const activeApp = await getActiveAppName();
    return callLLM(
      buildTranslationPrompt(rawText, activeApp),
      settings,
      rawText,
    );
  }

  // Smart Edit — silent fallback is OK (non-critical enhancement)
  if (!settings.enabled || !settings.apiKey || settings.mode === 'none') {
    return rawText;
  }
  const activeApp = await getActiveAppName();
  return callLLM(
    buildSmartEditPrompt(rawText, activeApp),
    settings,
    rawText,
  );
}
