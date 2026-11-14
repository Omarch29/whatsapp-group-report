# whatsapp-group-report: diseño

Fecha: 2026-11-13. Estado: implementado; donde el plan se apartó de este diseño, lo dice cada sección.

## 1. Intención

Esto empezó como un informe privado: una web por capítulos sobre un grupo de amigos (Next.js estático, 18
capítulos, perfiles por persona, puerta con palabra de acceso). Lo que lo hace bueno es la mezcla de
números con relato: cada métrica trae el caso concreto, y los textos tienen el tono del grupo.

La idea es que cualquier dev que use un agente de IA (Claude Code, Codex o Cursor) pueda clonar un
repo, tirar adentro el export de su grupo de WhatsApp, pedirle al agente "armame el informe", contestar
un par de preguntas y en la misma tarde tener la web para mandarle a sus amigos. El chat de ese dev es la
fuente de datos y del tono; la estructura, las consultas y la UI son las que ya existen.

Por qué ahora: la parte difícil (parser, dataset, 18 capítulos de análisis, componentes de gráficos,
animación, puerta, deploy) ya está hecha y probada con exports reales. Lo que falta
es sacarle lo que era de ese informe privado y ponerle una capa que haga las preguntas.

## 2. Objetivos, no objetivos y anti-objetivos

Objetivos:

1. Camino feliz de cinco pasos documentado en un README con capturas: clonar, copiar el export, abrir
   el agente, pedir el informe, ver la web en local. Sexto paso opcional: deploy.
2. Funciona con exports de WhatsApp iOS y Android, en español y en inglés.
3. Dos modos de salida: una sola página (scroll largo, sin menú) y completo (capítulos con menú y
   perfiles por persona), elegidos por el dev con recomendación del agente.
4. Web bilingüe: toda etiqueta fija de la UI existe en español y en inglés; los textos editoriales los
   escribe el agente en el idioma del chat.
5. El capítulo de salidas (Departures) se generaliza a "el que se va y vuelve", con la persona elegida por el dev
   a propuesta del agente, y se apaga si en el grupo nadie lo hace.
6. Una sola skill, portable a Claude Code, Codex y Cursor, hace el trabajo editorial y orquesta los
   scripts.
7. Privacidad por defecto: el chat y todo lo derivado quedan fuera de git, `noindex` siempre, palabra de
   acceso opcional y recomendada, deploy desde la máquina del dev sin pasar por GitHub.
8. Un chat ficticio generado por script permite probar todo el flujo, correr los tests y sacar las
   capturas del tutorial sin exponer nada real.

No objetivos (fuera de alcance de esta versión):

- Cualquier capítulo nuevo.
- Chats individuales (1 a 1): el informe asume un grupo de tres o más personas.
- Otros idiomas de export o de UI además de español e inglés.
- Hosting propio o backend: el resultado es un export estático.
- Una UI para configurar sin agente. El dev que no usa agente puede editar los archivos de `content/`
  y `report.config.json` a mano, y el README lo menciona, pero no es el camino principal.

Anti-objetivos (lo que haría que esto sea un fracaso aunque "funcione"):

- Que el dev tenga que leer código para armar su informe. Si una pregunta de la skill no se entiende
  sin contexto, está mal hecha.
- Que un chat real termine en un repo público por accidente. Los defaults tienen que hacer eso
  difícil, no solo documentarlo.
- Que el informe genérico se sienta genérico: textos de relleno, capítulos vacíos con "nada que
  mostrar", apodos que nadie usa. Mejor un capítulo apagado que uno flojo.
- Romper el informe privado del que salió este. Ese repo no cambia ni pasa a depender de este.

## 3. Quién lo usa y qué vive

Un dev que ya usa un agente de IA en la terminal o en el editor. Sabe clonar, instalar dependencias y
correr un comando. No sabe nada de este proyecto ni quiere aprenderlo. Quiere divertirse con sus
amigos.

Camino feliz, tal como lo cuenta el README:

