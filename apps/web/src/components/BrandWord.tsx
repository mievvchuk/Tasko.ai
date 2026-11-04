import { useLayoutEffect, useRef } from "react";
import "./brand-word.css";

export function BrandWord() {
  const ref = useRef<HTMLSpanElement>(null);
  // Відстань між двома «a» залежить від шрифту, тому міряємо її після завантаження шрифту (в em, щоб не залежати від розміру)
  useLayoutEffect(() => {
    const word = ref.current;
    if (!word) return;
    // Chrome передає анімацію transform у компоновник зі значенням var() на момент старту
    // і пізнішу зміну --travel не бачить. Тому анімацію вмикаємо (data-ready) лише після
    // виміру, а при новому вимірі перезапускаємо її.
    const measure = () => {
      const [first, second] = word.querySelectorAll<HTMLElement>(".brand-letter");
      const em = parseFloat(getComputedStyle(word).fontSize);
      const travel = `${(second.offsetLeft - first.offsetLeft) / em}em`;
      if (word.dataset.ready !== undefined && word.style.getPropertyValue("--travel") === travel) return;
      delete word.dataset.ready;
      word.style.setProperty("--travel", travel);
      void word.offsetWidth; // застосувати стиль без анімації, щоб вона стартувала заново
      word.dataset.ready = "";
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);
  return (<span ref={ref} className="brand-word" role="img" aria-label="Tasko.ai"><span aria-hidden="true">T<span className="brand-letter brand-letter-first">a</span><span className="brand-mid">sko</span><span className="brand-ai"><span className="brand-mid">.</span><span className="brand-letter brand-letter-second">a</span>i</span></span></span>);
}
