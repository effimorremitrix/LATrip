/**
 * The language switch, shared by the two pages that have one.
 *
 * src/login.html and src/guest.html both offer עברית/English, and both are
 * standalone templates with no build step, so without this file the detection
 * rule would exist twice and drift. src/index.js substitutes this string into
 * %%LANG%% in each template, the same way the itinerary goes into %%DAYS%%:
 * one definition, two pages. src/app.html has no toggle and no %%LANG%%.
 *
 * It is a string of plain ES5 rather than a module because it is inlined into a
 * <script> in each page. Keep it free of the sequence that would close that
 * script tag, and keep it dependency-free.
 */
export const LANG_JS = `
  /* Which language a visitor gets before they touch anything. What someone
     reads is a better guess than where they are standing, so the phone's
     language list decides first and the first decisive entry wins; an Israeli
     cousin in Los Angeles still lands in Hebrew. The timezone only breaks a
     tie, for a phone set to some third language. Nothing is stored, here or
     anywhere in these two pages, so this runs again on every open. */
  function detectLang(){
    var list = [];
    try{
      if (navigator.languages && navigator.languages.length) list = [].slice.call(navigator.languages);
      else if (navigator.language) list = [navigator.language];
    }catch(_){}

    for (var i = 0; i < list.length; i++){
      var l = String(list[i]).toLowerCase();
      /* "iw" is the retired ISO code for Hebrew; some Android builds still send it. */
      if (l.indexOf('he') === 0 || l.indexOf('iw') === 0) return 'he';
      if (l.indexOf('en') === 0) return 'en';
    }

    try{
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'Asia/Jerusalem' || tz === 'Asia/Tel_Aviv') return 'he';
    }catch(_){}

    return 'en';
  }

  /* Static chrome is duplicated in the markup as .l-he and .l-en pairs, with the
     English marked hidden there, so a visitor with no JavaScript still gets a
     readable Hebrew page rather than both languages at once. */
  function applyLangSpans(isHe){
    var show = document.querySelectorAll(isHe ? '.l-he' : '.l-en');
    var hide = document.querySelectorAll(isHe ? '.l-en' : '.l-he');
    Array.prototype.forEach.call(show, function(el){ el.hidden = false; });
    Array.prototype.forEach.call(hide, function(el){ el.hidden = true; });
  }

  /* No aria-label on the buttons on purpose: each is named by its own visible
     word, so "עברית" and "English" are both what is written on it and what a
     voice-control user has to say. The group carries the explanation. */
  function applyLangButtons(group, lang, groupLabel){
    group.setAttribute('aria-label', groupLabel);
    Array.prototype.forEach.call(group.querySelectorAll('button'), function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
  }
`;
