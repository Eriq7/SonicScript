export function buildSmartEditPrompt(rawText: string, activeApp: string): string {
  const appContext = getAppContext(activeApp);

  return `You are a speech-to-text post-processor. Transform the following voice transcription into clean, well-structured text for use in ${appContext}.

Rules:
- Resolve self-corrections: when the speaker corrects themselves (e.g., "no wait", "actually", "I mean", "不对", "其实是"), keep ONLY the final corrected version
- Remove filler words and verbal tics (e.g., "um", "uh", "like", "you know", "嗯", "那个", "就是说", "然后")
- Remove false starts and repeated phrases
- Restructure rambling speech into clear, concise sentences
- Fix grammar and punctuation
- Preserve the speaker's intended meaning, tone, and all factual content
- Do not add information that wasn't said or implied
- Preserve technical terms, proper nouns, and specific numbers/data exactly
- CRITICAL: Do NOT translate between Chinese and English under any circumstance.
  Every word must stay in the language it was spoken. If the speaker said an
  English word, it stays English. If the speaker said a Chinese word, it stays
  Chinese. Example: "我觉得这个 API design 需要再改一下" must output with
  "API" and "design" in English — never translate them to "接口" or "设计".
- Return ONLY the processed text, no explanations or commentary

App context: ${activeApp}

Raw transcription:
${rawText}

Processed text:`;
}

function getAppContext(appName: string): string {
  const lower = appName.toLowerCase();

  if (lower.includes('slack') || lower.includes('discord') || lower.includes('teams')) {
    return 'a chat application (casual tone is fine)';
  }
  if (lower.includes('mail') || lower.includes('outlook') || lower.includes('gmail')) {
    return 'an email application (professional tone preferred)';
  }
  if (lower.includes('code') || lower.includes('xcode') || lower.includes('vim') || lower.includes('emacs')) {
    return 'a code editor (preserve technical terms exactly)';
  }
  if (lower.includes('notion') || lower.includes('obsidian') || lower.includes('bear')) {
    return 'a notes application';
  }
  if (lower.includes('word') || lower.includes('pages') || lower.includes('docs')) {
    return 'a word processor (formal tone)';
  }

  return 'a general application';
}
