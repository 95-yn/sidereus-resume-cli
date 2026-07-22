export interface Logger {
  debug(message: string): void;
}

export function createLogger(
  verbose: boolean,
  stderr: (message: string) => void = console.error,
): Logger {
  return {
    debug(message: string) {
      if (verbose) {
        stderr(`[debug] ${message}`);
      }
    },
  };
}
