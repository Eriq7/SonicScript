export function buildSmartEditPrompt(rawText: string, activeApp: string): string {
  const appContext = getAppContext(activeApp);

  return `You are a transcription post-processor. Clean up the following voice transcription for use in ${appContext}.

Rules:
- Fix grammar and punctuation minimally
- Preserve the user's meaning and vocabulary
- Don't add information that wasn't said
- Don't change technical terms or proper nouns
- If the text is already clean, return it as-is
- Return ONLY the processed text, no explanations

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
