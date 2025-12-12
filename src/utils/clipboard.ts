/**
 * Clipboard utilities for macOS
 */

import { $ } from "bun";

/**
 * Copy text to clipboard using pbcopy (macOS)
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Write to a temp file and cat it to pbcopy to handle multiline content
  const tempFile = `/tmp/cpo-clipboard-${Date.now()}.txt`;
  await Bun.write(tempFile, text);
  await $`cat ${tempFile} | pbcopy`.quiet();
  await $`rm ${tempFile}`.quiet();
}

/**
 * Check if clipboard is available
 */
export async function isClipboardAvailable(): Promise<boolean> {
  try {
    await $`which pbcopy`.quiet();
    return true;
  } catch {
    return false;
  }
}
