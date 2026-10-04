export type DocumentIdentity = { contentsId: number; url: string; revision: number };
export function sameDocument(request: DocumentIdentity, current: DocumentIdentity | undefined): boolean {
  return !!current && request.contentsId === current.contentsId && request.url === current.url && request.revision === current.revision;
}
export function websiteOrigin(input: string): string | undefined {
  try { const url = new URL(input); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : undefined; } catch { return undefined; }
}
