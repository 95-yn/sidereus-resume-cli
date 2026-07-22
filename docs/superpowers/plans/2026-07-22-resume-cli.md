# Resume CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality TypeScript CLI that parses PDF resumes, extracts structured candidate data, and scores a resume against a text JD through OpenAI or a deterministic mock mode.

**Architecture:** Keep I/O adapters (`pdf`, `jd`, `openai`, `output`) separate from schemas and command orchestration. Commands accept injected dependencies so tests exercise real orchestration without network access. Commander owns CLI parsing and maps typed application errors to stable exit codes.

**Tech Stack:** Node.js 20+, TypeScript ESM, Commander, pdf-parse, OpenAI SDK, Zod, Vitest, tsup, ESLint

---

## File map

- `src/cli.ts`: executable Commander entry point and error boundary.
- `src/program.ts`: construct the Commander program for integration tests.
- `src/errors.ts`: typed application errors and exit-code mapping.
- `src/types.ts`: command dependency interfaces.
- `src/commands/{parse,extract,score}.ts`: command use cases.
- `src/services/{pdf,jd,ai,mock}.ts`: external input and AI adapters.
- `src/schemas/{candidate,score}.ts`: Zod contracts and inferred types.
- `src/utils/{json,output,logger}.ts`: JSON recovery, result output, and safe diagnostics.
- `tests/**/*.test.ts`: unit and CLI integration tests.
- `examples/jd.txt`: demonstrable JD input.
- `README.md`, `.env.example`, `Dockerfile`, `Makefile`: delivery documentation and tooling.

### Task 1: Project scaffold and error contract

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Create: `.gitignore`
- Test: `tests/errors.test.ts`
- Create: `src/errors.ts`

- [ ] **Step 1: Add package/config files and install dependencies**

Use ESM, expose `dist/cli.js` as `resume-cli`, and define `build`, `test`, `typecheck`, `lint`, and `check` scripts. Install runtime packages `commander`, `openai`, `pdf-parse`, and `zod`; install TypeScript, tsup, Vitest, ESLint, Node types, and `pdfkit` for fixtures as dev dependencies.

- [ ] **Step 2: Write the failing error-contract test**

```ts
import { describe, expect, it } from 'vitest';
import { AppError, toAppError } from '../src/errors.js';

describe('application errors', () => {
  it('preserves a typed user error', () => {
    const original = new AppError('missing', { exitCode: 2, code: 'FILE_NOT_FOUND' });
    expect(toAppError(original)).toBe(original);
  });

  it('hides unexpected internal details', () => {
    const result = toAppError(new Error('secret implementation detail'));
    expect(result.message).toBe('发生未预期错误，请使用 --verbose 查看原因。');
    expect(result.exitCode).toBe(1);
  });
});
```

- [ ] **Step 3: Run the test and verify RED**

Run `npm test -- tests/errors.test.ts`; expect failure because `src/errors.ts` does not exist.

- [ ] **Step 4: Implement the error contract**

Define `AppErrorOptions { code: string; exitCode?: 1 | 2; cause?: unknown }`, an `AppError` class with default exit code 1, and `toAppError(error)` that preserves `AppError` instances and wraps unknown errors with the safe message above.

- [ ] **Step 5: Run GREEN and commit**

Run `npm test -- tests/errors.test.ts`, `npm run typecheck`, then commit scaffold and error files.

### Task 2: Schemas and resilient JSON parsing

**Files:**
- Test: `tests/schemas.test.ts`
- Test: `tests/json.test.ts`
- Create: `src/schemas/candidate.ts`
- Create: `src/schemas/score.ts`
- Create: `src/utils/json.ts`

- [ ] **Step 1: Write failing schema boundary tests**

Test that candidate fields and education entries are required strings, and that score fields accept integer values from 0 through 100 but reject `101`, decimals, empty comments, and empty interview-question arrays.

- [ ] **Step 2: Run schema tests and verify RED**

Run `npm test -- tests/schemas.test.ts`; expect missing-module failure.

- [ ] **Step 3: Implement Zod schemas**

Export `candidateSchema`, `Candidate`, `scoreSchema`, and `ScoreResult`. Candidate contains `name`, `phone`, `email`, `city`, `education[]` with `school`, `major`, `degree`, `graduation_time`, and `skills[]`. Score contains four bounded integer scores, non-empty `comment`, and a non-empty array of non-empty `interview_questions`.

