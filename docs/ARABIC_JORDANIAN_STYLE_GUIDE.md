# Wasel Arabic Style Guide: "White Jordanian" (أردني مبسّط)

Applies to every `ar:` block in `src/locales/chunks/*` and to inline Arabic in components.

## Principles
1. **Jordanian, but readable by every Arabic speaker.** Urban Ammani colloquial (white dialect). No heavy slang or rural/Bedouin phonetics, so Gulf and Levantine visitors still understand everything.
2. **Spell with standard letters** (keep ق, ث, ذ, ظ). Do not transliterate speech sounds.
3. **Two registers:**
   - *Friendly UI* (landing, onboarding, buttons, toasts, errors, empty states, notifications): Jordanian colloquial.
   - *Binding text* (Terms of Service, Privacy Policy, consent text, legal pages): clear Modern Standard Arabic. Never colloquial. Short marketing summaries of these pages on the landing may be Jordanian.
4. **Masculine singular default** for imperatives ("اختار", "احجز"). Prefer gender-neutral phrasing where it costs nothing.
5. **Brand:** always «واصل» in Arabic text, never "Wasel". Latin only for universal tokens (SOS, AR, OTP).
6. **Do not mix** Syrian/Lebanese markers: no «عم» progressive (use plain present: «بنحمّل»), no «هلق/هلأ» (use «هسا»), no «مشان» (use «عشان»).

## Core vocabulary
| Concept | Use | Avoid |
|---|---|---|
| now | هسا | هلق، الآن (in UI) |
| here / there | هون / هناك | — |
| want | بدّك / بدي | ترغب |
| what / why / how / where to | شو / ليش / كيف / لوين | ماذا / لماذا |
| future | رح (رح تشوف) | سوف |
| negation | ما بـ، مش، ما في | لا يوجد |
| trip | مشوار (pl. مشاوير) | رحلة (ok in formal) |
| driver | سواق (pl. سواقين) | سائق (formal pages only) |
| money | مصاري، تكلفة | أموال (formal) |
| search | دوّر | ابحث (acceptable) |
| take / bring | خد / جيب | خذ |
| send | ابعت | أرسل |
| open an account | افتح حساب | أنشئ حساباً |
| email / phone | إيميل / تلفون | بريد إلكتروني / هاتف |
| haggling | فصال | مساومة |
| let's go | يلا / يلا نبدأ | هيا بنا |

## Tone
- Warm, direct, confident. Short sentences. Talk to one person ("إنت"), not an audience.
- Reassure with specifics (price, who, when), not adjectives.
- Never promise what the product does not do. No invented numbers or testimonials.
- Errors: say what happened, then what to do next, without blame. Example: «ما قدرنا نحفظ التغييرات. جرّب مرة ثانية.»

## Punctuation and layout
- Arabic comma «،» and question mark «؟». Guillemets «» for quoted UI labels.
- Keep `{placeholders}` untouched and check word order reads naturally in RTL.
- Use logical CSS (`start/end`, `margin-inline-*`) never `left/right`.
- Numerals: follow the app setting. Do not mix Eastern and Western digits in one sentence.

## Workflow per file
1. Keep all keys and `en:` values untouched.
2. Rewrite `ar:` only; keep placeholder tokens and HTML/markup identical.
3. Run `npm run type-check` and a visual check in RTL at 360px, 390px, and 430px.
4. Have a native Jordanian reviewer skim anything in payments, safety/SOS, and legal.
