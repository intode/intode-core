import { describe, it, expect, beforeEach } from 'vitest';
import {
  setHtmlAssetResolver,
  getHtmlAssetResolver,
  type HtmlAssetResolver,
} from './pipeline-extensions';

describe('html-preview pipeline-extensions', () => {
  beforeEach(() => setHtmlAssetResolver(null));

  it('returns null when no resolver registered', () => {
    expect(getHtmlAssetResolver()).toBeNull();
  });

  it('stores and returns the registered resolver', async () => {
    const resolver: HtmlAssetResolver = async () => null;
    setHtmlAssetResolver(resolver);
    expect(getHtmlAssetResolver()).toBe(resolver);
  });

  it('clears the resolver when set to null', () => {
    setHtmlAssetResolver(async () => null);
    setHtmlAssetResolver(null);
    expect(getHtmlAssetResolver()).toBeNull();
  });
});
