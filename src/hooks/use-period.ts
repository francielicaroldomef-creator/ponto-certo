import { useEffect, useRef, useState } from "react";
import { monthRangeSP, monthToDateSP } from "@/lib/format";

/**
 * Default apuração period. Month-to-date by default; pass fullMonth for planning screens.
 * While the user has not touched the date pickers, the period follows the São Paulo clock,
 * so it rolls over automatically at midnight / month change without losing edits.
 */
export function useDefaultPeriod(fullMonth = false): [string, string, (f: string) => void, (t: string) => void] {
  const compute = () => (fullMonth ? monthRangeSP() : monthToDateSP());
  const [[from, to], setPeriod] = useState<[string, string]>(compute);
  const touched = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (touched.current) return;
      const [f, t] = compute();
      setPeriod((prev) => (prev[0] === f && prev[1] === t ? prev : [f, t]));
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullMonth]);
  const setFrom = (f: string) => { touched.current = true; setPeriod(([, t]) => [f, t]); };
  const setTo = (t: string) => { touched.current = true; setPeriod(([f]) => [f, t]); };
  return [from, to, setFrom, setTo];
}
