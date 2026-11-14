"""Castellano rioplatense: los valores de siempre (antes en wa.text, web.language, web.awards, web.census,
web.mentions, build_web_data, profile y group_report), sin cambios."""
from __future__ import annotations

import re

from wa.lang import DeparturesPatterns, Labels, Lang

STOPWORDS = frozenset(
    """
a al algo alguien algun alguna algunas alguno algunos ante antes aquel aquella aquellas aquellos aqui asi aun aunque
bien cada casi como con contra cual cuales cuando cuanto cuanta cuantos de del desde donde dos el ella ellas ellos en
entre era eran eres es esa esas ese eso esos esta estaba estaban estamos estan estar estas este esto estoy estos fue
fueron fui ha habia haber hace hacen hacer hacia han hasta hay he hoy la las le les lo los mas me mi mia mias mis mio
mios mucho muchos muy nada ni no nos nosotros nuestra nuestras nuestro nuestros o os otra otras otro otros para pero
poco por porque que quien quienes se sea ser si sido siempre sin sobre solo son soy su sus tal tambien tampoco tan
tanto te tendra tener tengo ti tiene tienen toda todas todo todos tu tus tuvo un una unas uno unos usted vos y ya yo
le les va van voy vas vamos van ahi alla aca ahora bueno che dale eh igual ja jaja jajaja ok re sí si asi así está
están esta estás estoy ser tenés tenes sos pa q x d k xq tmb tb eso esto ese esa pues entonces nomas nomás nada
después despues antes luego mientras tipo onda posta mal bien jaj jajaj jajajaj jajajajaj
""".split()
)

LAUGH_RE = re.compile(r"^(j+a+)+j*$|^(a*j+a+)+$|^(j+e+)+j*$|^(j+i+)+j*$|^x+d+$|^lol$", re.IGNORECASE)
LAUGH_KINDS = (
    ("jaja", "jaja", re.compile(r"^(j+a+)+j*$")),
    ("jsjs", "jsjs", re.compile(r"^(j+s+)+j*$")),
    ("jeje", "jeje", re.compile(r"^(j+e+)+j*$")),
    ("jiji", "jiji", re.compile(r"^(j+i+)+j*$")),
    ("xd", "xd", re.compile(r"^x+d+$")),
)

EDGE = frozenset({"el", "la", "los", "las", "un", "una", "de", "del", "a", "en", "con", "por", "para", "y", "o", "que"})
# "al" es a + el: tampoco abre ni cierra una frase. "lo" no la abre ("por lo general", "todo lo opuesto").
# Excepción: "que" abre frases de dos palabras, las exclamativas ("que bronca", "que piola"), y solo se cuentan
# cuando abren el mensaje (si no, casi siempre es "tengo que buscar").
START_BLOCK = EDGE | {"al", "lo"}
# Una frase tampoco termina en pronombre átono, posesivo, cuantificador o conjunción, ni en el "no" de pregunta
# ("mabel no?"): son fragmentos de algo más largo. Sí pueden empezar con ellos ("te amo", "no amigo").
END_BLOCK = START_BLOCK | {
    "le", "les", "me", "te", "se", "nos", "mi", "tu", "su", "mis", "tus", "sus", "no",
    "muy", "mas", "tan", "pero", "porque", "es",
}
# "q" es "que" abreviado: se normaliza antes de contar, así "q bronca" y "qué bronca" son la misma frase.
ABBREVIATIONS = {"q": "que"}
# Tokens de una letra que son palabras; cualquier otro ("1", "d", "u" de u$d) es basura de listas o abreviaturas.
ONE_CHAR_OK = frozenset({"a", "o", "y"})
# Reduplicaciones de relleno: "si si si", "ya ya", "eh eh" no son muletilla de nadie ("dale dale" sí).
FILLER_REDUP = frozenset({"si", "no", "ya", "eh", "ah", "che", "nada"})
# Frases que cualquiera dice: nunca son muletilla de nadie. Normalizadas (minúscula, sin acentos).
GENERIC = frozenset({
    "no se", "que haces", "jaja si", "si si", "no no", "que onda", "dale si", "ah ok", "jaja no", "y si",
    # Agregadas tras mirar los datos reales (noviembre 2026): muletillas de cualquiera, no de una persona.
    "que hora", "que paso", "que pasa", "nose si", "osea si", "ah si", "ah bien", "ah eso",
    "si viste", "claro eso", "claro pero", "pero aparte", "tal vez", "si fuese", "es cierto", "es mentira",
    "es un monton", "esta buena", "no parece", "tan dificil", "buenos dias", "dos años", "mil dolares",
    "ser humano", "unas ganas", "mi opinion", "mi vieja", "mi madre", "tu mama", "mi hermano", "te haces",
    "me chupa", "les da", "me rei", "me confundi", "me pidio", "me aparecio", "yo pensaba", "queres venir",
    "vos mismo", "ya debe estar", "tengo que buscar", "tengo que llevar", "mas sano",
    # Revisión 1: insultos y exclamaciones de todo el grupo.
    "puta madre", "dios mio", "hijo de puta", "la concha", "que hs",
})

