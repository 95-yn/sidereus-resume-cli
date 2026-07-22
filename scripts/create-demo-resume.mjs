import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';

const outputPath = resolve(process.argv[2] ?? 'examples/resume.pdf');
await mkdir(dirname(outputPath), { recursive: true });

const document = new PDFDocument({ margin: 48 });
const stream = createWriteStream(outputPath);
document.pipe(stream);
document.fontSize(22).text('Ada Lovelace');
document.moveDown();
document.fontSize(12).text('ada@example.com | +86 138-0013-8000 | Beijing');
document.moveDown();
document.text('Five years of full-stack engineering experience.');
document.text('Skills: TypeScript, Node.js, React, PostgreSQL, Docker, OpenAI.');
document.text('Education: Bachelor of Mathematics, University of London, 2020.');
document.end();

await new Promise((resolveStream, reject) => {
  stream.on('finish', resolveStream);
  stream.on('error', reject);
});

console.log(`Demo PDF created: ${outputPath}`);
