import { Command, CommanderError } from 'commander';
import { runExtract } from './commands/extract.js';
import { runParse } from './commands/parse.js';
import { runScore } from './commands/score.js';
import { toAppError } from './errors.js';
import { extractCandidate, scoreResume } from './services/ai.js';
import { loadEnvironment } from './services/env.js';
import { readJd } from './services/jd.js';
import { mockExtract, mockScore } from './services/mock.js';
import { readPdf } from './services/pdf.js';
import type {
  ExtractCandidate,
  MockExtract,
  MockScore,
  ReadJd,
  ReadPdf,
  ScoreResume,
  WriteResult,
} from './types.js';
import { renderAppError, terminalSafeDisplay } from './utils/error-output.js';
import { createLogger } from './utils/logger.js';
import { writeResult } from './utils/output.js';
import {
  createProgress,
  shouldShowProgress,
  silentProgress,
  type Progress,
} from './utils/progress.js';

export interface ProgramDependencies {
  loadEnvironment: typeof loadEnvironment;
  readPdf: ReadPdf;
  readJd: ReadJd;
  extractCandidate: ExtractCandidate;
  scoreResume: ScoreResume;
  mockExtract: MockExtract;
  mockScore: MockScore;
  writeResult: WriteResult;
  renderAppError: typeof renderAppError;
}

export interface ProgramIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
  progressFactory?: (enabled: boolean) => Progress;
  signalRuntime?: SignalRuntime;
}

export type CliSignal = 'SIGINT' | 'SIGTERM';

export interface SignalRuntime {
  onSignal(signal: CliSignal, handler: () => void): void;
  offSignal(signal: CliSignal, handler: () => void): void;
  propagateSignal(signal: CliSignal): void;
}

interface ManagedProgress {
  interrupted: boolean;
  progress: Progress;
  stopped: boolean;
}

interface ProgressScope {
  active?: ManagedProgress;
}

const defaultDependencies: ProgramDependencies = {
  loadEnvironment,
  readPdf,
  readJd,
  extractCandidate,
  scoreResume,
  mockExtract,
  mockScore,
  writeResult,
  renderAppError,
};

const defaultSignalRuntime: SignalRuntime = {
  onSignal: (signal, handler) => process.on(signal, handler),
  offSignal: (signal, handler) => process.off(signal, handler),
  propagateSignal: (signal) => process.kill(process.pid, signal),
};

const defaultIo: ProgramIo = {
  stdout: (message) => process.stdout.write(message.endsWith('\n') ? message : `${message}\n`),
  stderr: (message) => process.stderr.write(message.endsWith('\n') ? message : `${message}\n`),
  stdoutIsTTY: process.stdout.isTTY,
  stderrIsTTY: process.stderr.isTTY,
  progressFactory: (enabled) => createProgress({ enabled, stream: process.stderr }),
  signalRuntime: defaultSignalRuntime,
};

export function createProgram(
  dependencies: ProgramDependencies = defaultDependencies,
  io: ProgramIo = defaultIo,
): Command {
  return createProgramWithScope(dependencies, io, {});
}

function createProgramWithScope(
  dependencies: ProgramDependencies,
  io: ProgramIo,
  progressScope: ProgressScope,
): Command {
  const program = new Command();
  program
    .name('resume-cli')
    .description('解析 PDF 简历、提取结构化信息并进行 JD 匹配评分')
    .version('1.0.0')
    .option('-v, --verbose', '输出安全的诊断日志')
    .option('--no-progress', '关闭动态进度提示')
    .option('--env-file <path>', '从指定文件加载环境变量（默认读取当前目录的 .env）')
    .configureOutput({
      writeOut: io.stdout,
      writeErr: io.stderr,
      outputError: (message, write) => {
        const endsWithNewline = message.endsWith('\n');
        const body = endsWithNewline ? message.slice(0, -1) : message;
        write(`${terminalSafeDisplay(body)}${endsWithNewline ? '\n' : ''}`);
      },
    })
    .showHelpAfterError()
    .exitOverride();

  program.hook('preAction', async (rootCommand) => {
    const { envFile } = rootCommand.opts<{ envFile?: string }>();
    await dependencies.loadEnvironment({
      cwd: process.cwd(),
      env: process.env,
      ...(envFile ? { envFile } : {}),
    });
  });

  program
    .command('parse')
    .description('提取 PDF 简历中的文本')
    .argument('<pdf_path>', '本地 PDF 简历路径')
    .option('-o, --output <path>', '将结果保存到文件')
    .action(async (pdfPath: string, options: { output?: string }) => {
      loggerFor(program, io).debug(`parse: ${pdfPath}`);
      await runParse(
        pdfPath,
        { ...options, ...io, progress: progressFor(program, io, progressScope) },
        dependencies,
      );
    });

  program
    .command('extract')
    .description('用 AI 提取简历结构化信息')
    .argument('<pdf_path>', '本地 PDF 简历路径')
    .option('--mock', '使用离线 mock 模式')
    .option('-o, --output <path>', '将 JSON 保存到文件')
    .action(async (pdfPath: string, options: { mock?: boolean; output?: string }) => {
      loggerFor(program, io).debug(`extract${options.mock ? ' (mock)' : ''}: ${pdfPath}`);
      await runExtract(
        pdfPath,
        { ...options, ...io, progress: progressFor(program, io, progressScope) },
        dependencies,
      );
    });

  program
    .command('score')
    .description('根据 JD 对简历进行匹配评分')
    .argument('<pdf_path>', '本地 PDF 简历路径')
    .requiredOption('--jd <path>', '岗位描述文本文件路径')
    .option('--mock', '使用离线 mock 模式')
    .option('-o, --output <path>', '将 JSON 保存到文件')
    .action(async (
      pdfPath: string,
      options: { jd: string; mock?: boolean; output?: string },
    ) => {
      loggerFor(program, io).debug(`score${options.mock ? ' (mock)' : ''}: ${pdfPath}`);
      await runScore(
        pdfPath,
        { ...options, ...io, progress: progressFor(program, io, progressScope) },
        dependencies,
      );
    });

  return program;
}

