'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fadeClass } from '@little-ants/ui/storybook';
import { PdfPage } from './pdf-page';
import {
  clampPage,
  displayPageCount,
  materialDisplay,
  pdfPageForStoryPage,
  type StageFrame,
  type StageMaterial,
} from './stage-content';

interface StageProps {
  frame: StageFrame;
  /** Reports how many pages the current view has (for page turning). TV screens leave it out. */
  onPageCount?: (count: number) => void;
  /** Large type for the TV. */
  presenter?: boolean;
  /** The drawing layer, placed over the stage body (it anchors itself to the picture or page). */
  ink?: ReactNode;
}

const ignorePageCount = (): void => undefined;

/** `fade` softens the edges into the page, for character art drawn on paper (brand storybook look). */
function Picture({ src, alt, fade = false }: { src: string; alt: string; fade?: boolean }) {
  // Plain <img>: media comes from the offline cache / media domain, not the Next image optimizer.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`max-h-full max-w-full object-contain ${fade ? fadeClass : 'rounded-2xl'}`}
      draggable={false}
      data-ink-target=""
    />
  );
}

function ChildText({ children, size = 'lg' }: { children: ReactNode; size?: 'lg' | 'xl' }) {
  return (
    <p
      className={`whitespace-pre-line text-center font-child leading-snug text-bark-900 ${size === 'xl' ? 'text-[clamp(1.75rem,4.2vw,4.5rem)]' : 'text-[clamp(1.25rem,2.6vw,2.6rem)]'}`}
    >
      {children}
    </p>
  );
}

function MaterialStage({
  material,
  page,
  onPageCount,
}: {
  material: StageMaterial;
  page: number;
  onPageCount: (count: number) => void;
}) {
  const display = useMemo(() => materialDisplay(material), [material]);
  const reportPdf = useCallback((count: number) => onPageCount(count), [onPageCount]);
  const [layoutPages, setLayoutPages] = useState<number | null>(null);
  useEffect(() => {
    if (display.kind !== 'pdf') onPageCount(displayPageCount(display, null));
  }, [display, onPageCount]);

  switch (display.kind) {
    case 'pages': {
      const current = display.pages[clampPage(page, display.pages.length)];
      if (!current) return null;
      return (
        <div className="flex h-full w-full flex-col items-center gap-4">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            {current.image ? (
              <Picture src={current.image.url} alt={current.text} />
            ) : display.pdf ? (
              <PdfPage
                url={display.pdf.url}
                page={pdfPageForStoryPage(page, display.pages.length, layoutPages)}
                onPageCount={setLayoutPages}
                label={`${material.title}, page ${page + 1}`}
              />
            ) : (
              <ChildText size="xl">{current.text}</ChildText>
            )}
          </div>
          {current.image || display.pdf ? <ChildText>{current.text}</ChildText> : null}
        </div>
      );
    }
    case 'images': {
      const image = display.images[clampPage(page, display.images.length)];
      return image ? <Picture src={image.url} alt={material.title} /> : null;
    }
    case 'pdf':
      return (
        <PdfPage
          url={display.pdf.url}
          page={page + 1}
          onPageCount={reportPdf}
          label={`${material.title}, page ${page + 1}`}
        />
      );
    case 'text':
      return <ChildText size="xl">{display.text}</ChildText>;
  }
}

function WordCards({
  word,
  wordCount,
  onPageCount,
}: {
  word: StageFrame['word'];
  wordCount: number;
  onPageCount: (count: number) => void;
}) {
  useEffect(() => onPageCount(wordCount), [wordCount, onPageCount]);
  if (!word) return <ChildText>No word cards in this unit.</ChildText>;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      {word.image ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Picture src={word.image.url} alt={word.text} />
        </div>
      ) : null}
      <p className="font-child text-[clamp(2.5rem,8vw,8rem)] font-bold leading-none text-leaf-700">
        {word.text}
      </p>
    </div>
  );
}

/** The part of the lesson children see: shown in the teacher's window and on the TV. */
export function Stage({ frame, onPageCount = ignorePageCount, presenter = false, ink }: StageProps) {
  const { material, lead, page } = frame;
  if (frame.splash) return <Splash />;
  return (
    <div className={`flex h-full w-full flex-col ${presenter ? 'p-8' : 'p-4 sm:p-6'}`}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className={`font-child font-bold text-leaf-700 ${presenter ? 'text-3xl' : 'text-xl'}`}>
          {frame.title}
        </p>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {frame.view === 'words' ? (
          <WordCards word={frame.word} wordCount={frame.wordCount} onPageCount={onPageCount} />
        ) : material ? (
          <MaterialStage key={material.code} material={material} page={page} onPageCount={onPageCount} />
        ) : (
          <StepCard
            title={frame.stepTitle}
            lead={lead?.image?.url ?? null}
            leadName={lead?.name ?? ''}
            onPageCount={onPageCount}
          />
        )}
        {ink}
      </div>
    </div>
  );
}

/** What the TV shows while the teacher hides the stage. */
function Splash() {
  return (
    <div className="flex h-full w-full items-center justify-center p-[6vmin]">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local logo */}
      <img
        src="/logo-horizontal.webp"
        alt="Little Ants English"
        className="max-h-[70%] max-w-[70%] object-contain"
      />
    </div>
  );
}

function StepCard({
  title,
  lead,
  leadName,
  onPageCount,
}: {
  title: string;
  lead: string | null;
  leadName: string;
  onPageCount: (count: number) => void;
}) {
  useEffect(() => onPageCount(1), [onPageCount]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      {lead ? (
        <div className="flex max-h-[60%] min-h-0 items-center justify-center">
          <Picture src={lead} alt={leadName} fade />
        </div>
      ) : null}
      <ChildText size="xl">{title}</ChildText>
    </div>
  );
}
