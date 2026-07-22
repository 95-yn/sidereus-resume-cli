import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { AppError } from '../errors.js';

export type PdfTextParser = (data: Uint8Array) => Promise<string>;

export async function readPdf(
  inputPath: string,
  parser: PdfTextParser = parsePdfText,
): Promise<string> {
  const path = resolve(inputPath);
  let fileStat;

  try {
    fileStat = await stat(path);
  } catch (cause) {
    throw new AppError(`PDF 文件不存在：${inputPath}`, {
      code: 'PDF_NOT_FOUND',
      exitCode: 2,
      cause,
    });
  }

  if (!fileStat.isFile()) {
    throw new AppError(`PDF 路径不是文件：${inputPath}`, {
      code: 'PDF_NOT_FILE',
      exitCode: 2,
    });
  }

  if (extname(path).toLowerCase() !== '.pdf') {
    throw notPdfError(inputPath);
  }

  const data = await readFile(path);
  if (data.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw notPdfError(inputPath);
  }

  let text: string;
  try {
    text = await parser(data);
  } catch (cause) {
    throw new AppError(`PDF 无法读取或已损坏：${inputPath}`, {
      code: 'PDF_PARSE_FAILED',
      cause,
    });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError('PDF 未提取到文本；如果是扫描件，请先执行 OCR。', {
      code: 'PDF_EMPTY',
      exitCode: 2,
    });
  }

  return trimmed;
}

async function parsePdfText(data: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function notPdfError(path: string): AppError {
  return new AppError(`文件不是有效的 PDF：${path}`, {
    code: 'NOT_PDF',
    exitCode: 2,
  });
}
