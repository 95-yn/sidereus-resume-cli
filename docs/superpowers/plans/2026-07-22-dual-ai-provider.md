# DeepSeek and OpenAI Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DeepSeek the default AI provider while retaining explicit OpenAI support and preserving all CLI and mock behavior.

**Architecture:** Add a small provider resolver and split provider-specific transports behind a shared structured-request contract. DeepSeek uses Chat Completions JSON Output plus existing JSON repair and Zod validation; OpenAI retains Responses Structured Outputs. The existing AI facade owns prompts and routes a request without exposing provider details to commands.

**Tech Stack:** TypeScript, OpenAI Node SDK, Zod, Vitest, DeepSeek OpenAI-compatible Chat Completions API

---

### Task 1: Provider selection contract

**Files:**
- Create: `src/services/provider.ts`
- Create: `tests/provider.test.ts`

- [ ] **Step 1: Write failing provider tests**

```ts
expect(resolveProvider({})).toBe('deepseek');
expect(resolveProvider({ AI_PROVIDER: 'openai' })).toBe('openai');
expect(() => resolveProvider({ AI_PROVIDER: 'other' })).toThrowError(
  expect.objectContaining({ code: 'UNSUPPORTED_AI_PROVIDER', exitCode: 2 }),
);
```

Also verify case-insensitive values and surrounding whitespace.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/provider.test.ts`; expect missing module.

- [ ] **Step 3: Implement the resolver and shared request types**

Export `AiProvider = 'deepseek' | 'openai'`, `resolveProvider(env)`, `StructuredRequest<T>` containing schema, schema name, prompts, and JSON example, and `StructuredRequester` with a generic `request` method. Unknown providers throw `AppError` code `UNSUPPORTED_AI_PROVIDER`, exit code 2.

- [ ] **Step 4: Run GREEN and commit**

Run the provider test and typecheck, then commit.

### Task 2: DeepSeek JSON Output adapter

**Files:**
- Create: `src/services/deepseek.ts`
- Create: `tests/deepseek.test.ts`
- Modify: `src/utils/json.ts`

- [ ] **Step 1: Write failing adapter tests**

Inject a client factory exposing `chat.completions.create`. Test:

- missing `DEEPSEEK_API_KEY` fails before client construction;
- client construction receives `{ apiKey, baseURL: 'https://api.deepseek.com' }`;
- default model is `deepseek-v4-flash` and `DEEPSEEK_MODEL` overrides it;
- request contains `response_format: { type: 'json_object' }`, non-streaming mode, and a system prompt containing `JSON` plus the expected example;
- fenced/trailing-comma responses are repaired then schema validated;
- null or whitespace content becomes `EMPTY_AI_RESPONSE`;
- transport failures become `AI_REQUEST_FAILED` without leaking the API key;
- invalid schema data becomes `INVALID_AI_RESPONSE`.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/deepseek.test.ts`; expect missing module.

- [ ] **Step 3: Implement DeepSeek requester**

Create the OpenAI SDK client with the fixed official base URL. Call `chat.completions.create` using `deepseek-v4-flash`, messages, `response_format: { type: 'json_object' }`, `max_tokens: 4096`, and `stream: false`. Parse non-empty content through `parseModelJson`, then parse the value through the request schema. Wrap only transport failures as `AI_REQUEST_FAILED`; preserve known `AppError` instances.

- [ ] **Step 4: Run GREEN and commit**

Run DeepSeek, JSON, and typecheck tests, then commit.

### Task 3: Extract the OpenAI adapter

**Files:**
- Create: `src/services/openai.ts`
- Create: `tests/openai.test.ts`
- Modify: `src/services/ai.ts`
- Modify: `tests/ai.test.ts`

- [ ] **Step 1: Move current OpenAI expectations into a failing adapter test**

Verify missing `OPENAI_API_KEY`, default `gpt-5.6`, model override, Responses `zodTextFormat`, provider error mapping, and local Zod validation through a directly tested `createOpenAIRequester`.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/openai.test.ts`; expect missing module.

- [ ] **Step 3: Implement the extracted OpenAI requester**

Move the current Responses API transport from `ai.ts` into `openai.ts`. Keep behavior and errors unchanged, and satisfy the shared structured requester interface.

- [ ] **Step 4: Rewrite facade tests before facade code**

Update `tests/ai.test.ts` to inject fake DeepSeek and OpenAI requesters. Verify default DeepSeek routing, explicit OpenAI routing, identical candidate/score prompts, unknown provider failure before either requester is called, and both result schemas.

- [ ] **Step 5: Run facade tests and verify RED**

Run `npm test -- tests/ai.test.ts`; expect the old facade not to support provider routing.

- [ ] **Step 6: Implement the provider-neutral facade**

Keep `extractCandidate` and `scoreResume` public signatures. Extend options with environment and requester factories. Build shared prompts and examples, call `resolveProvider`, select exactly one requester, and return its validated result. Do not fall back automatically.

- [ ] **Step 7: Run GREEN and commit**

Run all AI/provider tests, the full test suite, and typecheck, then commit.

### Task 4: Configuration and documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-22-resume-cli-design.md`

- [ ] **Step 1: Update configuration examples**

Set `AI_PROVIDER=deepseek`, document `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL=deepseek-v4-flash`, then keep the OpenAI variables as the explicit alternative.

- [ ] **Step 2: Update README commands and privacy language**

Explain default DeepSeek setup, OpenAI switching, provider-specific errors, mock independence, and that non-mock resume text is sent only to the selected API. Replace statements that describe OpenAI as the only provider.

- [ ] **Step 3: Align the original project design**

Add a note that the later dual-provider design supersedes the original OpenAI-only transport while preserving schemas and CLI interfaces.

- [ ] **Step 4: Verify documentation and commit**

Run a placeholder scan, `git diff --check`, and commit docs/config.

### Task 5: Full regression and delivery verification

**Files:**
- No new production files expected

- [ ] **Step 1: Run mock demos**

Run `npm run demo`; all three commands must complete without either API key.

- [ ] **Step 2: Verify provider-specific missing-key messages**

With relevant variables absent, run built `extract` once with the default provider and once with `AI_PROVIDER=openai`. Confirm exit code 2 and messages naming only `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`, respectively.

- [ ] **Step 3: Run full quality gate**

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm pack --dry-run`, `npm audit --omit=dev`, and `git diff --check`. All must exit 0; the full test suite must have zero failures.

- [ ] **Step 4: Review the specification checklist**

Confirm default DeepSeek routing, explicit OpenAI routing, no automatic fallback, fixed DeepSeek base URL, current model default, JSON repair plus Zod validation, mock regression, documentation, and secret-safe errors.

- [ ] **Step 5: Commit any final verified adjustments**

Stage only intended files and commit before branch integration handoff.