export async function runCli(
  args: string[],
  dependencies: ProgramDependencies = defaultDependencies,
  io: ProgramIo = defaultIo,
): Promise<number> {
  const progressScope: ProgressScope = {};
  const program = createProgramWithScope(dependencies, io, progressScope);
  const removeSignalHandlers = installSignalHandlers(
    progressScope,
    io.signalRuntime ?? defaultSignalRuntime,
  );
  try {
    await program.parseAsync(args, { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        return 0;
      }
      return 2;
    }

    const appError = toAppError(error);
    let renderedError: string;
    try {
      renderedError = await dependencies.renderAppError(appError, { cwd: process.cwd(), args });
    } catch {
      renderedError = '错误：操作失败，请使用 --verbose 查看错误代码。';
    }
    io.stderr(renderedError);
    if (program.opts<{ verbose?: boolean }>().verbose) {
      writeDiagnostic(io, `[debug] code=${appError.code}`);
    }
    return appError.exitCode;
  } finally {
    removeSignalHandlers();
  }
}

function loggerFor(program: Command, io: ProgramIo) {
  return createLogger(
    Boolean(program.opts<{ verbose?: boolean }>().verbose),
    (message) => writeDiagnostic(io, message),
  );
}

function writeDiagnostic(io: ProgramIo, message: string): void {
  io.stderr(terminalSafeDisplay(message));
}

function progressFor(program: Command, io: ProgramIo, scope: ProgressScope): Progress {
  const progress = io.progressFactory?.(shouldShowProgress({
    stdoutIsTTY: Boolean(io.stdoutIsTTY),
    stderrIsTTY: Boolean(io.stderrIsTTY),
    ci: Boolean(process.env.CI),
    disabled: program.opts<{ progress?: boolean }>().progress === false,
  })) ?? silentProgress;
  const managed: ManagedProgress = { interrupted: false, progress, stopped: false };

  return {
    start(text) {
      scope.active = managed;
      try {
        progress.start(text);
      } catch (error) {
        clearActiveProgress(scope, managed);
        throw error;
      }
    },
    update(text) {
      if (!managed.interrupted) progress.update(text);
    },
    stop() {
      stopManagedProgress(scope, managed);
    },
    succeed(text) {
      if (managed.interrupted) return;
      try {
        progress.succeed(text);
      } finally {
        clearActiveProgress(scope, managed);
      }
    },
  };
}

function stopManagedProgress(scope: ProgressScope, managed: ManagedProgress): void {
  if (managed.stopped) return;
  managed.stopped = true;
  try {
    managed.progress.stop();
  } finally {
    clearActiveProgress(scope, managed);
  }
}

function clearActiveProgress(scope: ProgressScope, managed: ManagedProgress): void {
  if (scope.active === managed) delete scope.active;
}

function installSignalHandlers(scope: ProgressScope, runtime: SignalRuntime): () => void {
  let installed = true;
  const remove = () => {
    if (!installed) return;
    installed = false;
    runtime.offSignal('SIGINT', onSigint);
    runtime.offSignal('SIGTERM', onSigterm);
  };
  const handle = (signal: CliSignal) => {
    const active = scope.active;
    if (active !== undefined) {
      active.interrupted = true;
      try {
        stopManagedProgress(scope, active);
      } catch {
        // Signal propagation must not be blocked by progress cleanup.
      }
    }
    remove();
    runtime.propagateSignal(signal);
  };
  const onSigint = () => handle('SIGINT');
  const onSigterm = () => handle('SIGTERM');

  runtime.onSignal('SIGINT', onSigint);
  runtime.onSignal('SIGTERM', onSigterm);
  return remove;
}