1. `git clone` y `pnpm install` en `web/`, `uv sync` en la raíz.
2. Exportar el chat desde WhatsApp ("Exportar chat", sin archivos) y copiar el `.txt` a `chats/`.
3. Abrir el agente en la raíz del repo.
4. Escribir "armame el informe de mi grupo" (o invocar la skill por nombre). El agente analiza, hace
   entre cinco y ocho preguntas, escribe los textos, arma los datos y corre el build.
5. `pnpm dev` y abrir `http://localhost:3000`. Ver el informe.
6. Opcional: `pnpm run deploy` (Vercel desde la máquina, sin git) y mandar el link al grupo con la palabra.

Los pasos de navegador tienen captura; los de terminal, bloque de código (§5). Las capturas salen del
chat ficticio.

## 4. Arquitectura

### 4.1 Layout del repo

```
whatsapp-group-report/
  README.md                      tutorial, inglés arriba y castellano abajo, mismo contenido
  LICENSE                        MIT
  AGENTS.md                      reglas del proyecto para cualquier agente
  CLAUDE.md                      una línea: `@AGENTS.md` (Claude Code importa el archivo)
  .agents/skills/whatsapp-group-report/SKILL.md   la skill (ruta que leen los tres agentes)
  .claude/skills/whatsapp-group-report            symlink a la anterior (Claude Code la lista)
  report.config.example.json     ejemplo comentado de la configuración
  report.config.json             la del dev (gitignored)
  chats/                         exports del dev (gitignored salvo .gitkeep)
  content/                       textos editoriales del dev (gitignored salvo content/example/)
  data/                          parquet y análisis intermedios (gitignored)
  pyproject.toml                 dependencias Python (uv), pytest
  scripts/
    wa/                          parser (iOS/Android, es/en), nombres, slugs, texto
    web/                         un módulo por capítulo de análisis (ya existen)
    build_dataset.py             export .txt -> data/messages.parquet
    analyze.py                   parquet -> data/analysis/*.json (resumen para la skill)
    build_web_data.py            parquet + content/ + config -> web/data/*.json
    synth_chat.py                genera chats ficticios (es/en, iOS/Android) con semilla
  tests/                         pytest sobre el chat ficticio
  web/                           Next.js estático (lo que hay hoy, con i18n y modos)
    i18n/es.ts, i18n/en.ts       todas las etiquetas fijas de la UI
    data/                        JSON generados (gitignored salvo web/data/example/)
  docs/
    screenshots/                 capturas del tutorial, generadas desde el chat ficticio
    design.md                    este documento, adaptado
```

### 4.2 Pipeline (determinístico, sin IA)

1. `build_dataset.py`: detecta formato y locale del export (iOS/Android, es/en), parsea, escribe
   `data/messages.parquet`. Mismo esquema de columnas que hoy. Los nombres canónicos salen de
   `content/people.json` si existe; si no, del nombre de contacto tal cual.
2. `analyze.py`: produce `data/analysis/summary.json` con lo que la skill necesita para preguntar
   bien: personas con cantidad de mensajes y primer/último mensaje, el remitente "Tú"/"You" si lo hay,
   nombres entre comillas en los contactos (apodos candidatos), locale detectado, tamaño del chat,
   entradas y salidas por persona (candidatos a "el que se va y vuelve"), si hay encuestas, los 30
   días pico con sus términos más frecuentes (candidatos a eventos), y una muestra de 300 mensajes
   estratificada por año (para que la skill capte el tono).
3. `build_web_data.py`: con el parquet, `report.config.json` y `content/`, genera `web/data/*.json`
   como hoy. Los capítulos que no tienen datos (sin encuestas, sin persona que se va) escriben un JSON
   vacío y la web los apaga.
4. `pnpm build` en `web/`: export estático a `web/out/`.

Todo corre con `uv run` y `pnpm`, nunca con el chat en el repo.

**Corpus de fondo (mi llamada).** Hoy el Diccionario y "frases que otros le repitieron" definen
"palabra del grupo" contrastando contra otro chat anterior. El dev genérico tiene un solo
export, así que el fondo pasa a ser la frecuencia general del idioma (`wordfreq`, es/en): una
palabra es del grupo si su frecuencia en el chat supera por mucho la del idioma. `report.config.json`
admite además `background: ["chats/otro.txt"]`, opcional, para quien tenga otro chat de los mismos
amigos y quiera el criterio de hoy. El chat ficticio incluye palabras inventadas para que el
Diccionario tenga con qué.

