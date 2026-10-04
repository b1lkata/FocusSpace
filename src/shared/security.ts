export function authorizedSender(senderId: number, trustedId: number, frameUrl: string, trustedUrl: string, isMainFrame: boolean): boolean {
  return senderId === trustedId && isMainFrame && frameUrl === trustedUrl;
}

// The two local presentations share one trusted document. No arbitrary queries are allowed.
export function rendererDocumentUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.search && url.search !== '?legacy=1') return value;
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return value; }
}