# Puteadas genéricas (normalizadas como norm_words: minúscula, sin tildes); content/badwords.txt las extiende.
BADWORDS_BASE = frozenset({
    "boludo", "boluda", "boludos", "boludas", "boludez", "pelotudo", "pelotuda", "pelotudos", "pelotudas",
    "pelotudez", "forro", "forra", "forros", "forras", "hijo de puta", "hija de puta", "hijos de puta", "hdp",
    "la concha", "concha de tu madre", "la puta que te pario", "ctm", "carajo", "mierda", "puta", "puto",
    "puta madre", "cagar", "cagada", "cagon", "sorete", "gil", "gila", "pajero", "tarado", "tarada", "idiota",
    "imbecil", "estupido", "estupida", "choto", "chota", "pija", "verga", "culo", "orto", "conchudo", "conchuda",
    "garca", "otario",
})

DOW = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
MONTHS = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
          "noviembre", "diciembre")


def fmt_int(n: int) -> str:
    return f"{n:,}".replace(",", ".")  # 2.300


def awards(th) -> list[tuple[str, str, str, str | tuple[str, str]]]:
    """(id, título, criterio, unidad) de cada premio; la unidad es un texto o, si es un conteo, (singular, plural); el criterio del más rápido cita el mínimo real de th."""
    return [
        ("msgs", "Más mensajes", "El que más mensajes mandó en todo el chat.", ("mensaje", "mensajes")),
        ("stickers", "Más stickers", "El que más stickers mandó.", ("sticker", "stickers")),
        ("audios", "Más audios", "El que más audios mandó.", ("audio", "audios")),
        ("badwords", "El más puteador", "Más puteadas cada mil mensajes.", "por mil"),
        ("early", "El madrugador", "Mayor porcentaje de sus mensajes entre las 6 y las 9 de la mañana.", "%"),
        ("owl", "El búho", "Mayor porcentaje de sus mensajes entre la medianoche y las 6.", "%"),
        ("mentioned", "El más mencionado", "Al que más veces etiquetaron con @.", ("mención", "menciones")),
        ("fastest", "El más rápido",
         f"La mediana más baja al responder, entre los que respondieron al menos {th.fastest_min_replies} veces.", "s"),
        ("edited", "El más editado", "Más mensajes editados cada mil.", "por mil"),
        ("deleted", "El que más borra", "Más mensajes borrados cada mil.", "por mil"),
        ("muletilla", "La muletilla del año",
         "La frase con mayor razón propio/resto en el último año del chat.", "x"),
        ("starters", "El que más arranca", "Más veces que mandó el primer mensaje después de 3 horas de silencio.",
         ("vez", "veces")),
    ]


# Disparadores de "escena": otros hablando del miembro celoso/enojado, y quejas de exclusión del miembro.
ACCUSE_RE = r"celos|celoso|escena|se enoj|enojado|ofendid|drama"
COMPLAIN_RE = (
    r"no me invit|sin m[ií]\b|me dejaron afuera|no me avis|me excluy|a m[ií] no me|me entero por|"
    r"nadie me|traidor|falsos|hip[óo]crit|no me quieren|me olvidaron|no me llam|siempre lo mismo|me usan"
)
# {names} = alternancia de los alias del miembro (group_report._alias_re)
QUOTE_TEMPLATES = (
    r'(?i)(?:{names})\s*(?:en corto)?\s*[:=\-–]\s*[“"](.{{6,160}}?)[”"]',
    r'(?i)[“"](.{{6,160}}?)[”"]\s*(?:dice|dijo|diría|decía)\s+(?:el\s+)?(?:{names})',
    r'(?i)(?:el\s+)?(?:{names})\s+(?:dice|dijo|diría|decía)\s*:?\s*[“"](.{{6,160}}?)[”"]',
)

LANG = Lang(
    code="es",
    word_re=re.compile(r"[a-záéíóúüñ]+", re.IGNORECASE),
    word_chars="a-z0-9ñ",
    stopwords=STOPWORDS,
    laugh_re=LAUGH_RE,
    laugh_kinds=LAUGH_KINDS,
    laugh_emoji=("😂", "🤣"),
    laugh_unit=re.compile(r"j+a+"),
    laugh_hint="[jJxX]",
    filler_redup=FILLER_REDUP,
    generic_phrases=GENERIC,
    edge=EDGE,
    start_block=START_BLOCK,
    end_block=END_BLOCK,
    abbreviations=ABBREVIATIONS,
    one_char_ok=ONE_CHAR_OK,
    exclamative="que",
    badwords_base=BADWORDS_BASE,
    dow=DOW,
    months=MONTHS,
    labels=Labels(
        rest="Resto",
        unknown_mention="@alguien",
        unnamed_rename="(sin nombre)",
        new_photo="Nueva foto",
        msgs=lambda n: f"{fmt_int(n)} mensajes",
        returns=lambda n: f"{fmt_int(n)} vueltas",
        awards=awards,
        fmt_int=fmt_int,
    ),
    departures=DeparturesPatterns(
        accuse=ACCUSE_RE,
        complain=COMPLAIN_RE,
        quote_templates=QUOTE_TEMPLATES,
        complaint_chip=(r"no me invit", 'veces escribió "No me invitó"'),
    ),
)
