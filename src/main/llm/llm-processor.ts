/**
 * llm-processor.ts — Optional LLM post-processing of raw transcription text.
 *
 * Main exports:
 *   - processWithLLM(rawText, settings): Promise<string>
 *       Returns cleaned text, or rawText unchanged on any error or when disabled
 *
 * I/O data types:
 *   - LLMSettings → { enabled, apiKey, baseURL, model, mode }
 *   - string (rawText) → string (processed or passthrough)
 *
 * Execution flow:
 *   1. Guard: return rawText if empty, disabled, no API key, or mode === 'none'
 *   2. getActiveAppName() — detect frontmost app for context-aware prompt
 *   3. buildSmartEditPrompt(rawText, appName) — construct user message
 *   4. OpenAI chat completion with 15s timeout, temperature=0.1, max_tokens=1000
 *   5. Return trimmed response, or rawText on any exception (graceful degradation)
 *
 * Design notes:
 *   - Configurable baseURL supports non-OpenAI endpoints (e.g. OpenRouter, local models)
 *   - Any error (network, auth, timeout) silently falls back to raw text —
 *     transcription must always succeed even if Smart Edit is broken
 */
import OpenAI from 'openai';
import { buildSmartEditPrompt } from './prompts';
import { getActiveAppName } from './active-app';
import type { LLMSettings } from '../../shared/types';

export async function processWithLLM(
  rawText: string,
  settings: LLMSettings,
): Promise<string> {
  if (!rawText.trim()) return rawText;
  if (!settings.enabled || !settings.apiKey || settings.mode === 'none') {
    return rawText;
  }

  const activeApp = await getActiveAppName();
  const prompt = buildSmartEditPrompt(rawText, activeApp);

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

    return response.choices[0]?.message?.content?.trim() ?? rawText;
  } catch (err) {
    console.error('[LLMProcessor] LLM call failed:', err);
    return rawText; // Fall back to raw transcription
  }
}
