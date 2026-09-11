/**
 * The itinerary, in one place.
 *
 * Both src/app.html and src/guest.html render these days, so the array lives
 * here rather than inside either page: editing a day in one and not the other
 * is exactly the drift this file exists to prevent. src/index.js imports it and
 * substitutes it into whichever template it is serving, at %%DAYS%%.
 *
 * Shape of a day:
 *   d   ISO date
 *   t   title
 *   am  morning
 *   pm  afternoon
 *   n   a note, may be empty
 *   pl  places, each {n: Hebrew label, en: English label, q: search query, ll: 'lat,lng'}
 *   gt  guest-facing title, falls back to t
 *   gam guest-facing morning, falls back to am
 *   gpm guest-facing afternoon, falls back to pm
 *   en  the guest-facing English of the day, {t, am, pm}
 *
 * On gt and gam. The guest password is shared, so whatever a guest can see is
 * effectively semi-public. The working mornings are a paid-nothing handover of
 * someone else's freight business: session numbering, Deckhand, QuickBooks and
 * the ownership transfer are Yigal's business and not a houseguest's. So the
 * working days carry a neutral guest label and the real one stays in the app.
 * Afternoons, places and free days are the same for everyone, which is the part
 * a guest actually wants: where we are and when we are free. The guest page
 * never renders `n`; those notes are reminders to ourselves.
 *
 * On `en`. It is the English of the GUEST day, not of the real one: it says
 * "Work morning", never the session number, because the only page that renders
 * English is the guest view and a guest never sees the real title. There is
 * deliberately no English of `t` or `n`. The app is Hebrew and stays Hebrew, so
 * src/index.js strips `en` out of the payload it hands the app; adding an
 * English field here therefore costs the app nothing.
 *
 * On `q` and `ll`. The label the user sees is Hebrew or English; the query is
 * always English because map apps resolve US landmarks far more reliably that
 * way. `ll` is a precise pin and is used in preference to `q` when present,
 * which matters for the vague entries: "Malibu" is a whole city and "Venice
 * Beach" is two miles of sand, so a coordinate puts the pin where we are
 * actually going.
 *
 * The two home addresses deliberately carry no `ll`. A verbatim street address
 * is the most precise thing Google can be handed, and it geocodes exactly;
 * a hand-written coordinate would only be less accurate than the address it
 * replaced. They are quoted verbatim from CLAUDE.md and must stay that way.
 */

const BASE  = { n: 'הבסיס', en: 'Our place', q: '117 S Doheny Dr, Los Angeles, CA 90048' };
const YIGAL = { n: 'יגאל',  en: 'Yigal',     q: '411 N Oakhurst Dr, Beverly Hills, CA 90210' };
const LAX   = { n: 'LAX',   en: 'LAX',       q: 'Los Angeles International Airport', ll: '33.9416,-118.4085' };

