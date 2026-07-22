import { Command, CommanderError } from 'commander';
import { runExtract } from './commands/extract.js';
import { runParse } from './commands/parse.js';
import { runScore } from './commands/score.js';
import { toAppError } from './errors.js';
import { extractCandidate, scoreResume } from './services/ai.js';
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
import { createLogger } from './utils/logger.js';
import { writeResult } from './utils/output.js';

export interface ProgramDependencies {
  readPdf: ReadPdf;
  readJd: ReadJd;
  extractCandidate: ExtractCandidate;
  scoreResume: ScoreResume;
  mockExtract: MockExtract;
  mockScore: MockScore;
  writeResult: WriteResult;
}

export interface ProgramIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

const defaultDependencies: ProgramDependencies = {
  readPdf,
  readJd,
  extractCandidate,
  scoreResume,
  mockExtract,
  mockScore,
  writeResult,
};

const defaultIo: ProgramIo = {
  stdout: (message) => process.stdout.write(message.endsWith('\n') ? message : `${message}\n`),
  stderr: (message) => process.stderr.write(message.endsWith('\n') ? message : `${message}\n`),
};

export function createProgram(
  dependencies: ProgramDependencies = defaultDependencies,
  io: ProgramIo = defaultIo,
): Command {
  const program = new Command();
  program
    .name('resume-cli')
    .description('解析 PDF 简历、提取结构化信息并进行 JD 匹配评分')
    .version('1.0.0')
    .option('-v, --verbose', '输出安全的诊断日志')
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .showHelpAfterError()
    .exitOverride();

  program
    .command('parse')
    .description('提取 PDF 简历中的文本')
    .argument('<pdf_path>', '本地 PDF 简历路径')
    .option('-o, --output <path>', '将结果保存到文件')
    .action(async (pdfPath: string, options: { output?: string }) => {
      loggerFor(program, io).debug(`parse: ${pdfPath}`);
      await runParse(pdfPath, { ...options, ...io }, dependencies);
    });

  program
    .command('extract')
    .description('用 AI 提取简历结构化信息')
    .argument('<pdf_path>', '本地 PDF 简历路径')
    .option('--mock', '使用离线 mock 模式')
    .option('-o, --output <path>', '将 JSON 保存到文件')
    .action(async (pdfPath: string, options: { mock?: boolean; output?: string }) => {
      loggerFor(program, io).debug(`extract${options.mock ? ' (mock)' : ''}: ${pdfPath}`);
      await runExtract(pdfPath, { ...options, ...io }, dependencies);
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
      await runScore(pdfPath, { ...options, ...io }, dependencies);
    });

  return program;
}

export async function runCli(
  args: string[],
  dependencies: ProgramDependencies = defaultDependencies,
  io: ProgramIo = defaultIo,
): Promise<number> {
  const program = createProgram(dependencies, io);
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
    io.stderr(`错误：${appError.message}`);
    if (program.opts<{ verbose?: boolean }>().verbose) {
      io.stderr(`[debug] code=${appError.code}`);
    }
    return appError.exitCode;
  }
}

function loggerFor(program: Command, io: ProgramIo) {
  return createLogger(Boolean(program.opts<{ verbose?: boolean }>().verbose), io.stderr);
}
