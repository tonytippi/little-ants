/** Download state of a unit on this device compared with the newest published version. */
export type DownloadState =
  | { kind: 'not-downloaded' }
  | { kind: 'up-to-date'; version: number }
  | { kind: 'update-available'; local: number; latest: number }
  | { kind: 'not-published' };

export function downloadState(
  localVersion: number | undefined,
  latestVersion: number | undefined,
): DownloadState {
  if (latestVersion === undefined) {
    return localVersion === undefined
      ? { kind: 'not-published' }
      : { kind: 'up-to-date', version: localVersion };
  }
  if (localVersion === undefined) return { kind: 'not-downloaded' };
  if (localVersion < latestVersion)
    return { kind: 'update-available', local: localVersion, latest: latestVersion };
  return { kind: 'up-to-date', version: localVersion };
}
