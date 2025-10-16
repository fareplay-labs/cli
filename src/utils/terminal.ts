import terminalKit from 'terminal-kit';

const term = terminalKit.terminal;

/**
 * Enable alternate screen buffer (fullscreen mode)
 * This clears the screen and prevents scrolling
 */
export function enterFullscreen(): void {
  term.fullscreen(true);
  term.clear();
}

/**
 * Disable alternate screen buffer (restore normal terminal)
 */
export function exitFullscreen(): void {
  term.fullscreen(false);
}

/**
 * Run a function in fullscreen mode
 * Automatically restores terminal on completion or error
 * 
 * NOTE: Temporarily disabled to allow error visibility during development
 */
export async function withFullscreen<T>(fn: () => Promise<T>): Promise<T> {
  // TODO: Re-enable fullscreen once we have better error handling
  // For now, just run without fullscreen so errors are visible
  return fn();
  
  /* Disabled for now
  enterFullscreen();
  
  try {
    const result = await fn();
    exitFullscreen();
    return result;
  } catch (error) {
    // Don't clear screen on error - leave output visible
    exitFullscreen();
    throw error;
  }
  */
}

/**
 * Clear the screen (useful in fullscreen mode)
 */
export function clearScreen(): void {
  term.clear();
}

/**
 * Move cursor to top-left
 */
export function resetCursor(): void {
  term.moveTo(1, 1);
}

