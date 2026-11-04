import { useLayoutEffect, useRef } from "react";
import "./brand-word.css";

export function BrandWord() {
  const ref = useRef<HTMLSpanElement>(null);
  // Відстань між двома «a» залежить від шрифту, тому міряємо її після завантаження шрифту (в em, щоб не залежати від розміру)
  useLayoutEffect(() => {
    const word = ref.current;
    if (!word) return;
    const measure = () => {
      const [first, second] = word.querySelectorAll<HTMLElement>(".brand-letter");
      const em = parseFloat(getComputedStyle(word).fontSize);
      word.style.setProperty("--travel", `${(second.offsetLeft - first.offsetLeft) / em}em`);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);
  return (<span ref={ref} className="brand-word" role="img" aria-label="Tasko.ai"><span aria-hidden="true">T<span className="brand-letter brand-letter-first">a</span><span className="brand-mid">sko</span><span className="brand-ai"><span className="brand-mid">.</span><span className="brand-letter brand-letter-second">a</span>i</span></span></span>);
}