**Umbrales (mi llamada).** Los mínimos absolutos de hoy (5.000 mensajes para tener perfil, 500
respuestas para el premio de velocidad, 1.000 mensajes para rankings por mil, etc.) están calibrados
para un chat muy grande. Pasan a `scripts/web/thresholds.py`, derivados del tamaño del chat: cada
umbral es una fracción del total o de los mensajes de la persona, con un piso chico. Definiciones
fijas: *persona activa* = al menos 1 % de los mensajes del chat; *persona con perfil* = activa y con
al menos 200 mensajes. Los textos de criterio de la UI que citan un número lo reciben de `facts.json`,
nunca lo embeben. El chat ficticio se dimensiona para que cada umbral tenga casos de ambos lados.

### 4.3 Configuración: `report.config.json`

Un solo archivo, escrito por la skill a partir de las respuestas, editable a mano:

```json
{
  "title": "Los del Parque",
  "lang": "es",
  "mode": "full",
  "chat": "chats/_chat.txt",
  "me": "Ana",
  "departer": "Bruno",
  "gate": true,
  "verifiedOn": "2026-11-13"
}
```

- `lang`: el idioma en el que escribe el grupo, que es también el de la UI y el de los textos editoriales. El
  idioma del teléfono (los marcadores del export) se detecta por archivo y puede ser otro: la skill propone `lang`
  desde la muestra de mensajes, no desde los marcadores. La corrida de descubrimiento usa los marcadores como
  primera suposición.
- `mode`: `single` o `full`.
- `me`: nombre corto del dev; permite el "Tú" del export y las frases en primera persona del cierre.
- `departer`: nombre corto de la persona del capítulo de salidas, o `null` para apagarlo.
- `departerAliases` (opcional): cómo lo llama el chat (variantes y apodos) para las escenas y las frases
  atribuidas. Si falta, `build_pipeline` usa su apodo de `nicknames.json` y el primer nombre de su contacto.
- `gate`: si la web pide palabra. La palabra misma nunca está en este archivo: va en
  `web/.env.local` como `NEXT_PUBLIC_GATE_WORD`, y la escribe el dev a mano (ver 4.6).

### 4.4 Contenido editorial: `content/`

Lo que hoy está repartido entre `names.py`, los módulos con los eventos y las escenas del informe privado, `nicknames.json`, `badwords.txt`,
`conclusion.md` y partes de `copy.ts` pasa a archivos de datos que la skill escribe y el dev puede
tocar:

| Archivo | Qué es | Quién lo escribe |
|---|---|---|
| `content/people.json` | nombre de contacto crudo → nombre corto; remitentes de sistema | skill, confirmado por el dev |
| `content/nicknames.json` | nombre corto → apodo con el que el grupo lo llama | skill, confirmado por el dev |
| `content/events.json` | eventos: id, título, regex de términos, ventana, nota | skill (de los días pico del análisis) |
| `content/badwords.txt` | puteadas del grupo, una por línea | skill (lista base por idioma + las del chat) |
| `content/conclusion.md` | cierre firmado por el dev | skill, en el tono del grupo |

No hay `content/copy.json` (decidido en el plan 4): para cambiar una frase fija de la UI, la skill edita
`web/i18n/<lang>.ts` en el clon del dev.

Las frases cualitativas que hoy viven en `copy.ts` con el nombre del grupo (título de la puerta, logo,
`<title>`) salen de `title` del config. Lo que embebe números sigue viniendo de los datos.

### 4.5 La skill

Una carpeta `whatsapp-group-report/` con `SKILL.md` y una subcarpeta `references/` con el detalle de
cada paso. Formato Agent Skills (frontmatter `name` y `description`, cuerpo en Markdown). Vive en
`.agents/skills/`, que leen Codex y Cursor. Claude Code lee `.claude/skills/<nombre>/SKILL.md` y sigue un symlink,
así que `.claude/skills/whatsapp-group-report` es un symlink a la misma carpeta. No hay `.cursor/skills/`
(decidido en el plan 4): Cursor lee `.agents/skills/` de forma nativa y `.claude/skills/` por compatibilidad, así
que un tercer camino listaría la skill hasta tres veces. Las rutas se verificaron contra la documentación de los
tres el 2026-11-14; la tabla está en `AGENTS.md`.

