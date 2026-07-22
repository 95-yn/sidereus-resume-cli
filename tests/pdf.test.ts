import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { readPdf, type PdfTextParser } from '../src/services/pdf.js';

async function tempPath(name: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'resume-cli-pdf-'));
  return join(directory, name);
}

async function pdfFile(name = 'resume.pdf'): Promise<string> {
  const path = await tempPath(name);
  await writeFile(path, Buffer.from('%PDF-1.7\nmock'));
  return path;
}

describe('readPdf', () => {
  it('returns trimmed parser text', async () => {
    const path = await pdfFile();
    const parser: PdfTextParser = vi.fn().mockResolvedValue('  Ada resume  \n');
    await expect(readPdf(path, parser)).resolves.toBe('Ada resume');
  });

  it('rejects missing files', async () => {
    const inputPath = relative(process.cwd(), await tempPath('missing.pdf'));
    const error = await readPdf(inputPath).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      code: 'PDF_NOT_FOUND',
      exitCode: 2,
    });
    expect((error as { fileGuidance: unknown }).fileGuidance).toEqual({ kind: 'pdf', inputPath });
  });

  it('rejects directory paths with guidance using the original input', async () => {
    const absolutePath = await tempPath('folder');
    await mkdir(absolutePath);
    const inputPath = relative(process.cwd(), absolutePath);

    const error = await readPdf(inputPath).catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      code: 'PDF_NOT_FILE',
      exitCode: 2,
    });
    expect((error as { fileGuidance: unknown }).fileGuidance).toEqual({ kind: 'pdf', inputPath });
  });

  it('rejects non-PDF extensions', async () => {
    const path = await tempPath('resume.txt');
    await writeFile(path, '%PDF-1.7');
    await expect(readPdf(path)).rejects.toMatchObject({ code: 'NOT_PDF', exitCode: 2 });
  });

  it('rejects files without a PDF signature', async () => {
    const path = await tempPath('resume.pdf');
    await writeFile(path, 'plain text');
    const error = await readPdf(path).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: 'NOT_PDF', exitCode: 2 });
    expect(error).toMatchObject({ fileGuidance: undefined });
  });

  it('maps parser failures', async () => {
    const path = await pdfFile();
    const parser: PdfTextParser = vi.fn().mockRejectedValue(new Error('damaged xref'));
    await expect(readPdf(path, parser)).rejects.toMatchObject({
      code: 'PDF_PARSE_FAILED',
      exitCode: 1,
    });
  });

  it('rejects PDFs without extractable text', async () => {
    const path = await pdfFile();
    const parser: PdfTextParser = vi.fn().mockResolvedValue(' \n ');
    const error = await readPdf(path, parser).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: 'PDF_EMPTY', exitCode: 2 });
    expect(error).toMatchObject({ fileGuidance: undefined });
  });
});
