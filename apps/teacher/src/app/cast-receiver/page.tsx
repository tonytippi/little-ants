'use client';

import { useEffect } from 'react';
import { TvDisplay, type DisplayLink } from '../../components/tv-display';
import { CAST_NAMESPACE, type ReceiverMessage, type SenderMessage } from '../../lib/cast-protocol';

const RECEIVER_SDK = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';

type BootEvent = { kind: 'message'; data: SenderMessage } | { kind: 'idle' };

/** What the boot script below leaves on `window` for the React app. */
interface CastBoot {
  queue: BootEvent[];
  listener: ((event: BootEvent) => void) | null;
  send: (message: ReceiverMessage) => void;
  mounted: boolean;
}

/**
 * Starts the Cast receiver as soon as the HTML is parsed, in plain ES5, without waiting for React: the TV gives a
 * receiver only a few seconds to start, and its browser may be slow or old. Messages that arrive before React is
 * ready wait in a queue. Errors, and a React app that never starts, are shown on the TV with the browser version so
 * they can be reported.
 */
const BOOT = `(function () {
  var NS = ${JSON.stringify(CAST_NAMESPACE)};
  var boot = { queue: [], listener: null, mounted: false, send: function () {} };
  window.__laCast = boot;
  function show(text) {
    var box = document.getElementById('la-cast-error');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'la-cast-error';
      box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;margin:0;padding:16px;' +
        'background:#7f1d1d;color:#fff;font:20px/1.4 monospace;white-space:pre-wrap;max-height:50vh;overflow:auto';
      box.textContent = 'Browser: ' + navigator.userAgent;
      document.body.appendChild(box);
    }
    box.textContent += '\\n' + text;
  }
  window.addEventListener('error', function (event) {
    show('Error: ' + event.message + ' (' + event.filename + ':' + event.lineno + ')');
  });
  window.addEventListener('unhandledrejection', function (event) {
    show('Error: ' + (event.reason && event.reason.message ? event.reason.message : event.reason));
  });
  setTimeout(function () {
    if (!boot.mounted) show('The Little Ants app did not start on this TV.');
  }, 10000);
  function emit(event) {
    if (boot.listener) boot.listener(event); else boot.queue.push(event);
  }
  try {
    var context = cast.framework.CastReceiverContext.getInstance();
    var system = cast.framework.system;
    context.addCustomMessageListener(NS, function (event) { emit({ kind: 'message', data: event.data }); });
    context.addEventListener(system.EventType.SENDER_CONNECTED, function (event) {
      context.sendCustomMessage(NS, event.senderId, { type: 'ready' });
    });
    context.addEventListener(system.EventType.SENDER_DISCONNECTED, function () {
      if (context.getSenders().length === 0) emit({ kind: 'idle' });
    });
    boot.send = function (message) { context.sendCustomMessage(NS, undefined, message); };
    var namespaces = {};
    namespaces[NS] = system.MessageType.JSON;
    // A lesson can stay on one page for a long time: never close the receiver for being idle.
    context.start({ disableIdleTimeout: true, customNamespaces: namespaces });
  } catch (error) {
    show('Cast receiver did not start: ' + (error && error.message ? error.message : error));
  }
})();`;

function castBoot(): CastBoot | undefined {
  return (window as unknown as { __laCast?: CastBoot }).__laCast;
}

/** Google Cast messages for the TV display, through the boot script's queue. */
const castLink: DisplayLink = {
  connect({ onMessage, onIdle }) {
    const boot = castBoot();
    if (!boot) return () => undefined;
    const handle = (event: BootEvent): void => {
      if (event.kind === 'message') onMessage(event.data);
      else onIdle();
    };
    boot.queue.splice(0).forEach(handle);
    boot.listener = handle;
    return () => {
      boot.listener = null;
    };
  },
  send(message) {
    castBoot()?.send(message);
  },
};

/** Runs on the classroom TV as the Google Cast receiver. No sign-in: it shows what the teacher's device sends. */
export default function CastReceiverPage() {
  useEffect(() => {
    const boot = castBoot();
    if (boot) boot.mounted = true;
  }, []);
  return (
    <>
      {/* Plain scripts, run while the HTML is parsed (before React): the SDK, then the boot script. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src={RECEIVER_SDK} />
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <TvDisplay link={castLink} />
    </>
  );
}
