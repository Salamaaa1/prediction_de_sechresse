import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

export function useCounter(target, { duration = 1100, decimals = 1 } = {}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const startTime = performance.now();
    const abs = Math.abs(target);
    const sign = target < 0 ? -1 : 1;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(sign * abs * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  const formatted = target < 0
    ? `−${Math.abs(value).toFixed(decimals)}`
    : value.toFixed(decimals);

  return { value, formatted, ref };
}