export const DAYS = [
  {d:'2026-09-23', t:'טסים', am:'06:00 המראה מנתב״ג. עצירה של שעה ועשר בווינה.', pm:'נוחתים ב-LAX ב-13:05, רכב, סופר, שלום ליגאל', n:'אסור לישון אחרי הצהריים. להחזיק מעמד עד 20:00.', en:{t:'Flying out', am:'Take off from Tel Aviv at 06:00; a 1h 10m connection in Vienna.', pm:'Landing at LAX at 13:05; car, groceries, hello to Yigal.'}, pl:[LAX, BASE, YIGAL]},
  {d:'2026-09-24', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 1 · רק לצפות', am:'07:00 אצל יגאל. Tidelane לא נפתחת.', pm:'מוזיאון הרכב של פטרסן', n:'בלי שאלות היום. רק עיניים. ולתזמן כמה זמן לוקח להקליד מספרים מהמייל.', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'Petersen Automotive Museum'}, pl:[YIGAL, {n:'מוזיאון פטרסן',en:'Petersen Museum',q:'Petersen Automotive Museum, Los Angeles',ll:'34.0622,-118.3614'}]},
  {d:'2026-09-25', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 2 · Deckhand v0 בידיים שלו', am:'07:00 אצל יגאל', pm:'בורות הזפת של לה בריאה ומוזיאון LACMA', n:'ערב חג ראשון של סוכות', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'La Brea Tar Pits and LACMA'}, pl:[YIGAL, {n:'בורות הזפת',en:'La Brea Tar Pits',q:'La Brea Tar Pits, Los Angeles',ll:'34.0639,-118.3556'}, {n:'LACMA',en:'LACMA',q:'Los Angeles County Museum of Art',ll:'34.0639,-118.3592'}]},
  {d:'2026-09-26', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 3 · Deckhand מול המיילים המכוערים', am:'07:00 אצל יגאל', pm:'מזח סנטה מוניקה וחוף וניס', n:'המיילים האמיתיים מהתיבה שלו, לא דוגמאות.', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'Santa Monica Pier and Venice Beach'}, pl:[YIGAL, {n:'מזח סנטה מוניקה',en:'Santa Monica Pier',q:'Santa Monica Pier',ll:'34.0094,-118.4973'}, {n:'חוף וניס',en:'Venice Beach',q:'Venice Beach, Los Angeles',ll:'33.9850,-118.4695'}]},
  {d:'2026-09-27', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 4 · חריגים', am:'07:00 אצל יגאל', pm:'מוזיאון גטי, או חוף זומה אם חם', n:'הבוקר הכי חשוב בשבוע. כל "חוץ מ" נרשם.', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'The Getty, or Zuma Beach if it is hot'}, pl:[YIGAL, {n:'מוזיאון גטי',en:'The Getty',q:'Getty Center, Los Angeles',ll:'34.0780,-118.4741'}, {n:'חוף זומה',en:'Zuma Beach',q:'Zuma Beach, Malibu',ll:'34.0259,-118.8214'}]},
  {d:'2026-09-28', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 5 · נתונים אמיתיים', am:'07:00 אצל יגאל', pm:'מרכז המדע של קליפורניה, מעבורת אנדוור', n:'כרטיסים מראש', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'California Science Center, the shuttle Endeavour'}, pl:[YIGAL, {n:'מרכז המדע',en:'Science Center',q:'California Science Center, Los Angeles',ll:'34.0156,-118.2860'}]},
  {d:'2026-09-29', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 6 · QuickBooks חי', am:'07:00 אצל יגאל', pm:'מלרוז, ואז מצפה גריפית בשקיעה', n:'', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'Melrose, then Griffith Observatory at sunset'}, pl:[YIGAL, {n:'מלרוז',en:'Melrose',q:'Melrose Avenue, Los Angeles',ll:'34.0837,-118.3614'}, {n:'מצפה גריפית',en:'Griffith Observatory',q:'Griffith Observatory, Los Angeles',ll:'34.1184,-118.3004'}]},
  {d:'2026-09-30', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 7 · מסירה', am:'07:00 אצל יגאל. הבוקר שהכול מתנקז אליו.', pm:'כביש החוף למאליבו', n:'אם הבוקר לא הצליח, מבטלים את אחר הצהריים ומתקנים.', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'The coast road up to Malibu'}, pl:[YIGAL, {n:'מאליבו',en:'Malibu',q:'Malibu, California',ll:'34.0259,-118.7798'}]},
  {d:'2026-10-01', t:'יום חופשי מלא', am:'יוניברסל סטודיוס', pm:'יוניברסל סטודיוס', n:'לצאת מהפארק לפני שיורד הלילה', en:{t:'A completely free day', am:'Universal Studios', pm:'Universal Studios'}, pl:[{n:'יוניברסל',en:'Universal Studios',q:'Universal Studios Hollywood',ll:'34.1381,-118.3534'}]},
  {d:'2026-10-02', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'רזרבה · צדדים והרשאות + המשימה של בן', am:'07:00 צדדים והרשאות, ואז תיקונים, חשבונות דמו, מפתח הצפנה', pm:'סנטה מוניקה ווניס: שלושה עסקים, באנגלית', gpm:'סנטה מוניקה וחוף וניס', n:'', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'Santa Monica and Venice Beach'}, pl:[{n:'מזח סנטה מוניקה',en:'Santa Monica Pier',q:'Santa Monica Pier',ll:'34.0094,-118.4973'}, {n:'חוף וניס',en:'Venice Beach',q:'Venice Beach, Los Angeles',ll:'33.9850,-118.4695'}]},
  {d:'2026-10-03', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'רזרבה · סגירה והעברת בעלות', am:'נהלים, ובמסלול א׳ גם Cloudflare, D1 ו-Intuit על שמו', pm:'הוליווד בולוורד, או רניון קניון', n:'היום האחרון שאפשר לתקן בו משהו', en:{t:'Work morning', am:"Working at Yigal's, 07:00 to 10:00", pm:'Hollywood Boulevard, or Runyon Canyon'}, pl:[{n:'הוליווד בולוורד',en:'Hollywood Boulevard',q:'Hollywood Boulevard, Los Angeles',ll:'34.1016,-118.3400'}, {n:'רניון קניון',en:'Runyon Canyon',q:'Runyon Canyon Park, Los Angeles',ll:'34.1064,-118.3505'}]},
  {d:'2026-10-04', t:'יום חופשי מלא', am:'סיקס פלאגס מג׳יק מאונטן', pm:'סיקס פלאגס מג׳יק מאונטן', n:'בערב ארוחה אחרונה עם יגאל', en:{t:'A completely free day', am:'Six Flags Magic Mountain', pm:'Six Flags Magic Mountain'}, pl:[{n:'סיקס פלאגס',en:'Six Flags',q:'Six Flags Magic Mountain, Valencia CA',ll:'34.4256,-118.5971'}]},
  {d:'2026-10-05', t:'טסים הביתה', am:'אורזים, מחזירים רכב, בשדה ב-12:00', pm:'המראה 15:05, עצירה בפרנקפורט', n:'נוחתים בתל אביב ג׳ 6.10 ב-19:15', en:{t:'Flying home', am:'Packing, returning the car, at the airport by 12:00', pm:'Take off at 15:05, connecting in Frankfurt'}, pl:[LAX]}
];
