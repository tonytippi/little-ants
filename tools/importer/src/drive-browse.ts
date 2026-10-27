import { DriveClient, driveAuthFromEnv, findProgramFolder, type DriveFile } from './drive.js';

const FOLDER = 'application/vnd.google-apps.folder';

/** The Drive client and program folder ("LA 3-6") named by GOOGLE_DRIVE_FOLDER_ID and the Drive credentials. */
export async function openProgramFolder(
  env: Record<string, string | undefined>,
): Promise<{ client: DriveClient; program: DriveFile }> {
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID to the shared Drive folder');
  const client = new DriveClient(driveAuthFromEnv(env));
  return { client, program: await findProgramFolder(client, folderId) };
}

function isFolder(file: DriveFile): boolean {
  return file.mimeType === FOLDER || file.shortcutDetails?.targetMimeType === FOLDER;
}

/** A shortcut stands for its target, under the shortcut's own name. */
async function followShortcut(client: DriveClient, file: DriveFile): Promise<DriveFile> {
  return file.shortcutDetails
    ? { ...(await client.get(file.shortcutDetails.targetId)), name: file.name }
    : file;
}

/**
 * The item at a "/"-separated path below `folder`; "" or "." is the folder itself.
 * Names match ignoring case and surrounding spaces.
 */
export async function resolveDrivePath(
  client: DriveClient,
  folder: DriveFile,
  drivePath: string,
): Promise<DriveFile> {
  let current = folder;
  const walked: string[] = [];
  for (const part of drivePath.split('/').map((segment) => segment.trim())) {
    if (!part || part === '.') continue;
    if (!isFolder(current)) throw new Error(`"${walked.join('/')}" is a file, not a folder`);
    const children = await client.list(current.id);
    const match = children.find((child) => child.name.trim().toLowerCase() === part.toLowerCase());
    if (!match) {
      const where = walked.length ? walked.join('/') : folder.name;
      throw new Error(
        `No "${part}" in "${where}". It holds: ${children.map((child) => child.name).join(', ')}`,
      );
    }
    current = await followShortcut(client, match);
    walked.push(match.name.trim());
  }
  return current;
}

/** Indented listing below a folder, folders first; `depth` levels of subfolders are opened. */
export async function driveTree(client: DriveClient, folder: DriveFile, depth: number): Promise<string[]> {
  const lines: string[] = [];
  const walk = async (folderId: string, indent: string, level: number): Promise<void> => {
    const children = (await client.list(folderId)).sort(
      (a, b) => Number(isFolder(b)) - Number(isFolder(a)) || a.name.localeCompare(b.name),
    );
    for (const child of children) {
      const shortcut = child.shortcutDetails ? ' (shortcut)' : '';
      if (isFolder(child)) {
        lines.push(`${indent}${child.name}/${shortcut}`);
        if (level < depth) await walk(child.shortcutDetails?.targetId ?? child.id, `${indent}  `, level + 1);
      } else {
        const modified = child.modifiedTime ? `  ${child.modifiedTime.slice(0, 10)}` : '';
        lines.push(`${indent}${child.name}${shortcut}${modified}`);
      }
    }
  };
  await walk(folder.id, '', 0);
  return lines;
}
