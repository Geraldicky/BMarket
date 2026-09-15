import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { makeStyles } from '@/constants/theme';

/**
 * Types `text` once, character by character, then stops. Remount it (change its `key`)
 * to play the animation again.
 */
export function TypewriterOnce({ text, style, speed = 55, startDelay = 150 }: { text: string; style?: StyleProp<TextStyle>; speed?: number; startDelay?: number }) {
  const styles = useStyles();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let typed = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      typed += 1;
      setCount(typed);
      if (typed < text.length) timer = setTimeout(tick, speed);
    };
    timer = setTimeout(tick, startDelay);
    return () => clearTimeout(timer);
  }, [text, speed, startDelay]);

  const done = count >= text.length;
  return (
    <Text style={style} accessibilityLabel={text}>
      {text.slice(0, count)}
      {!done ? <Text style={styles.cursor}>|</Text> : null}
    </Text>
  );
}

/**
 * Types each phrase, holds it, erases it, then moves to the next phrase — forever.
 * `phrases` should be a stable array (e.g. a module-level constant).
 */
export function TypewriterLoop({ phrases, style, typeSpeed = 45, deleteSpeed = 22, holdMs = 1800, numberOfLines }: {
  phrases: string[];
  style?: StyleProp<TextStyle>;
  typeSpeed?: number;
  deleteSpeed?: number;
  holdMs?: number;
  numberOfLines?: number;
}) {
  const styles = useStyles();
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const phrase = phrases[index % phrases.length] ?? '';

  useEffect(() => {
    const id = setInterval(() => setCursorOn(on => !on), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let chars = 0;
    let timer: ReturnType<typeof setTimeout>;
    const erase = () => {
      chars -= 1;
      setCount(Math.max(0, chars));
      if (chars > 0) timer = setTimeout(erase, deleteSpeed);
      else timer = setTimeout(() => setIndex(current => (current + 1) % phrases.length), 350);
    };
    const type = () => {
      chars += 1;
      setCount(chars);
      timer = chars < phrase.length ? setTimeout(type, typeSpeed) : setTimeout(erase, holdMs);
    };
    timer = setTimeout(type, 300);
    return () => clearTimeout(timer);
  }, [phrase, phrases.length, typeSpeed, deleteSpeed, holdMs]);

  return (
    <Text style={style} numberOfLines={numberOfLines} accessibilityLabel={phrase}>
      {phrase.slice(0, count)}
      <Text style={[styles.cursor, !cursorOn && styles.cursorHidden]}>|</Text>
    </Text>
  );
}

const useStyles = makeStyles(() => ({
  cursor: { fontFamily: 'PoppinsRegular', opacity: .7 },
  cursorHidden: { opacity: 0 },
}));
