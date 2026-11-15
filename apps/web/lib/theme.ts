export const THEME_KEY = 'mustlist-theme';

/** Runs in <head> before paint: applies a saved theme choice (otherwise the system's). */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
