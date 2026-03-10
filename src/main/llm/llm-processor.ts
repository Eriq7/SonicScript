import OpenAI from 'openai';
import { buildSmartEditPrompt } from './prompts';
import { getActiveAppName } from './active-app';
import type { LLMSettings } from '../../shared/types';

export async function processWithLLM(
  rawText: string,
  settings: LLMSettings,
): Promise<string> {
  if (!settings.enabled || !settings.apiKey || settings.mode === 'none') {
    return rawText;
  }

  const activeApp = await getActiveAppName();
  const prompt = buildSmartEditPrompt(rawText, activeApp);

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: 'https://api.openai.com/v1',
  });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
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
