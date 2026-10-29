'use client';

import Script from 'next/script';
import { useMemo, useState } from 'react';
import { TvDisplay, type DisplayLink } from '../../components/tv-display';
import { CAST_NAMESPACE, type ReceiverMessage } from '../../lib/cast-protocol';

/** The parts of the Cast Web Receiver SDK this page uses (loaded from gstatic, so no npm types). */
interface ReceiverContext {
  addCustomMessageListener(
    namespace: string,
    listener: (event: { senderId: string; data: unknown }) => void,
  ): void;
  sendCustomMessage(namespace: string, senderId: string | undefined, data: ReceiverMessage): void;
  addEventListener(type: string, listener: (event: { senderId: string }) => void): void;
  getSenders(): unknown[];
  start(options: { disableIdleTimeout: boolean; customNamespaces: Record<string, string> }): void;
}

interface ReceiverSdk {
  framework: {
    CastReceiverContext: { getInstance(): ReceiverContext };
    system: {
      EventType: { SENDER_CONNECTED: string; SENDER_DISCONNECTED: string };
      MessageType: { JSON: string };
    };
  };
}

const RECEIVER_SDK = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';

/** Google Cast messages for the TV display. The receiver context can start only once per page. */
function castLink(sdk: ReceiverSdk): DisplayLink {
  const { CastReceiverContext, system } = sdk.framework;
  const receiver = CastReceiverContext.getInstance();
  let started = false;
  return {
    connect({ onMessage, onIdle }) {
      if (started) return () => undefined;
      started = true;
      receiver.addCustomMessageListener(CAST_NAMESPACE, (event) => onMessage(event.data as never));
      receiver.addEventListener(system.EventType.SENDER_CONNECTED, (event) => {
        receiver.sendCustomMessage(CAST_NAMESPACE, event.senderId, { type: 'ready' });
      });
      receiver.addEventListener(system.EventType.SENDER_DISCONNECTED, () => {
        if (receiver.getSenders().length === 0) onIdle();
      });
      // A lesson can stay on one page for a long time: never close the receiver for being idle.
      receiver.start({
        disableIdleTimeout: true,
        customNamespaces: { [CAST_NAMESPACE]: system.MessageType.JSON },
      });
      return () => undefined;
    },
    send(message) {
      receiver.sendCustomMessage(CAST_NAMESPACE, undefined, message);
    },
  };
}

/** Runs on the classroom TV as the Google Cast receiver. No sign-in: it shows what the teacher's device sends. */
export default function CastReceiverPage() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const link = useMemo(() => {
    const sdk = sdkLoaded ? (window as unknown as { cast?: ReceiverSdk }).cast : undefined;
    return sdk ? castLink(sdk) : null;
  }, [sdkLoaded]);
  return (
    <>
      <Script src={RECEIVER_SDK} strategy="afterInteractive" onReady={() => setSdkLoaded(true)} />
      <TvDisplay link={link} />
    </>
  );
}
