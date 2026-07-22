import ora from 'ora';

export interface Progress {
  start(text: string): void;
  update(text: string): void;
  stop(): void;
  succeed(text: string): void;
}

export interface ProgressPolicy {
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  ci?: boolean;
  disabled?: boolean;
}

export function shouldShowProgress(policy: ProgressPolicy): boolean {
  return Boolean(policy.stdoutIsTTY && policy.stderrIsTTY && !policy.ci && !policy.disabled);
}

export const silentProgress: Progress = {
  start: () => {},
  update: () => {},
  stop: () => {},
  succeed: () => {},
};

export function createProgress(options: {
  enabled: boolean;
  stream?: NodeJS.WriteStream;
}): Progress {
  const spinner = ora({
    isEnabled: options.enabled,
    discardStdin: false,
    ...(options.enabled ? {} : { isSilent: true }),
    ...(options.stream === undefined ? {} : { stream: options.stream }),
  });

  return {
    start(text) {
      spinner.start(text);
    },
    update(text) {
      if (spinner.isSpinning) {
        spinner.text = text;
        return;
      }

      spinner.start(text);
    },
    stop() {
      spinner.stop();
    },
    succeed(text) {
      spinner.succeed(text);
    },
  };
}
