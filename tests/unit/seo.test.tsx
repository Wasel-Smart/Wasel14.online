import { createElement, type ReactNode } from 'react';
import { render, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BreadcrumbJsonLd,
  JsonLd,
  OrganizationJsonLd,
  WebSiteJsonLd,
  serializeJsonLd,
  useSeo,
} from '@/utils/seo';
import { LanguageProvider } from '@/contexts/LanguageContext';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(LanguageProvider, null, children);

describe('SEO and JSON-LD helpers', () => {
  it('escapes markup and JavaScript line separators in JSON-LD', () => {
    const output = serializeJsonLd({ value: '</script>&\u2028\u2029' });

    expect(output).not.toContain('</script>');
    expect(output).toContain('\\u003c/script\\u003e\\u0026\\u2028\\u2029');
    expect(serializeJsonLd(undefined)).toBe('null');
  });

  it('renders all structured data components as JSON-LD scripts', () => {
    const { container } = render(
      <>
        <JsonLd data={{ '@type': 'Thing', name: '<safe>' }} />
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <BreadcrumbJsonLd items={[{ name: 'Home', url: 'https://example.test' }]} />
      </>,
    );

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(4);
    expect(scripts[0]?.textContent).toContain('\\u003csafe\\u003e');
  });

  it('updates document metadata and canonical links for the loaded language', async () => {
    renderHook(
      () => useSeo({
        title: 'Wasel',
        titleAr: 'واصل',
        description: 'Travel together',
        descriptionAr: 'سافر معاً',
        canonical: 'https://wasel14.online/app',
        ogImage: 'https://wasel14.online/share.png',
        noIndex: true,
      }),
      { wrapper },
    );

    await waitFor(() => expect(document.title).toMatch(/Wasel|واصل/));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBeTruthy();
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://wasel14.online/app');
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe('https://wasel14.online/share.png');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://wasel14.online/app');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  });
});
