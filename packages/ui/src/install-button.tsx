'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
import { promptInstall, useInstallMode, type InstallMode } from './lib/install';

/** What the install dialog says about the app. */
export interface InstallCopy {
  /** Name on the Home Screen icon, e.g. "Little Ants". */
  appName: string;
  /** One sentence on why to install it. */
  description: string;
}

function installSteps(
  appName: string,
): Record<Exclude<InstallMode, 'installed' | 'prompt'>, { title: string; steps: ReactNode[] }> {
  return {
    'steps-ios': {
      title: 'On iPad or iPhone (Safari)',
      steps: [
        <>
          Open this page in <strong>Safari</strong> (other browsers on iPad cannot install it).
        </>,
        <>
          Tap <strong>Share</strong> (the square with an arrow, at the top or bottom of the screen).
        </>,
        <>
          Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </>,
        <>Open {appName} from the new icon on the Home Screen and sign in again once.</>,
      ],
    },
    'steps-android': {
      title: 'On Android (Chrome)',
      steps: [
        <>
          Tap the <strong>⋮</strong> menu at the top right.
        </>,
        <>
          Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>), then{' '}
          <strong>Install</strong>.
        </>,
        <>Open {appName} from the new icon.</>,
      ],
    },
    'steps-mac': {
      title: 'On a Mac (Safari)',
      steps: [
        <>
          In the menu bar, choose <strong>File → Add to Dock</strong>, then <strong>Add</strong>.
        </>,
        <>Open {appName} from the Dock.</>,
      ],
    },
    'steps-desktop': {
      title: 'On a computer (Chrome or Edge)',
      steps: [
        <>
          Click the <strong>install icon</strong> at the right end of the address bar (a screen with a down
          arrow), or open the <strong>⋮</strong> menu and choose{' '}
          <strong>Cast, save and share → Install page as app</strong> (Edge:{' '}
          <strong>Apps → Install this site as an app</strong>).
        </>,
        <>
          Click <strong>Install</strong>. {appName} opens in its own window and gets a desktop or Start menu
          icon.
        </>,
      ],
    },
  };
}

/** "Install app" in the header: the browser's own prompt where there is one, otherwise the steps for this device. */
export function InstallButton({ appName, description }: InstallCopy) {
  const mode = useInstallMode();
  const [open, setOpen] = useState(false);
  if (mode === 'installed') return null;
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          void promptInstall().then((prompted) => {
            if (!prompted) setOpen(true);
          });
        }}
      >
        ⤓ Install app
      </Button>
      <InstallSteps
        open={open}
        mode={mode}
        onClose={() => setOpen(false)}
        appName={appName}
        description={description}
      />
    </>
  );
}

export function InstallSteps({
  open,
  mode,
  onClose,
  appName,
  description,
}: {
  open: boolean;
  mode: InstallMode;
  onClose: () => void;
} & InstallCopy) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  const steps = installSteps(appName);
  const guide = mode === 'installed' || mode === 'prompt' ? steps['steps-desktop'] : steps[mode];

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="install-title"
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-[var(--radius-card)] bg-white p-6 text-bark-900 shadow-xl backdrop:bg-bark-900/40"
    >
      <h2 id="install-title" className="font-display text-2xl font-extrabold text-ant-500">
        Install {appName}
      </h2>
      <p className="mt-1 text-sm text-bark-500">{description}</p>
      <h3 className="mt-4 font-bold text-leaf-700">{guide.title}</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {guide.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>Got it</Button>
      </div>
    </dialog>
  );
}
