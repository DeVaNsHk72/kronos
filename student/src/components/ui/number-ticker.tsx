import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import {
  animate,
  type AnimationPlaybackControls,
  motion,
  useMotionValue,
  useTransform,
  type ValueAnimationTransition,
} from "motion/react";
import { cn } from "@/lib/utils";

interface NumberTickerProps {
  from?: number;
  target: number;
  transition?: ValueAnimationTransition;
  className?: string;
  autoStart?: boolean;
}

export interface NumberTickerRef {
  startAnimation: () => void;
}

const NumberTicker = forwardRef<NumberTickerRef, NumberTickerProps>(
  ({ from = 0, target, transition = { duration: 2, type: "tween", ease: "easeOut" }, className, autoStart = true }, ref) => {
    const count = useMotionValue(from);
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const [controls, setControls] = useState<AnimationPlaybackControls | null>(null);

    const startAnimation = useCallback(() => {
      controls?.stop();
      count.set(from);
      setControls(animate(count, target, { ...transition }));
    }, []);

    useImperativeHandle(ref, () => ({ startAnimation }));

    useEffect(() => {
      if (autoStart) startAnimation();
      return () => controls?.stop();
    }, [autoStart]);

    return <motion.span className={cn(className)}>{rounded}</motion.span>;
  },
);

NumberTicker.displayName = "NumberTicker";
export default NumberTicker;
