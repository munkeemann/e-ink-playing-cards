/**
 * IdentifyCard — off-screen JPEG renderer for the diagnostics screen.
 *
 * Mirrors the CardRenderer pattern: a single hidden View driven through
 * a ref. Each capture() call mutates state, waits two RAFs for layout
 * to settle, then captures with react-native-view-shot. The single
 * renderer means captures must be serialized (don't fire concurrent
 * capture() calls), but the resulting JPEG bytes are then independent
 * and safe to POST in parallel.
 *
 * Visual: white card, very large bold numeral centered, "SLEEVE" label
 * below in display caps, IP address below that in body serif. High
 * contrast against the e-ink display.
 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { fonts } from '../theme/fonts';

export interface IdentifyCardRef {
  capture(id: number, ip: string): Promise<ArrayBuffer>;
}

function rafTick(): Promise<void> {
  // Wrap the inner resolve so the FrameRequestCallback's time arg isn't
  // bound to the Promise resolver (which expects void, not number).
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function toArrayBuffer(base64: string): Promise<ArrayBuffer> {
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer as ArrayBuffer;
}

const IdentifyCard = forwardRef<IdentifyCardRef>((_, ref) => {
  const viewRef = useRef<View>(null);
  const [state, setState] = useState<{ id: number; ip: string }>({ id: 0, ip: '' });

  useImperativeHandle(ref, () => ({
    async capture(id: number, ip: string): Promise<ArrayBuffer> {
      setState({ id, ip });
      await rafTick();
      const uri = await captureRef(viewRef, { format: 'jpg', quality: 0.85, result: 'base64' });
      return toArrayBuffer(uri);
    },
  }));

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <View ref={viewRef} style={styles.card} collapsable={false}>
        <Text style={styles.number}>{state.id}</Text>
        <Text style={styles.label}>SLEEVE</Text>
        <Text style={styles.ip}>{state.ip}</Text>
      </View>
    </View>
  );
});

IdentifyCard.displayName = 'IdentifyCard';

export default IdentifyCard;

const CARD_W = 296;
const CARD_H = 416;

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: CARD_W,
    height: CARD_H,
    overflow: 'hidden',
    opacity: 0,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  number: {
    fontSize: 240,
    fontFamily: fonts.displayBold,
    color: '#000000',
    lineHeight: 260,
    textAlign: 'center',
  },
  label: {
    fontSize: 28,
    fontFamily: fonts.display,
    letterSpacing: 8,
    color: '#222222',
    marginTop: 8,
  },
  ip: {
    fontSize: 18,
    fontFamily: fonts.body,
    color: '#555555',
    marginTop: 14,
  },
});
