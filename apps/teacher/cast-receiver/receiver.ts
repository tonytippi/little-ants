/**
 * The Google Cast receiver for classroom TVs. TVs run an old browser (Chrome 92 on Android TV 9), which cannot run
 * the Next.js/React app, so this is plain DOM code compiled for ES2020 (see tsconfig.json). It shares the frame and
 * message logic with the Teacher app and draws what the teacher's device sends: no sign-in, no data of its own.
 */
import {
  clampPage,
  materialDisplay,
  pdfPageForStoryPage,
  type StageFrame,
} from '../src/components/player/stage-content.js';
import {
  CAST_NAMESPACE,
  isSenderMessage,
  type AudioCommand,
  type ReceiverMessage,
} from '../src/lib/cast-protocol.js';

/** The parts of the Cast Web Receiver SDK used here (loaded by index.html, so no npm types). */
interface ReceiverContext {
  addCustomMessageListener(namespace: string, listener: (event: { senderId: string; data: unknown }) => void): void;
  sendCustomMessage(namespace: string, senderId: string | undefined, data: ReceiverMessage): void;
  addEventListener(type: string, listener: (event: { senderId: string }) => void): void;
  getSenders(): unknown[];
  start(options: { disableIdleTimeout: boolean; customNamespaces: Record<string, string> }): void;
}
declare const cast: {
  framework: {
    CastReceiverContext: { getInstance(): ReceiverContext };
    system: { EventType: { SENDER_CONNECTED: string; SENDER_DISCONNECTED: string }; MessageType: { JSON: string } };
  };
};

const stage = document.getElementById('stage') as HTMLElement;
const waiting = document.getElementById('waiting') as HTMLElement;
const player = document.getElementById('audio') as HTMLAudioElement;
let blocked = false;
let renderCount = 0;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function picture(url: string, alt: string, fade = false): HTMLElement {
  const img = el('img', fade ? 'picture fade' : 'picture');
  img.src = url;
  img.alt = alt;
  return img;
}

// --- PDF pages (draft layouts), with pdf.js's legacy build for old browsers -------------------------------------

interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(o: { scale: number }): { width: number; height: number };
    render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
  }>;
}
const PDF_LIBRARY = '/pdfjs-legacy/pdf.min.mjs';
const documents = new Map<string, Promise<PdfDocument>>();

