'use client';

import { useSyncExternalStore } from 'react';

/**
 * Installing the Teacher app to the Home Screen / desktop. Chrome, Edge and Android offer an install prompt
 * (`beforeinstallprompt`); Safari has none, so the app shows the steps instead. The prompt can fire before any
 * screen mounts, so it is captured as soon as this module loads.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** How this browser installs the app. `steps-*` = no prompt: show how to do it by hand. */
export type InstallMode =
  'installed' | 'prompt' | 'steps-ios' | 'steps-android' | 'steps-mac' | 'steps-desktop';

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep it for the Install button instead of the browser's own mini bar
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function currentMode(): InstallMode {
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'steps-ios';
  if (/Android/i.test(navigator.userAgent)) return 'steps-android';
  if (/Macintosh/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent))
    return 'steps-mac';
  return 'steps-desktop';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, currentMode, () => 'installed');
}

/** Opens the browser's install prompt. Returns false when there is none (show the steps instead). */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null; // a prompt can be shown only once
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') installed = true;
  notify();
  return true;
}