- [ ] **Step 4: Run schema tests and verify GREEN**

Run `npm test -- tests/schemas.test.ts`; expect all schema tests to pass.

- [ ] **Step 5: Write failing JSON recovery tests**

```ts
expect(parseModelJson('```json\n{"name":"Ada",}\n```')).toEqual({ name: 'Ada' });
expect(parseModelJson('Result: {"name":"Ada"} Thanks')).toEqual({ name: 'Ada' });
expect(() => parseModelJson('not json')).toThrow(/有效的 JSON/);
```

- [ ] **Step 6: Run JSON tests and verify RED**

Run `npm test -- tests/json.test.ts`; expect missing implementation.

- [ ] **Step 7: Implement bounded JSON recovery**

Strip BOM and Markdown fences, slice from the first `{` through the matching final `}`, remove commas immediately preceding `}` or `]`, then call `JSON.parse`. Throw `AppError` with code `INVALID_AI_JSON` on failure.

- [ ] **Step 8: Run GREEN and commit**

Run both test files and `npm run typecheck`, then commit schemas and JSON utilities.

### Task 3: File readers and output adapter

**Files:**
- Test: `tests/jd.test.ts`
- Test: `tests/pdf.test.ts`
- Test: `tests/output.test.ts`
- Create: `src/services/jd.ts`
- Create: `src/services/pdf.ts`
- Create: `src/utils/output.ts`

- [ ] **Step 1: Write failing JD tests**

Use a temporary directory to assert successful trimmed UTF-8 reads and user errors for missing files, directories, and whitespace-only content.

- [ ] **Step 2: Run JD tests and verify RED**

Run `npm test -- tests/jd.test.ts`; expect missing module.

- [ ] **Step 3: Implement `readJd(path)`**

Resolve the path, verify it is a regular file, read UTF-8, trim, and throw exit-code-2 `AppError`s with codes `JD_NOT_FOUND`, `JD_NOT_FILE`, or `JD_EMPTY`.

- [ ] **Step 4: Run JD tests and verify GREEN**

Run `npm test -- tests/jd.test.ts`.

- [ ] **Step 5: Write failing PDF tests**

Inject a parser into `readPdf(path, parser?)`. Test missing paths, non-`.pdf` paths, parser failures, empty extracted text, and successful trimming. Use `pdfkit` only to create an integration fixture for the default parser.

- [ ] **Step 6: Run PDF tests and verify RED**

Run `npm test -- tests/pdf.test.ts`; expect missing module.

- [ ] **Step 7: Implement `readPdf`**

Validate existence, regular-file status, case-insensitive `.pdf` extension, and `%PDF-` magic bytes before parsing. Map invalid inputs to exit code 2, parser failures to exit code 1, and empty text to exit code 2 with an OCR guidance message.

- [ ] **Step 8: Run PDF tests and verify GREEN**

Run `npm test -- tests/pdf.test.ts`.

- [ ] **Step 9: Write failing output tests**

Assert that absent output paths call the provided stdout writer once, while output paths create parent directories, write exact UTF-8 content, and emit a short saved-path notice.

- [ ] **Step 10: Implement and verify output**

Implement `writeResult(content, { outputPath, stdout, stderr })`, run all Task 3 tests, then commit.

### Task 4: Mock mode and OpenAI adapter

**Files:**
- Test: `tests/mock.test.ts`
- Test: `tests/ai.test.ts`
- Create: `src/services/mock.ts`
- Create: `src/services/ai.ts`
- Create: `src/utils/logger.ts`

- [ ] **Step 1: Write failing deterministic mock tests**

Assert `mockExtract` discovers an email, phone, obvious skills, and returns stable output. Assert `mockScore` returns all scores as bounded integers, a reason, and at least two interview questions for identical input.

- [ ] **Step 2: Run mock tests and verify RED**

Run `npm test -- tests/mock.test.ts`.

- [ ] **Step 3: Implement mock extraction and scoring**

Use regex only for email/phone and a fixed case-insensitive skill dictionary. Score skill overlap deterministically, derive conservative experience/education scores from keyword signals, clamp all values, and explain that results are mock estimates.

- [ ] **Step 4: Run mock tests and verify GREEN**

Run `npm test -- tests/mock.test.ts`.

- [ ] **Step 5: Write failing AI adapter tests**

