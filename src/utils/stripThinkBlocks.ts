/**
 * Strips <think>...</think> reasoning blocks from model output.
 * Handles complete blocks, blocks missing the opening tag, and in-progress blocks.
 */
export function stripThinkBlocks(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>\n?/gi, '')
    .replace(/^[\s\S]*?<\/think>\n?/, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trimStart()
}
