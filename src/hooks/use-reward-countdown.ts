import { useState, useEffect } from 'react';

interface CountdownResult {
  timeLeft: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  isReady: boolean;
}

export const useRewardCountdown = (
  lastDistributionAt: string | null | undefined,
  frequencyValue: number,
  frequencyUnit: string
): CountdownResult => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!lastDistributionAt) {
        return 0;
      }

      const lastDistribution = new Date(lastDistributionAt).getTime();
      const now = Date.now();
      
      // Convert frequency to milliseconds
      let frequencyMs: number;
      switch (frequencyUnit) {
        case 'minutes':
          frequencyMs = frequencyValue * 60 * 1000;
          break;
        case 'hours':
          frequencyMs = frequencyValue * 60 * 60 * 1000;
          break;
        case 'days':
          frequencyMs = frequencyValue * 24 * 60 * 60 * 1000;
          break;
        default:
          frequencyMs = frequencyValue * 60 * 60 * 1000;
      }

      const nextDistribution = lastDistribution + frequencyMs;
      const remaining = Math.max(0, nextDistribution - now);
      
      return remaining;
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [lastDistributionAt, frequencyValue, frequencyUnit]);

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    timeLeft,
    hours,
    minutes,
    seconds,
    formatted,
    isReady: timeLeft === 0
  };
};