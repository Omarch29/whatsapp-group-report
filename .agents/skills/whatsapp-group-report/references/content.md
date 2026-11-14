# The files of `content/`

`content/` holds the developer's editorial files. It is gitignored (only `content/example/`, the fictional group,
is tracked). The pipeline reads it with `uv run python -I scripts/build_pipeline.py` (default `--content content`);
the site reads `nicknames.json` and `conclusion.md` from it at `pnpm build`.

Which files must exist:

| File | Needed by | If missing |
|---|---|---|
| `people.json` | the pipeline | the full run stops (contact surnames would reach the site) |
| `badwords.txt` | the pipeline | the full run stops |
| `events.json` | the pipeline | no events chapter content (`check_report.py` says `thin no events`) |
| `nicknames.json` | the pipeline and `pnpm build` | nobody shows a nickname |
| `conclusion.md` | `pnpm build` | the build fails once `content/` holds any file |

All texts are UTF-8. Never overwrite an existing file without asking. The examples below are the fictional group
"Los del Parque"; full copies are in `content/example/`.

## `people.json`

Contact name exactly as in the export (copied from `summary.json` by `draft_content.py`: never retype a key, they
carry quotes, emoji and invisible characters) to short name. `me` is the developer's short name, `group` the
names the export uses for the group itself (system messages), `aliases` the lowercased nicknames (so the phrase
detector does not take them for catchphrases).

```json
{
  "me": "Ana",
  "group": ["Los del Parque 🌳"],
  "people": {
    "Ana Rivas": "Ana",
    "Tomi \"Tomate\" Suárez🍅": "Tomi",
    "Bruno \"Brujo\" Castro": "Bruno",
    "Tú": "Ana"
  },
  "aliases": ["brujo", "tomate"]
}
```

- Edit only the values (short names), `me` and, if needed, `aliases`.
- A `Tú`/`You` key is the developer's own messages: its value is their short name, the same as `me`.
- Two keys may share a short name (one person with two contacts or two phones). Two different short names may not
  differ only in accents, case or punctuation (`Martín` and `Martin`): they would share one profile, and the pipeline
  refuses them; rename one (`Martín S.`).
- A `Persona N` / `Person N` value is a contact with no usable first name: usually a number that is not saved in the
  developer's contacts, sometimes a first name that is also someone else's surname. The developer names them; one
  they cannot name may stay as it is.
- Short names are published: first names or nicknames, never a surname.

## `nicknames.json`

Short name to the nickname the group uses for that person. The site shows it in the profiles, the people chapter
and the awards, and the pipeline uses it to find the departures person in the chat. Leave a person out if the group does not use a nickname for them.

```json
{
  "Tomi": "Tomate",
  "Bruno": "Brujo",
  "Caro": "Carola"
}
```

## `events.json`

A list of the group's events (how to pick them: `writing.md`). Keys, all required:

- `id`: lowercase slug, unique (`cumple-caro`).
- `title`: short, recognisable to the group, in the chat's language.
- `terms`: a regular expression (Python syntax, matched case-insensitively against each message) for the words
  people use when they talk about it. In JSON, `\b` is written `\\b`.
- `from`, `to`: the window to look for the day of origin, `YYYY-MM-DD`, `from` <= `to`.
- `note`: one sentence, in the chat's language, with facts from the data only.
- `saga` (optional, `true`): a running theme rather than a one-off event.

```json
[
  {
    "id": "cumple-caro",
    "title": "El cumple de Caro",
    "terms": "cumple|torta|regalo",
    "from": "2025-12-11",
    "to": "2025-12-15",
    "note": "El día que más se habló en el grupo: torta, regalo entre todos y festejo."
  }
]
```

The site ranks events by how many later days the group came back to them; an event whose `terms` match nothing in
its window is dropped (its entry in `data/analysis/events.json` has an `"error"` key).

## `badwords.txt`

The swear words counted by the Language chapter. One per line, lowercase, without accents; multi-word entries are
allowed; lines starting with `#` are ignored. `draft_content.py` writes the base list of the language; add what the
group says and the list misses, remove what it uses harmlessly.

```text
# Swear words for the Language chapter. One per line, lowercase, no accents.
boludo
la puta que te pario
mierda
```

## `conclusion.md`

The closing text of the report (how to write it: `writing.md`): three short paragraphs separated by blank lines,
then a signature line with an em dash and the developer's short name. HTML comments are dropped. Never write the
words BORRADOR or DRAFT in it (the build warns that it is still a draft).

```markdown
Arrancamos contando mensajes y terminamos juntando historias: el chimichurri de Tomi, las cábalas de la final y la torta de Caro.

Hay récords que dan un poco de vergüenza y palabras que solo entendemos nosotros.

Que la próxima encuesta también la gane el asado. Nos vemos en el parque.

— Ana
```
