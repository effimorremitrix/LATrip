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
 *   pl  places, each {n: Hebrew label, q: search query, ll: 'lat,lng'}
 *   gt  guest-facing title, falls back to t
 *   gam guest-facing morning, falls back to am
 *   gpm guest-facing afternoon, falls back to pm
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
 * On `q` and `ll`. The label the user sees is Hebrew; the query is English
 * because map apps resolve US landmarks far more reliably that way. `ll` is a
 * precise pin and is used in preference to `q` when present, which matters for
 * the vague entries: "Malibu" is a whole city and "Venice Beach" is two miles
 * of sand, so a coordinate puts the pin where we are actually going.
 *
 * The two home addresses deliberately carry no `ll`. A verbatim street address
 * is the most precise thing Google can be handed, and it geocodes exactly;
 * a hand-written coordinate would only be less accurate than the address it
 * replaced. They are quoted verbatim from CLAUDE.md and must stay that way.
 */

const BASE  = { n: 'הבסיס', q: '117 S Doheny Dr, Los Angeles, CA 90048' };
const YIGAL = { n: 'יגאל',  q: '411 N Oakhurst Dr, Beverly Hills, CA 90210' };
const LAX   = { n: 'LAX',   q: 'Los Angeles International Airport', ll: '33.9416,-118.4085' };

export const DAYS = [
  {d:'2026-09-23', t:'טסים', am:'06:00 המראה מנתב״ג. עצירה של שעה ועשר בווינה.', pm:'נוחתים ב-LAX ב-13:05, רכב, סופר, שלום ליגאל', n:'אסור לישון אחרי הצהריים. להחזיק מעמד עד 20:00.', pl:[LAX, BASE, YIGAL]},
  {d:'2026-09-24', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 1 · רק לצפות', am:'07:00 אצל יגאל. Tidelane לא נפתחת.', pm:'מוזיאון הרכב של פטרסן', n:'בלי שאלות היום. רק עיניים. ולתזמן כמה זמן לוקח להקליד מספרים מהמייל.', pl:[YIGAL, {n:'מוזיאון פטרסן',q:'Petersen Automotive Museum, Los Angeles',ll:'34.0622,-118.3614'}]},
  {d:'2026-09-25', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 2 · Deckhand v0 בידיים שלו', am:'07:00 אצל יגאל', pm:'בורות הזפת של לה בריאה ומוזיאון LACMA', n:'ערב חג ראשון של סוכות', pl:[YIGAL, {n:'בורות הזפת',q:'La Brea Tar Pits, Los Angeles',ll:'34.0639,-118.3556'}, {n:'LACMA',q:'Los Angeles County Museum of Art',ll:'34.0639,-118.3592'}]},
  {d:'2026-09-26', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 3 · Deckhand מול המיילים המכוערים', am:'07:00 אצל יגאל', pm:'מזח סנטה מוניקה וחוף וניס', n:'המיילים האמיתיים מהתיבה שלו, לא דוגמאות.', pl:[YIGAL, {n:'מזח סנטה מוניקה',q:'Santa Monica Pier',ll:'34.0094,-118.4973'}, {n:'חוף וניס',q:'Venice Beach, Los Angeles',ll:'33.9850,-118.4695'}]},
  {d:'2026-09-27', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 4 · חריגים', am:'07:00 אצל יגאל', pm:'מוזיאון גטי, או חוף זומה אם חם', n:'הבוקר הכי חשוב בשבוע. כל "חוץ מ" נרשם.', pl:[YIGAL, {n:'מוזיאון גטי',q:'Getty Center, Los Angeles',ll:'34.0780,-118.4741'}, {n:'חוף זומה',q:'Zuma Beach, Malibu',ll:'34.0259,-118.8214'}]},
  {d:'2026-09-28', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 5 · נתונים אמיתיים', am:'07:00 אצל יגאל', pm:'מרכז המדע של קליפורניה, מעבורת אנדוור', n:'כרטיסים מראש', pl:[YIGAL, {n:'מרכז המדע',q:'California Science Center, Los Angeles',ll:'34.0156,-118.2860'}]},
  {d:'2026-09-29', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 6 · QuickBooks חי', am:'07:00 אצל יגאל', pm:'מלרוז, ואז מצפה גריפית בשקיעה', n:'', pl:[YIGAL, {n:'מלרוז',q:'Melrose Avenue, Los Angeles',ll:'34.0837,-118.3614'}, {n:'מצפה גריפית',q:'Griffith Observatory, Los Angeles',ll:'34.1184,-118.3004'}]},
  {d:'2026-09-30', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'סשן 7 · מסירה', am:'07:00 אצל יגאל. הבוקר שהכול מתנקז אליו.', pm:'כביש החוף למאליבו', n:'אם הבוקר לא הצליח, מבטלים את אחר הצהריים ומתקנים.', pl:[YIGAL, {n:'מאליבו',q:'Malibu, California',ll:'34.0259,-118.7798'}]},
  {d:'2026-10-01', t:'יום חופשי מלא', am:'יוניברסל סטודיוס', pm:'יוניברסל סטודיוס', n:'לצאת מהפארק לפני שיורד הלילה', pl:[{n:'יוניברסל',q:'Universal Studios Hollywood',ll:'34.1381,-118.3534'}]},
  {d:'2026-10-02', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'רזרבה · צדדים והרשאות + המשימה של בן', am:'07:00 צדדים והרשאות, ואז תיקונים, חשבונות דמו, מפתח הצפנה', pm:'סנטה מוניקה ווניס: שלושה עסקים, באנגלית', gpm:'סנטה מוניקה וחוף וניס', n:'', pl:[{n:'מזח סנטה מוניקה',q:'Santa Monica Pier',ll:'34.0094,-118.4973'}, {n:'חוף וניס',q:'Venice Beach, Los Angeles',ll:'33.9850,-118.4695'}]},
  {d:'2026-10-03', gt:'בוקר עבודה', gam:'עבודה אצל יגאל, 07:00 עד 10:00', t:'רזרבה · סגירה והעברת בעלות', am:'נהלים, ובמסלול א׳ גם Cloudflare, D1 ו-Intuit על שמו', pm:'הוליווד בולוורד, או רניון קניון', n:'היום האחרון שאפשר לתקן בו משהו', pl:[{n:'הוליווד בולוורד',q:'Hollywood Boulevard, Los Angeles',ll:'34.1016,-118.3400'}, {n:'רניון קניון',q:'Runyon Canyon Park, Los Angeles',ll:'34.1064,-118.3505'}]},
  {d:'2026-10-04', t:'יום חופשי מלא', am:'סיקס פלאגס מג׳יק מאונטן', pm:'סיקס פלאגס מג׳יק מאונטן', n:'בערב ארוחה אחרונה עם יגאל', pl:[{n:'סיקס פלאגס',q:'Six Flags Magic Mountain, Valencia CA',ll:'34.4256,-118.5971'}]},
  {d:'2026-10-05', t:'טסים הביתה', am:'אורזים, מחזירים רכב, בשדה ב-12:00', pm:'המראה 15:05, עצירה בפרנקפורט', n:'נוחתים בתל אביב ג׳ 6.10 ב-19:15', pl:[LAX]}
];
