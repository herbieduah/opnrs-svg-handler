import Prism from "prismjs";
import "prismjs/components/prism-jsx";
import "prismjs/themes/prism.css";

export function highlight(code, language = "jsx") {
  // Always treat code as string, never a Promise
  if (typeof code !== 'string') {
    if (code && typeof code.then === 'function') {
      return '';
    }
    code = code ? String(code) : '';
  }
  // Defensive: check Prism and Prism.languages exist
  if (typeof Prism === 'undefined' || !Prism.languages) {
    if (typeof window !== 'undefined' && window.console) {
      console.warn('Prism.js or Prism.languages is not loaded! Highlighting will be skipped.');
    }
    return code;
  }
  const lang = Prism.languages[language] ? language : 'jsx';
  try {
    if (!Prism.languages[lang]) return code;
    return Prism.highlight(code, Prism.languages[lang], lang);
  } catch {
    return code;
  }
}


