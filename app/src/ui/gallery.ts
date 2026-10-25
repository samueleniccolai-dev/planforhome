/** The gallery is for development: dev builds, or the web on a local host (CI serves the bundle). */
export function isGalleryEnabled({
  dev,
  os,
  host,
}: {
  dev: boolean;
  os: string;
  host?: string;
}): boolean {
  if (dev) return true;
  return os === 'web' && (host === 'localhost' || host === '127.0.0.1');
}
