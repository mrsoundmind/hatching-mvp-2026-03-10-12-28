/**
 * TDD RED: Tests for extractDocumentText utility
 * These tests are written before the implementation.
 */
import { describe, it, expect } from 'vitest';
import { extractDocumentText, MAX_CHARS } from '../server/lib/extractDocumentText.js';

describe('extractDocumentText', () => {
  it('Test 1: extracts plain text from .txt buffer', async () => {
    const buffer = Buffer.from('hello world');
    const result = await extractDocumentText(buffer, 'test.txt');
    expect(result).toBe('hello world');
  });

  it('Test 2: extracts markdown content from .md buffer', async () => {
    const buffer = Buffer.from('# Title\nContent');
    const result = await extractDocumentText(buffer, 'readme.md');
    expect(result).toBe('# Title\nContent');
  });

  it('Test 3: truncates content longer than 50,000 chars', async () => {
    const longContent = 'x'.repeat(60_000);
    const buffer = Buffer.from(longContent);
    const result = await extractDocumentText(buffer, 'big.txt');
    expect(result.length).toBe(MAX_CHARS);
    expect(MAX_CHARS).toBe(50_000);
  });

  it('Test 4: returns empty string for unknown extension', async () => {
    const buffer = Buffer.from('some data');
    const result = await extractDocumentText(buffer, 'file.xyz');
    expect(result).toBe('');
  });

  it('Test 5: returns empty string for invalid PDF buffer (error handling)', async () => {
    // An obviously invalid PDF buffer (not a real PDF)
    const invalidBuffer = Buffer.from('this is not a valid pdf file at all');
    const result = await extractDocumentText(invalidBuffer, 'broken.pdf');
    expect(result).toBe('');
  });
});
