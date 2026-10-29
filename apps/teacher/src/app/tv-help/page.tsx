'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buttonClass } from '@little-ants/ui/button';

const GUIDES = {
  cast: {
    label: 'Chromecast / Android TV',
    intro:
      'The TV shows only what the children see. Your laptop or tablet keeps the teacher notes and the controls, and the audio plays from the TV.',
    steps: [
      'Use Google Chrome on your laptop or Android tablet.',
      'Connect the TV and your device to the same Wi-Fi. The TV needs Google Cast (most Android TVs have it), or a Chromecast plugged into its HDMI port.',
      'Open the lesson and tap Show on TV → Chromecast / Android TV.',
      'Chrome lists the TVs it finds. Tap the name of the TV in your classroom. After a few seconds the TV shows the lesson.',
      'Teach as usual. To finish, tap On TV → Stop showing on TV.',
    ],
    trouble: [
      'No TV in the list: check that both are on the same Wi-Fi (not the guest network), then restart the TV.',
      'Still no TV: some school Wi-Fi networks stop devices from seeing each other. Ask the school to allow it, or use the second window with an HDMI cable.',
      'Pictures or audio do not load on the TV: the TV needs internet to load them, even when the unit is downloaded on your device.',
    ],
  },
  window: {
    label: 'Second window (HDMI)',
    intro: 'For a TV or projector plugged into your laptop with an HDMI cable.',
    steps: [
      'Plug the TV into the laptop. In the display settings, choose "Extend" (not "Duplicate").',
      'Open the lesson and tap Show on TV → Second window.',
      'Drag the new window onto the TV, then tap the button on it for full screen.',
      'Teach from the laptop window. Audio plays from the laptop (or the TV, if the laptop sends sound over HDMI).',
    ],
    trouble: [
      'The window did not open: allow pop-ups for this site in the browser.',
      'The TV shows the same as the laptop: switch the display mode to "Extend".',
    ],
  },
} as const;

type GuideKey = keyof typeof GUIDES;

/** How to show lessons on a classroom TV. Works offline once opened. */
export default function TvHelpPage() {
  const [tab, setTab] = useState<GuideKey>('cast');
  const guide = GUIDES[tab];
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 bg-cream-50 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-bark-900">Show lessons on a TV</h1>
        <Link href="/" className={buttonClass('secondary', 'md')}>
          Today
        </Link>
      </div>
      <div role="tablist" className="flex gap-1 self-start rounded-2xl bg-cream-200 p-1">
        {(Object.keys(GUIDES) as GuideKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-white text-bark-900 shadow-sm' : 'text-bark-500'}`}
          >
            {GUIDES[key].label}
          </button>
        ))}
      </div>
      <section role="tabpanel" className="flex flex-col gap-5 rounded-3xl bg-white p-6 ring-1 ring-cream-200">
        <p className="text-bark-700">{guide.intro}</p>
        <ol className="flex flex-col gap-3">
          {guide.steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-leaf-600 font-bold text-white">
                {index + 1}
              </span>
              <span className="pt-1 text-bark-900">{step}</span>
            </li>
          ))}
        </ol>
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-bark-500">
            If it does not work
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-bark-700">
            {guide.trouble.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
