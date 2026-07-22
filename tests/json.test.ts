import { describe, expect, it } from 'vitest';
import { parseModelJson } from '../src/utils/json.js';

describe('parseModelJson', () => {
  it('removes markdown fences and trailing commas', () => {
    expect(parseModelJson('```json\n{"name":"Ada",}\n```')).toEqual({ name: 'Ada' });
  });

  it('extracts an object from surrounding prose', () => {
    expect(parseModelJson('Result: {"name":"Ada"} Thanks')).toEqual({ name: 'Ada' });
  });

  it('removes BOM and trailing array commas', () => {
    expect(parseModelJson('\uFEFF{"skills":["TypeScript",]}')).toEqual({
      skills: ['TypeScript'],
    });
  });

  it('rejects text without a JSON object', () => {
    expect(() => parseModelJson('not json')).toThrow(/有效的 JSON/);
  });
});