Inject an object exposing `responses.parse`. Assert missing `OPENAI_API_KEY` fails before client construction, valid structured data passes Zod, malformed data produces `INVALID_AI_RESPONSE`, and provider failures become a clear `AI_REQUEST_FAILED` error without leaking the key.

- [ ] **Step 6: Run AI tests and verify RED**

Run `npm test -- tests/ai.test.ts`.

- [ ] **Step 7: Implement OpenAI extraction and scoring**

Use OpenAI Responses API with `zodTextFormat` from `openai/helpers/zod`, system instructions that treat resume/JD text as untrusted data, and injected environment/client options. Parse the returned structured object again with the local Zod schema. Use `OPENAI_MODEL ?? 'gpt-5.6'`, matching the current Structured Outputs guide while still allowing a cheaper compatible model through configuration.

- [ ] **Step 8: Implement safe verbose logger**

Write diagnostics to stderr only when enabled. Log operation names, file paths, model, and safe error messages; never log API keys or full input contents.

- [ ] **Step 9: Run GREEN and commit**

Run Task 4 tests and `npm run typecheck`, then commit.

### Task 5: Command orchestration and CLI integration

**Files:**
- Create: `src/types.ts`
- Test: `tests/commands.test.ts`
- Test: `tests/cli.test.ts`
- Create: `src/commands/parse.ts`
- Create: `src/commands/extract.ts`
- Create: `src/commands/score.ts`
- Create: `src/program.ts`
- Create: `src/cli.ts`

- [ ] **Step 1: Write failing command tests**

Inject fake readers, AI functions, mocks, and writers. Verify parse forwards raw text; extract and score choose mock adapters only with `--mock`; score forwards JD text; all structured results are pretty-printed JSON; `--output` propagates.

- [ ] **Step 2: Run command tests and verify RED**

Run `npm test -- tests/commands.test.ts`.

- [ ] **Step 3: Implement dependency interfaces and commands**

Define focused dependency types and implement each command as a small async use case. Validate mock results with the same Zod schemas before formatting.

- [ ] **Step 4: Run command tests and verify GREEN**

Run `npm test -- tests/commands.test.ts`.

- [ ] **Step 5: Write failing CLI tests**

Construct the program with injected dependencies. Test root help, all three command help pages, missing `--jd`, mock dispatch, clean JSON stdout, user-error exit code 2, and unexpected-error exit code 1.

- [ ] **Step 6: Run CLI tests and verify RED**

Run `npm test -- tests/cli.test.ts`.

- [ ] **Step 7: Implement Commander program and executable**

Set `.name('resume-cli')`, descriptions, arguments, options, and `exitOverride()`. Map command actions to use cases. Add a `#!/usr/bin/env node` entry point that loads `.env` via Node's environment support expectation, catches errors, prints one safe line to stderr, and sets `process.exitCode`.

- [ ] **Step 8: Run CLI tests, typecheck, and commit**

Run Task 5 tests, `npm run typecheck`, and `npm run build`, then commit.

### Task 6: Delivery assets and complete verification

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `examples/jd.txt`
- Create: `Dockerfile`
- Create: `Makefile`
- Modify: `package.json`

- [ ] **Step 1: Write delivery documentation**

Document project purpose, architecture, Node requirements, `OPENAI_API_KEY`, optional `OPENAI_MODEL`, installation, build/link instructions, three commands, mock/output/verbose options, JSON examples, Docker/Make usage, implemented features, security notes, and known limitation that scanned PDFs need OCR.

- [ ] **Step 2: Add reproducible tooling**

Create a multi-stage Node 20 Dockerfile with a non-root runtime, a Makefile exposing `install`, `build`, `test`, `check`, and `demo`, `.env.example` without secrets, and a representative full-stack JD.

- [ ] **Step 3: Run focused CLI demonstrations**

Generate a temporary text PDF fixture, run built `parse`, `extract --mock`, and `score --mock --jd examples/jd.txt`, and verify each stdout result.

- [ ] **Step 4: Run the full quality gate**

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm pack --dry-run`. Every command must exit 0 with no test failures.

- [ ] **Step 5: Review against the design**

Verify every required CLI command, error category, JSON field, README section, test category, and chosen bonus item is present. Inspect `git diff --check` and `git status --short`.

- [ ] **Step 6: Commit the completed implementation**

Stage only project files, commit with a descriptive message, and retain the generated package lock for reproducible installs.
