/** Portability checks for custom video HTML. */

export interface HtmlPortabilityViolation {
  kind: 'remote-resource' | 'absolute-local-resource';
  reference: string;
}

const RESOURCE_TAG = /<(?:script|link|img|video|audio|source|iframe|embed|object)\b[^>]*>/gi;
const URL_ATTRIBUTE = /\b(?:src|href|poster|data)\s*=\s*(["'])([^"']+)\1/gi;
const CSS_URL = /\burl\(\s*(["']?)([^"')]+)\1\s*\)/gi;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(["'])([^"']+)\1/gi;

function isRemote(reference: string): boolean {
  return /^(?:https?:)?\/\//i.test(reference.trim());
}

function isAbsoluteLocal(reference: string): boolean {
  const value = reference.trim();
  return /^file:\/\//i.test(value) || /^[a-z]:[\\/]/i.test(value) || /^\\\\/.test(value) || /^\/(?!\/)/.test(value);
}

function addViolation(
  found: Map<string, HtmlPortabilityViolation>,
  reference: string,
): void {
  const value = reference.trim();
  if (!value || value.startsWith('#') || /^data:/i.test(value) || /^blob:/i.test(value)) return;
  if (isRemote(value)) {
    found.set(`remote:${value}`, { kind: 'remote-resource', reference: value });
  } else if (isAbsoluteLocal(value)) {
    found.set(`local:${value}`, { kind: 'absolute-local-resource', reference: value });
  }
}

/**
 * Custom frames must survive moving the project to another machine. Relative
 * project assets and inline data URLs are safe; remote or machine-absolute
 * references are not.
 */
export function findHtmlPortabilityViolations(html: string): HtmlPortabilityViolation[] {
  const found = new Map<string, HtmlPortabilityViolation>();
  for (const tag of html.matchAll(RESOURCE_TAG)) {
    for (const match of (tag[0] ?? '').matchAll(URL_ATTRIBUTE)) addViolation(found, match[2] ?? '');
  }
  for (const match of html.matchAll(CSS_URL)) addViolation(found, match[2] ?? '');
  for (const match of html.matchAll(CSS_IMPORT)) addViolation(found, match[2] ?? '');
  return [...found.values()];
}

export function assertPortableHtml(html: string): void {
  const violations = findHtmlPortabilityViolations(html);
  if (violations.length === 0) return;
  const details = violations
    .slice(0, 5)
    .map((item) => `${item.kind === 'remote-resource' ? 'remote' : 'absolute'}: ${item.reference}`)
    .join('; ');
  const extra = violations.length > 5 ? `; +${violations.length - 5} more` : '';
  throw new Error(
    `HTML is not portable (${details}${extra}). ` +
      'Inline CSS/JavaScript, use system font fallbacks, and copy media into the project with relative paths. CDN and file:// dependencies are not allowed in custom video frames.',
  );
}
