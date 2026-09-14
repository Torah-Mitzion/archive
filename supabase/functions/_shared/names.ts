/* The names people give for a photograph, in every script the site reads.
 *
 * "Rabbi Cohen and his wife Sara" arrives in whatever language the sender
 * writes; the year page is read in six. One model call renders the line in
 * English, Hebrew and Russian — transliterating names rather than
 * translating them, and translating the words around them — and the site
 * falls back to English for French, German and Spanish, which use the same
 * Latin transliteration. The original is always kept beside the renderings.
 *
 * Best effort: a quota error leaves the original alone and the renderings
 * empty, which the sweep or a later edit can fill in. */

export type Rendered = Record<string, string>;

export async function renderNames(model: string, key: string, text: string, kind: 'people' | 'occasion'): Promise<Rendered> {
  const src = (text ?? '').trim();
  if (!src || !key) return {};
  const what = kind === 'people'
    ? 'a list of people in a photograph (names, possibly with relationships or titles)'
    : 'a short description of the occasion a photograph was taken at';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text:
`Render this text — ${what} — in English, Hebrew and Russian.
Names are TRANSLITERATED (never translated): כהן → Cohen → Коэн; Yitzhak → יצחק → Ицхак.
Use the usual spellings for common Jewish names (Chaim, Moshe, Sara, Yehuda). Words that are
not names (and his wife, farewell party) are translated. Keep titles: הרב → Rabbi → Рав. The community's own
words stay as terms, transliterated: שליחים → shlichim → шлихим, שליח → shaliach, שליחה → shlicha, ראש כולל → Rosh Kollel, כולל → kollel.
If the text is already in one of the languages, keep it as is for that language.
Return ONLY JSON: {"en": string, "he": string, "ru": string}

Text: """${src.slice(0, 500)}"""` }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        }) });
    if (!res.ok) return {};
    const out = JSON.parse((await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}');
    const clean: Rendered = {};
    for (const l of ['en', 'he', 'ru']) if (typeof out[l] === 'string' && out[l].trim()) clean[l] = out[l].trim().slice(0, 500);
    return clean;
  } catch { return {}; }
}
