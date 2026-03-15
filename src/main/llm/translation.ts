/**
 * translation.ts — Translation prompt construction for long-press translate mode.
 *
 * Main exports:
 *   - buildTranslationPrompt(text, activeApp): string
 *
 * Design notes:
 *   - buildTranslationPrompt combines translation + cleanup in a single LLM call
 *     for speed (no second API round-trip needed)
 *   - Translation is triggered by long-pressing the hotkey (deterministic gesture),
 *     not by keyword detection
 */
import { getAppContext } from './prompts';

export function buildTranslationPrompt(text: string, activeApp: string): string {
  const appContext = getAppContext(activeApp);

  return `You are a speech-to-text post-processor. The user spoke in Chinese and wants the output in English for use in ${appContext}.

Tasks (combined into one pass for speed):
1. Translate the text from Chinese to English
2. Remove filler words and verbal tics (e.g., "嗯", "那个", "就是说", "然后", "um", "uh")
3. Resolve self-corrections — keep only the final corrected version
4. Fix grammar and punctuation
5. Preserve technical terms, proper nouns, and specific numbers/data exactly
6. Return ONLY the final English text, no explanations or commentary

App context: ${appContext}

Chinese input:
${text}

English output:`;
}