Flujo que describe la skill:

1. Verificar el entorno: `uv`, `pnpm`, un `.txt` en `chats/`. Si falta algo, decir exactamente qué
   correr.
2. Correr la pasada de descubrimiento (`build_pipeline.py --until analyze`, que corre `build_dataset` y `analyze`).
   Leer `summary.json` y la muestra.
3. Preguntar, de a una pregunta por mensaje, solo lo que no se puede deducir:
   - Título del grupo (propone el nombre que aparece en el export).
   - Quién es el dev (propone "Tú"/"You" si existe; si no, la lista de personas).
   - Nombres cortos y apodos (propone una tabla armada desde los contactos y las comillas; el dev
     corrige en una respuesta).
   - Modo: una página o completo. Recomienda una página si el chat tiene menos de 20.000 mensajes o
     menos de 5 personas activas; completo en el resto.
   - Idioma (propone el idioma en que está escrita la muestra de mensajes, que puede no ser el del export).
   - Capítulo de salidas: propone la persona con más salidas y vueltas si tiene al menos 2; si nadie
     califica, no pregunta y lo apaga.
   - Palabra de acceso: sí o no. Si sí, le pide al dev que la escriba él en `web/.env.local` y no la
     diga en el chat.
   Las preguntas se pueden contestar todas juntas si el dev prefiere.
4. Escribir `report.config.json` y los archivos de `content/`. Los eventos salen de los días pico: la
   skill mira la muestra de cada día, les pone título reconocible y nota, y arma la regex. La
   conclusión y las notas se escriben en el tono del chat (vocabulario, humor, idioma), sin inventar
   hechos: todo lo que afirma tiene que estar en los datos.
5. Correr la corrida completa (`build_pipeline.py`, que termina en `build_web_data`), revisar con
   `check_report.py` los capítulos apagados y los puntos flojos, correr `pnpm build`.
