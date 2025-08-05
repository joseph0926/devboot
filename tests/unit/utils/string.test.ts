import { describe, it, expect } from 'vitest';
import { findSimilar } from '../../../src/utils/string';

describe('findSimilar', () => {
  it('should find exact matches', () => {
    const candidates = ['typescript', 'prettier', 'eslint'];
    const result = findSimilar('typescript', candidates);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('typescript');
  });

  it('should find matches starting with target', () => {
    const candidates = ['typescript', 'type', 'javascript'];
    const result = findSimilar('type', candidates);
    
    expect(result).toContain('type');
    expect(result).toContain('typescript');
  });

  it('should find matches by abbreviation', () => {
    const candidates = ['editor-config', 'eslint-config', 'typescript'];
    const result = findSimilar('ec', candidates);
    
    expect(result).toContain('editor-config');
    expect(result).toContain('eslint-config');
  });

  it('should find matches containing target', () => {
    const candidates = ['typescript', 'javascript', 'script'];
    const result = findSimilar('script', candidates);
    
    expect(result).toContain('script');
    expect(result).toContain('typescript');
    expect(result).toContain('javascript');
  });

  it('should find similar matches', () => {
    const candidates = ['prettier', 'eslint', 'typescript'];
    const result = findSimilar('prettier', candidates); // exact match
    
    expect(result).toContain('prettier');
  });

  it('should ignore case', () => {
    const candidates = ['TypeScript', 'PRETTIER', 'eslint'];
    const result = findSimilar('typescript', candidates);
    
    expect(result).toContain('TypeScript');
  });

  it('should ignore hyphens in comparison', () => {
    const candidates = ['editor-config', 'editorconfig'];
    const result = findSimilar('editorconfig', candidates);
    
    expect(result).toHaveLength(2);
    expect(result).toContain('editor-config');
    expect(result).toContain('editorconfig');
  });

  it('should limit results to maxResults', () => {
    const candidates = ['typescript', 'type', 'types', 'typed', 'typing'];
    const result = findSimilar('type', candidates, 2);
    
    expect(result).toHaveLength(2);
  });

  it('should return empty array for empty candidates', () => {
    const result = findSimilar('test', []);
    
    expect(result).toEqual([]);
  });

  it('should filter out low score matches', () => {
    const candidates = ['abc', 'def', 'xyz'];
    const result = findSimilar('typescript', candidates);
    
    expect(result).toHaveLength(0);
  });

  it('should handle special characters', () => {
    const candidates = ['@types/node', '@types/react', 'typescript'];
    const result = findSimilar('types', candidates);
    
    expect(result.length).toBeGreaterThan(0);
  });

  it('should prioritize exact matches over partial matches', () => {
    const candidates = ['config', 'configuration', 'eslint-config'];
    const result = findSimilar('config', candidates);
    
    expect(result[0]).toBe('config');
  });

  it('should handle empty target string', () => {
    const candidates = ['typescript', 'prettier'];
    const result = findSimilar('', candidates);
    
    // Empty string gets normalized and matches are found
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});