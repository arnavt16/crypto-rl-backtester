import { useEffect, useState } from "react";
import { animate } from "framer-motion";

interface Props {
  value: number;
  format: (v: number) => string;
}

/** Animates a numeric stat counting up/down to its new value on change. */
export function AnimatedNumber({ value, format }: Props) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(display, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: setDisplay,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{format(display)}</span>;
}