6. Decirle al dev que corra `pnpm dev`, qué va a ver, y cómo pedir cambios ("cambiá el título del
   evento X", "a Tomi decile Tomate", "pasalo a inglés"). Dejar a alguien afuera del informe no está soportado en
   esta versión: la skill lo dice en vez de improvisar.
7. Si pide deploy, seguir `references/deploy.md`.

Reglas fijas de la skill: no leer ni citar mensajes fuera de lo que el análisis expone; no publicar
apellidos de los nombres de contacto; no escribir la palabra de acceso en ningún archivo versionado;
si un archivo de `content/` ya existe, no pisarlo sin preguntar.

### 4.6 La web

Lo que hay hoy, con cuatro cambios:

1. **i18n.** `content/copy.ts` se parte en `web/i18n/es.ts` y `web/i18n/en.ts` con la misma forma
   (un objeto `copy` con funciones donde hay números). Los slugs de capítulos y de bloques también
   viven ahí (`/censo/` en español, `/census/` en inglés). Un `copyFor(lang)` reemplaza el import
   directo. El test de `copy` corre para los dos idiomas.
2. **Modos.** `mode` del config decide en build: en `full`, las rutas de hoy (capítulos, `/p/[slug]/`,
   `/personas/`). En `single`, solo `/`, que renderiza en orden: portada, línea de tiempo del censo, la
   carrera, el mapa de calor, el grafo de parejas, muletillas, el emoji de cada uno, tres récords (mensaje
   más largo, día más movido, madrugada), premios y conclusión. Sin barra lateral ni pager, con un índice
   flotante de anclas. Los componentes son los mismos; cambia la composición.
3. **Capítulo de salidas.** El componente y el JSON actuales del capítulo de salidas pasan a `Departures` y `departures.json`, con
   el nombre de la persona desde los datos. Si `departer` es `null`, el capítulo no aparece en el menú
   ni en las rutas. Lo mismo para encuestas cuando `polls.json` viene vacío.
4. **Marca.** Título, logo de la nav, `<title>` y texto de la puerta vienen de `title` del config a
   través de `global.json`. No queda en `web/src` ninguna cadena de un grupo real ni de una persona real.

La puerta funciona como hoy: `NEXT_PUBLIC_GATE_WORD` en build, solo el hash llega al cliente, y el test
que verifica que la palabra no aparezca en el HTML se mantiene. Con `gate: false` la web se sirve
abierta y el README lo desaconseja para chats reales.

Paleta de personas: hoy son 8 colores y el resto gris. Mi llamada: escalar a 12 colores
distinguibles y gris a partir del 13.º, porque los grupos de amigos suelen tener entre 8 y 15 activos.

### 4.7 Análisis por idioma

"Funciona en inglés" incluye el análisis, no solo el parser y las etiquetas (mi llamada; sin esto
el capítulo Lenguaje sale roto y viola el anti-objetivo del informe genérico). Lo que hoy es
rioplatense se vuelve un recurso por idioma en `scripts/wa/lang/{es,en}.py`: stopwords, regex y
clases de risa (es: jaja/jsjs/jeje/jiji/xd; en: haha/lol/lmao/hehe/xd), listas de muletillas
genéricas, lista base de puteadas, nombres de día y de mes. El esquema de `laughs.mix` pasa a ser
una lista de clases con etiqueta, en vez de claves fijas, y `Laughs.tsx` las renderiza como vengan.
`Intl.NumberFormat` usa el locale del config (`es-AR` o `en-US`). Los tests de lenguaje corren con el
chat ficticio en los dos idiomas.

### 4.8 Parser

Hoy: iOS en español. Se suman tres variantes con detección automática por las primeras líneas:

| Formato | Cabecera | Marcadores |
|---|---|---|
| iOS es | `[d/m/yy, h:mm:ss a. m.] Nombre: cuerpo` | "imagen omitida", "audio omitido", "ENCUESTA:", "Se eliminó este mensaje." |
| iOS en | `[d/m/yy, h:mm:ss AM] Name: body` | "image omitted", "audio omitted", "POLL:", "This message was deleted." |
| Android es | `d/m/yy h:mm - Nombre: cuerpo` (sin corchetes, sin segundos) | "<Multimedia omitido>", "Se eliminó este mensaje" |
| Android en | `d/m/yy, h:mm - Name: body` | "<Media omitted>", "This message was deleted" |

Los mensajes de sistema (creó el grupo, añadió, salió, quitó, cambió el nombre) también cambian por
idioma y plataforma; el builder arma la tabla completa a partir de exports reales o de la
documentación y la deja en `scripts/wa/locales.py`. Android no distingue tipos de multimedia: esos
chats muestran "multimedia" como un solo tipo y el capítulo de audios se apaga.

Tres detalles que dependen de la plataforma y que el builder confirma con exports reales (ver 7):
las menciones (iOS envuelve el nombre en U+2068/U+2069; si Android las exporta como `@Nombre` plano,
el capítulo Menciones las detecta por nombre de contacto y, si no hay ninguna, se apaga), la falta de
segundos en Android (latencia y "respuesta más rápida" se calculan al minuto y la UI lo dice), y el
formato 24 h de iOS en teléfonos con esa configuración.

Orden de fecha (d/m vs m/d) se infiere del export: si algún valor supera 12 en una posición, esa es la
del día; si el chat no lo revela, se asume d/m. La skill no lo pregunta (decidido en el plan 4): no hay opción
para cambiarlo y un chat de más de doce días siempre lo revela; cuando `summary.locale.date_order` es
`"ambiguous"`, la skill le avisa al dev que las fechas se leen como día/mes.

### 4.9 Chat ficticio y tests

`synth_chat.py --lang es --platform ios --seed 7` genera un export de unas 8.000 líneas, dos años, 9
personas con nombres inventados y apodos entre comillas, con entradas y salidas (una persona que se
va y vuelve tres veces), encuestas, multimedia de todos los tipos, mensajes borrados y editados,
menciones, risas, puteadas suaves y tres "eventos" reconocibles (días pico con un tema). Las cuatro
combinaciones de lang y platform se generan desde la misma historia.

Tests:

- pytest: parser por formato, pipeline completo sobre el chat ficticio (cada JSON validado contra
  el esquema de `web/src/lib/schema.ts` exportado como JSON Schema), capítulos que se apagan cuando
  faltan datos, ningún apellido ni palabra de acceso en los JSON.
- vitest: lo que hay hoy, más i18n (ambos idiomas completos, misma forma), modo `single`, y la
  puerta.
- GitHub Actions: pytest, vitest, lint y `pnpm build` en modo `single` y `full` con el chat ficticio
  en español e inglés. No deploya nada: el repo público no guarda tokens de Vercel.

### 4.10 Deploy

Camino documentado: `pnpm run deploy` en `web/` corre `vercel pull --yes --environment=production`, `vercel build
--prod` y `vercel deploy --prebuilt --prod` (`pnpm deploy` a secas es un comando propio de pnpm, por eso va con
`run`). El pull va primero porque `vercel build` hornea `NEXT_PUBLIC_GATE_WORD` del entorno bajado a `web/.vercel`:
así una palabra rotada entra en el próximo deploy y el build no pregunta si bajar la configuración. Cambiar la
palabra: `vercel env rm NEXT_PUBLIC_GATE_WORD production`, `vercel env add NEXT_PUBLIC_GATE_WORD production --no-sensitive` y
`pnpm run deploy`.
Nada sale de la máquina del dev salvo el export estático; el repo en GitHub nunca ve el chat, el
config ni el contenido. Primera vez: `vercel login` y `vercel link` (crea el proyecto), y `vercel env
add NEXT_PUBLIC_GATE_WORD production`. El README muestra que la protección de Vercel debe quedar solo
en Preview.

Alternativa mencionada, no recomendada: fork privado con `content/` y `web/data/` commiteados y
deploy por git.

**Demo pública (mi llamada).** Las dos demos del chat ficticio (`whatsapp-group-report-es` y
`-en`, en `*.vercel.app`, sin puerta) las deploya el autor a mano desde su máquina con `uv run python -I
scripts/demo_deploy.py --lang es|en`, que genera el chat ficticio, corre el pipeline y, después de linkear
`web/.vercel` al proyecto de la demo, corre `vercel pull --yes --environment=production`, `vercel build --prod` y
`vercel deploy --prebuilt --prod`. Si `web/.vercel` apuntaba a otro proyecto, avisa antes de re-linkear (con
`vercel link` se vuelve al propio). `docs/development.md` dice que se regeneran con cada release.

## 5. README y tutorial

Un solo `README.md`, inglés primero y castellano después, mismo contenido en los dos. Secciones:

1. Qué es, con una captura del hero y una del mapa de calor del chat ficticio.
2. Demo pública: el informe del chat ficticio deployado en Vercel sin puerta, en español y en inglés
   (`whatsapp-group-report-es` y `-en`), para que se vea el resultado antes de clonar.
3. Los seis pasos del camino feliz. Los pasos de terminal van como bloques de código, no como capturas;
   las capturas son solo del navegador (no quedan viejas y no hace falta una herramienta de grabación).
4. Las preguntas que hace el agente, con un ejemplo de respuesta.
5. Qué se puede cambiar después y cómo pedirlo (frases de ejemplo para el agente, y qué archivo toca
   cada cosa para quien prefiera editar a mano).
6. Privacidad: qué queda fuera de git, por qué la palabra, por qué `noindex`, cómo deployar sin git.
7. Cómo funciona por dentro, en diez líneas, con link a `docs/design.md`.
8. Limitaciones conocidas (Android sin tipos de multimedia, solo grupos, solo es/en).

Las capturas se regeneran con un script (`web/scripts/screenshots.mjs`, con Playwright sobre el build
del chat ficticio; se corre con `cd web && pnpm screenshots`) para que no queden viejas. Vive en `web/` y no en
`scripts/` porque su dependencia (Playwright) está en `web/`.

Las notas para quien mantiene el repo (formatos, chat ficticio, tests, demo, puerta, CI, capturas) van en
`docs/development.md`, en inglés; el README queda como tutorial.

## 6. Decisiones tomadas

Del autor:

- Público objetivo: dev que usa IA, quiere integrarlo rápido y divertirse con amigos.
- Tutorial simple en un Markdown con ejemplos; descargar, ejecutar, responder preguntas, ver la UI.
- La IA escribe los textos de los capítulos.
- Skill, compatible con Claude Code, Codex y Cursor.
- Dos modos: una página y completo con menú.
- El capítulo de salidas (Departures) se generaliza a las salidas de cualquier miembro.
- Castellano e inglés.
- Nombre: `whatsapp-group-report` (sugerido por mí, aceptado).
- Modo de una página como se describe en 4.6 ("sí, perfecto").

Mías (vetables):

- Repo nuevo y separado, sin historia; el repo privado no cambia.
- Chat ficticio generado por script para tests, demo y capturas.
- Privacidad por defecto: gitignore de chat, config, content y data; `noindex`; deploy prebuilt sin git.
- Licencia MIT.
- Fuera de alcance: capítulos nuevos, chats 1 a 1.
- Paleta de 12 colores.
- Umbral de recomendación de modo: 20.000 mensajes o 5 personas activas.
- Slugs de capítulos localizados por idioma.
- Demo pública del chat ficticio en dos idiomas.
- Python con `uv` y `pyproject.toml`; web con `pnpm`.
- Corpus de fondo por frecuencia del idioma (`wordfreq`), con `background` opcional.
- Umbrales derivados del tamaño del chat; activa = 1 %, perfil = activa y 200 mensajes.
- El análisis también funciona en inglés (recursos por idioma), no solo el parser y la UI.
- Demo pública deployada a mano por el autor, sin tokens en el repo público.
- Criterio de aceptación de la migración: igualdad campo a campo con umbrales legacy.

## 7. Lo que queda al builder

- Tabla exacta de cabeceras y mensajes de sistema por plataforma e idioma (4.8). Decisión del autor
  (2026-11-13): no hay exports reales de muestra para iOS en inglés ni para Android; el builder arma
  esos tres formatos desde la documentación y ejemplos públicos, y el README los marca como "no
  verificado con un export real" con un pedido de muestras (issue abierto). El formato iOS en español
  sí está verificado con exports reales. Si el autor cambia el idioma de su teléfono y exporta un
  chat corto, iOS en inglés pasa a verificado sin tocar código.
- Diseño interno de `analyze.py` y la forma de `summary.json`, mientras exponga lo listado en 4.2.
- Cómo se parte `copy.ts` y cómo se tipa `copyFor(lang)`.
- Composición exacta del índice flotante del modo `single` y cómo se comporta en celular.
- Generador de chat ficticio: historia, nombres, distribución de mensajes.
- Script de capturas.
- Cómo exportar el esquema zod a JSON Schema para los tests de Python, o validar en vitest leyendo
  los JSON del chat ficticio.

## 8. Migración desde el informe privado

1. Copiar `scripts/`, `tests/`, `web/` al repo nuevo. No copiar exports, `data/`, `out/` ni contenido real.
2. Sacar lo que era del informe privado: los nombres canónicos y el remitente propio fijos en el código, los
   módulos con sus eventos y escenas, `nicknames.json`, `badwords.txt`, `conclusion.md` y sus cadenas en `web/src`
   y en los tests. Verificación: un grep de los nombres reales vacío en todo el repo.
3. Reemplazar por lectura de `report.config.json` y `content/`.
4. Correr el pipeline completo con el chat ficticio en los cuatro formatos y en los dos modos.
5. Correr el pipeline con el export real en local (sin commitear), con su chat de fondo como `background` en el
   config, y comparar `web/data/*.json` contra los JSON del informe privado. Criterio: igualdad campo a campo salvo
   `generatedAt`, `verifiedOn`, los campos renombrados de la persona de salidas a Departures (se comparan por su
   nuevo nombre) y lo que dependa de umbrales (se compara con los umbrales fijados a los valores de hoy mediante una
   opción `--thresholds legacy`). Así se comprueba que la generalización no rompió nada; un script
   `scripts/compare_data.py` la automatiza.