function polyfill(): void {
  // Used by pdf.js and missing in Chrome 92.
  const promise = Promise as unknown as { withResolvers?: unknown };
  if (!promise.withResolvers) {
    promise.withResolvers = function withResolvers<T>() {
      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;
      const created = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      return { promise: created, resolve, reject };
    };
  }
  const object = Object as unknown as { hasOwn?: unknown };
  if (!object.hasOwn) {
    object.hasOwn = (target: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(target, key);
  }
}

function loadPdf(url: string): Promise<PdfDocument> {
  let pending = documents.get(url);
  if (!pending) {
    pending = (async () => {
      polyfill();
      const library = PDF_LIBRARY;
      const pdfjs = (await import(library)) as {
        GlobalWorkerOptions: { workerSrc: string };
        getDocument(o: { url: string }): { promise: Promise<PdfDocument> };
      };
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs-legacy/pdf.worker.min.mjs';
      return pdfjs.getDocument({ url }).promise;
    })();
    documents.set(url, pending);
    pending.catch(() => documents.delete(url));
  }
  return pending;
}

/** A PDF page fitted into its box; `pageFor` maps the document's page count to the page to show. */
function pdfPage(url: string, pageFor: (pages: number) => number, fallback: string): HTMLElement {
  const box = el('div', 'pdf');
  const canvas = el('canvas');
  box.appendChild(canvas);
  const token = renderCount;
  void (async () => {
    try {
      const doc = await loadPdf(url);
      const page = await doc.getPage(Math.min(Math.max(1, pageFor(doc.numPages)), doc.numPages));
      if (token !== renderCount) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(box.clientWidth / base.width, box.clientHeight / base.height) * (window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (context) await page.render({ canvasContext: context, viewport }).promise;
    } catch (error) {
      box.replaceChildren(el('p', 'child-text xl', fallback));
      reportError(error);
    }
  })();
  return box;
}

// --- Drawing a frame ---------------------------------------------------------------------------------------------

function render(frame: StageFrame | null): void {
  renderCount += 1;
  stage.replaceChildren();
  stage.hidden = !frame;
  waiting.hidden = !!frame;
  if (!frame) return;
  stage.appendChild(el('p', 'title', frame.title));
  const body = el('div', 'body');
  stage.appendChild(body);

  if (frame.view === 'words') {
    if (!frame.word) {
      body.appendChild(el('p', 'child-text', 'No word cards in this unit.'));
      return;
    }
    if (frame.word.image) body.appendChild(holder(picture(frame.word.image.url, frame.word.text)));
    body.appendChild(el('p', 'word', frame.word.text));
    return;
  }

  const material = frame.material;
  if (!material) {
    if (frame.lead?.image) body.appendChild(holder(picture(frame.lead.image.url, frame.lead.name, true), 'lead'));
    body.appendChild(el('p', 'child-text xl', frame.stepTitle));
    return;
  }

  const display = materialDisplay(material);
  switch (display.kind) {
    case 'pages': {
      const index = clampPage(frame.page, display.pages.length);
      const current = display.pages[index];
      if (!current) return;
      if (current.image) body.appendChild(holder(picture(current.image.url, current.text)));
      else if (display.pdf) {
        const pages = display.pages.length;
        body.appendChild(
          holder(pdfPage(display.pdf.url, (pdfPages) => pdfPageForStoryPage(index, pages, pdfPages), current.text)),
        );
      } else {
        body.appendChild(el('p', 'child-text xl', current.text));
        return;
      }
      body.appendChild(el('p', 'child-text', current.text));
      return;
    }
    case 'images': {
      const image = display.images[clampPage(frame.page, display.images.length)];
      if (image) body.appendChild(holder(picture(image.url, material.title)));
      return;
    }
    case 'pdf':
      body.appendChild(holder(pdfPage(display.pdf.url, () => frame.page + 1, material.title)));
      return;
    case 'text':
      body.appendChild(el('p', 'child-text xl', display.text));
  }
}

function holder(child: HTMLElement, extra = ''): HTMLElement {
  const box = el('div', extra ? `holder ${extra}` : 'holder');
  box.appendChild(child);
  return box;
}

// --- Audio, played by the TV and controlled from the teacher's device -------------------------------------------

let context: ReceiverContext | null = null;

function send(message: ReceiverMessage): void {
  context?.sendCustomMessage(CAST_NAMESPACE, undefined, message);
}

function reportAudio(): void {
  send({
    type: 'audio-status',
    trackId: player.dataset.trackId || null,
    playing: !player.paused,
    current: player.currentTime || 0,
    duration: Number.isFinite(player.duration) ? player.duration : 0,
    blocked,
  });
}

function runAudio(command: AudioCommand): void {
  switch (command.action) {
    case 'load':
      player.pause();
      player.dataset.trackId = command.track?.id ?? '';
      if (command.track) player.src = command.track.url;
      else player.removeAttribute('src');
      break;
    case 'play':
      player.play().then(
        () => {
          blocked = false;
        },
        () => {
          blocked = true;
          reportAudio();
        },
      );
      break;
    case 'pause':
      player.pause();
      break;
    case 'seek':
      player.currentTime = command.time;
      break;
  }
  reportAudio();
}

for (const name of ['play', 'pause', 'ended', 'loadedmetadata', 'seeked']) player.addEventListener(name, reportAudio);
window.setInterval(() => {
  if (!player.paused) reportAudio();
}, 1000);

function stop(): void {
  render(null);
  runAudio({ type: 'audio', action: 'load', track: null });
}

// --- Cast ---------------------------------------------------------------------------------------------------------

function reportError(error: unknown): void {
  const show = (window as unknown as { laShowError?: (text: string) => void }).laShowError;
  show?.(`Error: ${error instanceof Error ? error.message : String(error)}`);
}

function start(): void {
  const { CastReceiverContext, system } = cast.framework;
  const receiver = CastReceiverContext.getInstance();
  context = receiver;
  receiver.addCustomMessageListener(CAST_NAMESPACE, (event) => {
    const message = event.data;
    if (!isSenderMessage(message)) return;
    try {
      if (message.type === 'frame') render(message.frame);
      else if (message.type === 'end') stop();
      else runAudio(message);
    } catch (error) {
      reportError(error);
    }
  });
  receiver.addEventListener(system.EventType.SENDER_CONNECTED, (event) => {
    receiver.sendCustomMessage(CAST_NAMESPACE, event.senderId, { type: 'ready' });
  });
  receiver.addEventListener(system.EventType.SENDER_DISCONNECTED, () => {
    if (receiver.getSenders().length === 0) stop();
  });
  // A lesson can stay on one page for a long time: never close the receiver for being idle.
  receiver.start({
    disableIdleTimeout: true,
    customNamespaces: { [CAST_NAMESPACE]: system.MessageType.JSON },
  });
}

(window as unknown as { laStarted?: boolean }).laStarted = true;
start();
