'use client';

import { Button } from '@little-ants/ui/button';

export function PrintToolbar({ title, back }: { title: string; back: string }) {
  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-cream-200 bg-cream-50 px-6 py-3">
      <div className="flex items-center gap-4">
        <a href={back} className="text-sm font-semibold text-leaf-700 hover:underline">
          ← Back
        </a>
        <span className="font-bold">{title}</span>
      </div>
      <Button onClick={() => window.print()}>Print</Button>
    </div>
  );
}
