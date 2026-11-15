import { useEffect } from 'react';

/** Include supporting evidence in print without leaving the screen layout expanded. */
export function usePrintDetails() {
  useEffect(() => {
    let expanded: HTMLDetailsElement[] = [];
    const before = () => {
      // A repeated beforeprint event must not forget which details were originally closed.
      for (const element of document.querySelectorAll<HTMLDetailsElement>('.mission-report details')) {
        if (!element.open) { expanded.push(element); element.open = true; }
      }
    };
    const after = () => { for (const element of expanded) element.open = false; expanded = []; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); after(); };
  }, []);
}
