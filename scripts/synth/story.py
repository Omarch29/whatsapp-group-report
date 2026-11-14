"""La historia del chat ficticio: `build(seed, lang, lines) -> Story`, una lista de `Event` en orden de hora.

Dos pasadas con dos generadores:

1. Estructura, con `random.Random(seed)` solo: horas, remitentes, tipos (`kind`), roles y cupos. No depende del
   idioma: la misma semilla da la misma estructura en castellano y en inglés.
2. Palabras, con `random.Random(f"{seed}:{lang}")`: cada evento toma su texto del vocabulario del idioma
   (synth.vocab_es / synth.vocab_en) según su rol, tema e índices.

La línea de tiempo son dos años que terminan el 2026-11-01. Lo que está guionado (creación del grupo, altas, dos
cambios de nombre y uno de foto, seis encuestas, las tres salidas de Bruno con sus escenas y vueltas, sus tres frases
célebres, los 40 días de silencio de Juli) se fija primero; el resto son conversaciones en ráfagas repartidas por día (más los días de semana y a la
noche, tres días pico con tema) hasta llegar a `lines` líneas exactas. Después se reparten los cupos: lore,
muletillas, citas de Bruno, puteadas, menciones, recuerdos de los eventos, borrados y editados.

`kind`: text | edited | deleted | poll | media:<tipo> | system:<evento> (eventos de wa/locales.py).
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter, deque
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from random import Random

from synth import cast
from synth.cast import BY_SHORT, DEPARTER, EVENTS, GROUP_NAMES, ME, MEDIA_TYPES, PEOPLE, TITLE, TOPICS
from wa.background import word_is_common
from wa.lang import get_lang

START = datetime(2024, 11, 1)
END = datetime(2026, 11, 1, 23, 59, 59)
DAYS = (END.date() - START.date()).days + 1

EVENT_DAYS = {"asado": date(2025, 4, 26), "cumple": date(2025, 12, 13), "mundial": date(2026, 7, 19)}
EVENT_HOURS = {"asado": (11, 17), "cumple": (14, 20), "mundial": (12, 18)}
EXIT_MONTHS = (4, 11, 19)  # meses desde el inicio en que Bruno se va
RETURN_HOW = ("joined_link", "added", "joined_link")  # la segunda vuelta lo añade Ana
POLL_DAYS = (date(2024, 11, 13), date(2025, 4, 21), date(2025, 8, 15), date(2025, 12, 6), date(2026, 6, 10),
             date(2026, 9, 20))
POLL_BY = ("Tomi", "Ana", "Juli", "Ana", "Lucas", "Flor")
POLL_VOTES = ((5, 1, 2), (2, 1, 0, 4), (2, 3, 1), (4, 2, 2, 1), (3, 3, 1), (2, 3, 1))  # la cuarta: 9 votos
QUOTE_DAYS = (date(2024, 11, 22), date(2024, 12, 17), date(2025, 1, 29))
SILENCE = ("Juli", 14, 40)  # (quién, mes desde el inicio, días): sigue en el grupo pero no escribe (census.absence)

# Cupos (fracción de los mensajes); los mínimos aseguran que el fixture chico tenga al menos uno de cada cosa.
LORE_RATE = 0.06  # repartido entre las 12 palabras
CATCH_RATE = 0.036  # repartido entre las 18 muletillas
CATCH_OTHERS = 0.08  # fracción extra de cada muletilla dicha por otra persona
QUOTE_RATE = 0.003  # por frase de Bruno
BAD_RATE = 0.011
MENTION_RATE = 0.03
MEMORY_RATE = 0.0016  # por evento
DELETED_RATE = 0.02
EDITED_RATE = 0.01
LINES_PER_MSG = 1.02  # listas de varias líneas
PEAK = 6.0  # mensajes de un día pico / promedio diario
NOISE_CAP = 2.2  # tope del ruido diario: ningún día común se acerca a un pico

ROLE_WEIGHTS = (("say", 0.36), ("react", 0.2), ("ask", 0.1), ("laugh", 0.12), ("joke", 0.03), ("agree", 0.05),
                ("disagree", 0.03), ("open", 0.04), ("list", 0.008))
LIST_TOPICS = ("plans", "travel", "food", "asado", "cumple")
QUOTA_ROLES = frozenset({"say", "react", "answer", "agree", "disagree", "open"})
MENTION_ROLES = frozenset({"open", "say", "ask", "answer"})
MORNING_CATCH = {(cast.EARLY_BIRD, 0)}  # muletillas de saludo matinal (cast.CATCH en el vocabulario)
STYLE_ROLES = frozenset({"open", "say", "ask", "answer", "react", "agree", "disagree", "morning", "night", "joke",
                         "poll_react", "welcome", "scene_reply", "welcome_back", "memory"})


@dataclass
class Event:
    ts: datetime
    kind: str
    sender: str  # nombre corto; "" en los avisos del sistema
    body: str = ""
    role: str = ""
    topic: str = ""
    tag: dict = field(default_factory=dict)  # índices y extras: who/by/name/old, votes, mention, emoji, lore...
    seq: int = 0
    scripted: bool = False

    @property
    def lines(self) -> int:
        if self.kind == "poll":
            return 2 + len(self.tag["votes"])
        if self.role == "list":
            return 1 + self.tag["items"]
        return 1


@dataclass
class Story:
    seed: int
    lang: str
    target_lines: int
    title: str
    people: tuple[cast.Person, ...]
    events: list[Event]
    event_days: dict[str, date]
    badwords_used: tuple[str, ...]

    @property
    def lines(self) -> int:
        return sum(e.lines for e in self.events)


def _month_day(months: int, day: int) -> date:
    y, m = divmod(START.month - 1 + months, 12)
    return date(START.year + y, m + 1, day)


def _at(d: date, hour: int, minute: int = 0, second: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day) + timedelta(hours=hour, minutes=minute, seconds=second)


class _Plan:
    """La estructura (pasada 1). Todo el azar sale de self.rs."""

    def __init__(self, seed: int, lines: int):
        self.rs = Random(seed)
        self.target = lines
        self.events: list[Event] = []
        self.seq = 0
        self.member: dict[str, list[list[datetime]]] = {p.short: [] for p in PEOPLE}
        self.blocked: list[tuple[datetime, datetime]] = []
        self.quote_ts: list[datetime] = []
        self.docs: Counter = Counter({p.short: 3 * k for k, p in enumerate(PEOPLE)})  # nombre de archivo en rueda
        quiet, months, days = SILENCE
        start = datetime.combine(_month_day(months, 3), datetime.min.time())
        self.silence = (quiet, start, start + timedelta(days=days))

    # ------------------------------------------------------------ helpers
    def add(self, ts: datetime, kind: str, sender: str, role: str = "", topic: str = "", scripted: bool = False,
            **tag) -> Event:
        self.seq += 1
        e = Event(ts, kind, sender, role=role, topic=topic, tag=tag, seq=self.seq, scripted=scripted)
        self.events.append(e)
        return e

    def sys(self, ts: datetime, event: str, **tag) -> Event:
        return self.add(ts, f"system:{event}", "", scripted=True, **tag)

    def say(self, ts: datetime, sender: str, role: str, **tag) -> Event:
        return self.add(ts, "text", sender, role=role, scripted=True, **tag)

    def join(self, who: str, ts: datetime) -> None:
        self.member[who].append([ts, END + timedelta(days=1)])

    def leave(self, who: str, ts: datetime) -> None:
        self.member[who][-1][1] = ts

    def present(self, who: str, ts: datetime) -> bool:
        return any(a <= ts < b for a, b in self.member[who])

    def speaks(self, who: str, ts: datetime) -> bool:
        """Está en el grupo y no en su silencio (SILENCE)."""
        quiet, a, b = self.silence
        return self.present(who, ts) and not (who == quiet and a <= ts < b)

    def others(self, ts: datetime, *exclude: str) -> list[str]:
        return [p.short for p in PEOPLE if p.short not in exclude and self.speaks(p.short, ts)]

    def gap(self) -> int:
        if self.rs.random() < 0.05:
            return self.rs.randint(600, 2400)
        return int(min(900, max(3, self.rs.lognormvariate(math.log(35), 0.9))))

    # ------------------------------------------------------------ guion
    def scripted(self) -> None:
        rs = self.rs
        t0 = _at(START.date(), 20, 14, 3)
        for p in ("Tomi", "Bruno", "Ana", "Lucas", "Caro", "Dani"):  # Bruno es fundador: no hay aviso de su alta
            self.join(p, t0)
        self.sys(t0, "encryption")
        self.sys(t0, "created", by="Tomi", name=GROUP_NAMES[0])
        t = t0 + timedelta(seconds=2)
        for who in ("Ana", "Lucas", "Caro", "Dani"):
            self.sys(t, "added", by="Tomi", who=who)
            t += timedelta(seconds=rs.randint(3, 9))
        for i, who in enumerate(("Tomi", "Caro", "Bruno", "Lucas")):
            t += timedelta(seconds=rs.randint(20, 90))
            self.say(t, who, "welcome", i=i)
        flor = t0 + timedelta(minutes=17, seconds=rs.randint(0, 59))
        self.sys(flor, "joined_link", who="Flor")
        self.join("Flor", flor)
        self.blocked.append((t0 - timedelta(minutes=1), flor + timedelta(minutes=5)))
        nico = _at(START.date() + timedelta(days=1), 10, 5, rs.randint(0, 59))
        self.sys(nico, "added", by="Tomi", who="Nico")
        self.join("Nico", nico)
        juli = _at(START.date() + timedelta(days=2), 18, 40, rs.randint(0, 59))
        self.sys(juli, "added", by="Caro", who="Juli")
        self.join("Juli", juli)

        r1 = _at(date(2025, 1, 18), rs.randint(19, 22), rs.randint(0, 59), rs.randint(0, 59))
        self.sys(r1, "name_changed", by="Tomi", name=GROUP_NAMES[1], old=GROUP_NAMES[0])
        r2 = _at(date(2025, 7, 5), rs.randint(18, 21), rs.randint(0, 59), rs.randint(0, 59))
        self.sys(r2, "name_changed", by="Caro", name=GROUP_NAMES[2], old=GROUP_NAMES[1])
        self.sys(r2 + timedelta(seconds=rs.randint(40, 120)), "photo_changed", by="Caro")

        self._exits()
        for i, (d, by, votes) in enumerate(zip(POLL_DAYS, POLL_BY, POLL_VOTES, strict=True)):
            t = _at(d, rs.randint(18, 21), rs.randint(0, 59), rs.randint(0, 59))
            self.add(t, "poll", by, role="poll", scripted=True, poll=i, votes=votes)
            for who in rs.sample(self.others(t, by), rs.randint(1, 2)):
                t += timedelta(seconds=rs.randint(30, 400))
                self.say(t, who, "poll_react", i=rs.randrange(5))
        for i, d in enumerate(QUOTE_DAYS):
            t = _at(d, rs.randint(19, 22), rs.randint(0, 59), rs.randint(0, 59))
            self.say(t, DEPARTER, "quote", quote=i)
            self.quote_ts.append(t)
            reply = rs.choice(self.others(t, DEPARTER))
            self.say(t + timedelta(seconds=rs.randint(20, 120)), reply, "laugh", slot=_laugh_slot(rs, reply))

    def _exits(self) -> None:
        rs = self.rs
        for i, months in enumerate(EXIT_MONTHS):
            d = _month_day(months, rs.randint(15, 22) if i == 2 else rs.randint(6, 24))
            t = _at(d, rs.randint(20, 21), rs.randint(0, 59), rs.randint(0, 59))
            start = t
            poster = rs.choice(["Tomi", "Caro", "Flor"])
            self.add(t, "media:image", poster, scripted=True)  # la foto del plan sin él
            others = self.others(t, DEPARTER)
            n_complain, n_accuse = rs.randint(2, 4), rs.randint(1, 2)
            t += timedelta(seconds=rs.randint(60, 300))
            self.say(t, DEPARTER, "complain_exit", exit=i)
            complaints = rs.sample(range(6), n_complain - 1)
            accusations = rs.sample(range(6), n_accuse)
            replies = rs.sample(range(5), 2)
            rest = ["complain"] * (n_complain - 1) + ["accuse"] * n_accuse
            rs.shuffle(rest)
            for step in ["reply", *rest]:
                t += timedelta(seconds=rs.randint(20, 150))
                if step == "complain":
                    self.say(t, DEPARTER, "complain", i=complaints.pop())
                elif step == "accuse":
                    self.say(t, rs.choice(others), "accuse", i=accusations.pop())
                else:
                    self.say(t, rs.choice(others), "scene_reply", i=replies.pop())
            t += timedelta(seconds=rs.randint(60, 600))
            self.sys(t, "left", who=DEPARTER)
            self.leave(DEPARTER, t)
            self.blocked.append((start - timedelta(minutes=40), t + timedelta(minutes=30)))

            hours = (rs.randint(26, 70), 1, rs.randint(48, 96))[i]  # Ana lo vuelve a añadir esa misma noche
            back = t + timedelta(hours=hours, minutes=rs.randint(0, 30))
            if back.hour < 9:
                back = back.replace(hour=rs.randint(10, 13))
            if RETURN_HOW[i] == "added":
                self.sys(back, "added", by=ME, who=DEPARTER)
            else:
                self.sys(back, "joined_link", who=DEPARTER)
            self.join(DEPARTER, back)
            tb = back + timedelta(seconds=rs.randint(40, 240))
            self.say(tb, DEPARTER, "back", i=i)
            for k in rs.sample(range(4), rs.randint(1, 2)):
                tb += timedelta(seconds=rs.randint(20, 120))
                self.say(tb, rs.choice(self.others(tb, DEPARTER)), "welcome_back", i=k)
            self.blocked.append((back - timedelta(minutes=10), tb + timedelta(minutes=20)))

    # ------------------------------------------------------------ conversaciones
    def filler(self) -> None:
        rs = self.rs
        fixed = sum(e.lines for e in self.events)
        m = max(30, round((self.target - fixed) / LINES_PER_MSG))
        peaks = {ev: max(8, round(PEAK * m / DAYS * rs.uniform(0.9, 1.25))) for ev in EVENTS}
        days = [START.date() + timedelta(days=k) for k in range(DAYS)]
        themed = {d: ev for ev, d in EVENT_DAYS.items()}
        near = {}
        for ev, d in EVENT_DAYS.items():
            for k, f in ((-2, 1.4), (-1, 1.8), (1, 1.4)):
                near[d + timedelta(days=k)] = (ev, f)
        exit_days = {start.date() for start, _ in self.blocked}
        dow = (1.0, 1.05, 1.1, 1.15, 1.25, 0.85, 0.75)
        weights, plain = [], []
        for d in days:
            if d in themed:
                continue
            season = 1 + 0.25 * math.sin(2 * math.pi * (d.timetuple().tm_yday - 30) / 365)
            w = dow[d.weekday()] * season * min(NOISE_CAP, rs.gammavariate(1.4, 1 / 1.4))
            if (d - START.date()).days < 30:
                w *= 1.5
            w *= near.get(d, (None, 1.0))[1] * (1.5 if d in exit_days else 1.0)
            weights.append(w)
            plain.append(d)
        counts = Counter(rs.choices(range(len(plain)), weights, k=max(0, m - sum(peaks.values()))))
        per_day = {plain[k]: n for k, n in counts.items()}
        for d in days:
            if d in themed:
                self._day(d, peaks[themed[d]], themed[d], 0.85)
            elif per_day.get(d):
                ev = near.get(d, (None, 0))[0]
                self._day(d, per_day[d], ev, 0.5 if ev else 0.0)
        self.events = [e for e in self.events if e.scripted or not self._blocked(e.ts)]

    def _blocked(self, ts: datetime) -> bool:
        return any(a <= ts <= b for a, b in self.blocked)

    def _day(self, d: date, n: int, theme: str | None, theme_p: float) -> None:
        rs = self.rs
        if theme and d == EVENT_DAYS.get(theme):
            n_bursts = max(2, n // 12)
        else:
            n_bursts = max(1, min(n, round(n / rs.uniform(5, 12))))
        cuts = sorted(rs.sample(range(1, n), n_bursts - 1)) if n_bursts > 1 else []
        sizes = [b - a for a, b in zip([0, *cuts], [*cuts, n], strict=True)]
        plans = []
        for size in sizes:
            kind, r = "normal", rs.random()
            if theme and d == EVENT_DAYS.get(theme):
                lo, hi = EVENT_HOURS[theme]
                hour = rs.randint(lo, hi)
            elif r < 0.07:
                kind, hour = "early", rs.randint(6, 8)
            elif r < 0.13:
                kind, hour = "night", rs.randint(0, 2)
            else:
                hour = rs.choices(range(9, 24), [1.0] * 10 + [1.6, 1.8, 1.9, 1.7, 1.0])[0]
            topic = theme if theme and rs.random() < theme_p else rs.choice(TOPICS)
            plans.append((hour, rs.randint(0, 59), rs.randint(0, 59), size, kind, topic))
        plans.sort()
        t_end = None
        for hour, minute, second, size, kind, topic in plans:
            t = _at(d, hour, minute, second)
            if t_end is not None and t < t_end + timedelta(minutes=10):
                t = t_end + timedelta(minutes=rs.randint(10, 50))
            t_end = self._burst(t, size, kind, topic)

    def _pick(self, ts: datetime, last: str | None, kind: str | None, exclude: str | None = None) -> str | None:
        rs = self.rs
        if kind == "early" and self.present(cast.EARLY_BIRD, ts) and rs.random() < 0.8:
            return cast.EARLY_BIRD
        if kind == "night" and self.present(cast.NIGHT_OWL, ts) and rs.random() < 0.8:
            return cast.NIGHT_OWL
        cands = [p for p in PEOPLE if self.speaks(p.short, ts) and p.short != exclude]
        if not cands:
            return None
        w = [p.activity * p.hours[ts.hour] * (0.25 if p.short == last else 1.0) + 1e-6 for p in cands]
        return rs.choices(cands, w)[0].short

    def _burst(self, t: datetime, n: int, kind: str, topic: str) -> datetime:
        rs = self.rs
        last, pending, i, step = None, False, 0, 0
        event_day = topic in EVENTS and t.date() == EVENT_DAYS[topic]
        while i < n:
            sender = self._pick(t, last, kind if i == 0 else None, exclude=last if pending else None)
            if sender is None:
                break
            p = BY_SHORT[sender]
            if i:  # lo que tarda en responder depende de quién responde (cast.Person.reply)
                t += timedelta(seconds=max(1, round(step * p.reply)))
            if i == 0:
                role = {"early": "morning", "night": "night"}.get(kind, "open")
            elif pending:
                role = "answer"
            else:
                role = rs.choices([r for r, _ in ROLE_WEIGHTS], [w for _, w in ROLE_WEIGHTS])[0]
                if role == "list" and topic not in LIST_TOPICS:
                    role = "say"
            if i and topic not in EVENTS and role in ("open", "say") and rs.random() < 0.04:
                topic = rs.choice(TOPICS)
            media_rate = p.media_rate * (1.6 if event_day else 1.0)
            if role not in ("answer", "morning", "night", "joke") and rs.random() < media_rate:
                self._media(t, sender)
            elif role == "joke":
                self.add(t, "text", sender, role="joke", topic=topic)
                laughers = self.others(t, sender)
                for who in rs.sample(laughers, min(len(laughers), rs.randint(2, 4))):
                    t += timedelta(seconds=rs.randint(4, 40))
                    self._laugh(t, who)
                    i += 1
            elif role == "laugh":
                self._laugh(t, sender)
            elif role == "list":
                self.add(t, "text", sender, role="list", topic=topic, items=rs.randint(2, 4))
            else:
                e = self.add(t, "text", sender, role=role, topic=topic)
                if rs.random() < p.emoji_rate:
                    e.tag["emoji"] = p.emoji
                elif rs.random() < 0.03:
                    e.tag["emoji"] = rs.choice(cast.GENERAL_EMOJI)
            pending = role == "ask"
            last = sender
            step = self.gap()
            i += 1
        return t + timedelta(seconds=step)

    def _laugh(self, t: datetime, who: str) -> Event:
        return self.add(t, "text", who, role="laugh", slot=_laugh_slot(self.rs, who), tail=self.rs.random() < 0.3)

    def _media(self, t: datetime, who: str, mtype: str | None = None) -> Event:
        rs = self.rs
        p = BY_SHORT[who]
        if mtype is None:
            types = list(p.media)
            mtype = rs.choices(types, [p.media[k] for k in types])[0]
        tag = {}
        if mtype == "location":
            tag["coords"] = (round(-34.58 - rs.random() * 0.08, 6), round(-58.36 - rs.random() * 0.12, 6))
        elif mtype == "document":
            # en rueda por persona: ningún nombre de archivo se repite tanto como para ser la muletilla de nadie
            tag["doc"] = self.docs[who] % cast.N_DOCS
            self.docs[who] += 1
        return self.add(t, f"media:{mtype}", who, **tag)

    # ------------------------------------------------------------ largo exacto
    def fit(self) -> None:
        rs = self.rs
        total = sum(e.lines for e in self.events)
        if total > self.target:
            singles = [k for k, e in enumerate(self.events) if not e.scripted and e.lines == 1]
            drop = set(rs.sample(singles, min(len(singles), total - self.target)))
            self.events = [e for k, e in enumerate(self.events) if k not in drop]
            total = sum(e.lines for e in self.events)
        filler = [e for e in self.events if not e.scripted and e.kind == "text"]
        tries = 0
        while total < self.target and filler and tries < 50 * self.target:
            tries += 1
            base = rs.choice(filler)
            t = base.ts + timedelta(seconds=rs.randint(3, 50))
            who = self.others(t, base.sender)
            if not who or self._blocked(t):
                continue
            self.add(t, "text", rs.choice(who), role="react", topic=base.topic)
            total += 1

    # ------------------------------------------------------------ cupos
    def quotas(self) -> None:
        rs = self.rs
        self.events.sort(key=lambda e: (e.ts, e.seq))
        n = len(self.events)
        pool = [e for e in self.events if not e.scripted and e.kind == "text" and e.role in QUOTA_ROLES]
        used: set[int] = set()

        def take(pred, k: int) -> list[Event]:
            cands = [e for e in pool if e.seq not in used and pred(e)]
            chosen = rs.sample(cands, min(k, len(cands)))
            used.update(e.seq for e in chosen)
            return chosen

        for j in range(cast.N_LORE):
            q = max(1, round(n * LORE_RATE / cast.N_LORE))
            owners = cast.lore_owners(j)
            n_other = max(1, round(q * 0.15)) if q >= 5 else 0
            per_owner = [(q - n_other) // len(owners) + (1 if k < (q - n_other) % len(owners) else 0)
                         for k in range(len(owners))]
            for owner, k in zip(owners, per_owner, strict=True):
                for e in take(lambda e, o=owner: e.sender == o, k):
                    e.role, e.tag["lore"] = "lore", j
            for e in take(lambda e, o=owners: e.sender not in o, n_other):
                e.role, e.tag["lore"] = "lore", j
        for p in PEOPLE:
            for k in range(2):
                q = max(1, round(n * CATCH_RATE / (2 * len(PEOPLE))))
                morning = (p.short, k) in MORNING_CATCH  # "buen día familia": solo antes del mediodía
                for e in take(lambda e, s=p.short, m=morning: e.sender == s and (not m or e.ts.hour < 12), q):
                    e.role, e.tag["catch"] = "catch", (p.short, k)
                for e in take(lambda e, s=p.short, m=morning: e.sender not in (s, DEPARTER)
                              and (not m or e.ts.hour < 12), round(q * CATCH_OTHERS)):
                    e.role, e.tag["catch"] = "catch", (p.short, k)
        for i, origin in enumerate(self.quote_ts):
            q = max(1, round(n * QUOTE_RATE))
            later = origin + timedelta(days=1)
            for e in take(lambda e, t=later: e.sender != DEPARTER and e.ts > t, q):
                e.role, e.tag["quote"], e.tag["tmpl"] = "quote_rep", i, rs.randrange(5)
        for e in take(lambda e: True, max(1, round(n * BAD_RATE))):
            e.role, e.tag["bad"] = "badword", rs.randrange(8)
        for ev, d in EVENT_DAYS.items():
            after = _at(d + timedelta(days=4), 0)
            for e in take(lambda e, t=after: e.ts > t, max(1, round(n * MEMORY_RATE))):
                e.role, e.topic = "memory", ev
        weights = {p.short: (2.0 if p.short == DEPARTER else 1.6 if p.short == "Tomi" else 1.3
                             if p.short == "Caro" else 1.0) for p in PEOPLE}
        pool = [e for e in self.events if not e.scripted and e.kind == "text" and e.role in MENTION_ROLES]
        for e in take(lambda e: True, round(n * MENTION_RATE)):
            cands = self.others(e.ts, e.sender)
            if cands:
                e.tag["mention"] = rs.choices(cands, [weights[c] for c in cands])[0]
        pool = [e for e in self.events if not e.scripted and e.kind == "text" and e.role in QUOTA_ROLES]
        for e in take(lambda e: "mention" not in e.tag, max(1, round(n * DELETED_RATE))):
            e.kind = "deleted"
        for e in take(lambda e: "mention" not in e.tag, max(1, round(n * EDITED_RATE))):
            e.kind = "edited"
        have = Counter(e.kind for e in self.events)
        for mtype in MEDIA_TYPES:
            if not have[f"media:{mtype}"]:
                for e in take(lambda e, t=mtype: t in BY_SHORT[e.sender].media and "mention" not in e.tag, 1):
                    self.events.remove(e)
                    self._media(e.ts, e.sender, mtype)
        self.events.sort(key=lambda e: (e.ts, e.seq))


def _laugh_slot(rs: Random, who: str) -> int:
    return rs.choices(range(cast.LAUGH_SLOTS), BY_SHORT[who].laughs)[0]


# ---------------------------------------------------------------- palabras (pasada 2)
ACCENTS = str.maketrans("áéíóúÁÉÍÓÚ", "aeiouAEIOU")
SLOT_RE = re.compile(r"\{(\w+)\}")
GENDER_RE = re.compile(r"\[(\w*)\|(\w*)\]")
QUOTE_WORDS = 5  # largo de los n-gramas de las citas (group_report.departer_quotes)
RECENT = 40  # plantillas recientes que no se repiten (la misma frase dos veces en una charla no suena real)
ALT_RE = re.compile(r"<([^<>]*)>")  # variantes en una plantilla: "<qué|tremendo> día"
QUOTE_SPLIT_RE = re.compile(r"[\wáéíóúñ]+")  # palabras como las corta group_report.departer_quotes ("what's" = 2)
MAX_TEXT_USES = 3  # una oración de QUOTE_WORDS o más palabras sale a lo sumo tantas veces en toda la historia
MAX_GRAM_SENDERS = 2  # un 5-grama con contenido lo escriben a lo sumo dos personas (citas: hacen falta 2 que copien)
PICK_TRIES = 24  # intentos de pick antes del respaldo corto
MAX_GRAM_USES = 6  # ...y a lo sumo tantas veces (que no se vuelva muletilla de nadie)


def norm_tokens(text: str) -> list[str]:
    """Palabras en minúscula y sin tildes (como web.common.norm_words, sin depender de pandas)."""
    plain = "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z0-9ñ]+(?:'[a-z0-9ñ]+)*", plain.replace("’", "'"))


class _Budget:
    """Cuántas veces se usó cada oración larga y cada 5-grama con contenido (y quiénes). Las plantillas se repiten:
    sin tope, el capítulo de frases que otros repitieron se llena de plantillas en vez de citas."""

    def __init__(self, stopwords: frozenset[str], lang: str):
        self.stop = stopwords
        self.lang = lang
        self.texts: Counter = Counter()
        self.grams: Counter = Counter()
        self.gram_senders: dict[str, set[str]] = {}

    def _grams(self, words: list[str]) -> set[str]:
        """Los 5-gramas que web.language.repeated_by_others podría citar: con dos palabras que no son stopwords y
        alguna que no es de uso corriente en la lengua (sin chats de fondo, los de palabras corrientes no cuentan)."""
        out = set()
        for i in range(len(words) - QUOTE_WORDS + 1):
            gram = words[i:i + QUOTE_WORDS]
            if sum(w not in self.stop for w in gram) >= 2 and not all(word_is_common(w, self.lang) for w in gram):
                out.add(" ".join(gram))
        return out

    def ok(self, text: str, sender: str) -> bool:
        words = norm_tokens(text)
        if len(words) < QUOTE_WORDS:
            return True
        if self.texts[" ".join(words)] >= MAX_TEXT_USES:
            return False
        for g in self._grams(words):
            who = self.gram_senders.get(g, set())
            if self.grams[g] >= MAX_GRAM_USES or (sender not in who and len(who) >= MAX_GRAM_SENDERS):
                return False
        return True

    def use(self, text: str, sender: str) -> None:
        words = norm_tokens(text)
        if len(words) < QUOTE_WORDS:
            return
        self.texts[" ".join(words)] += 1
        for g in self._grams(words):
            self.grams[g] += 1
            self.gram_senders.setdefault(g, set()).add(sender)


class _Words:
    def __init__(self, seed: int, lang: str):
        self.rv = Random(f"{seed}:{lang}")
        self.v = cast.vocab(lang)
        self.lang = lang
        self.bad_used: set[str] = set()
        self.recent: deque[str] = deque(maxlen=RECENT)
        self.budget = _Budget(frozenset(norm_tokens(" ".join(get_lang(lang).stopwords))), lang)
        self.fallbacks = 0

    def fill(self, tmpl: str, sender: str) -> str:
        rv, v = self.rv, self.v

        def slot(m: re.Match) -> str:
            key = m.group(1)
            if key == "name":
                pool = [p.short for p in PEOPLE if p.short != sender]
                pool += [p.nickname for p in PEOPLE if p.nickname and p.short != sender]
                return rv.choice(pool)
            return rv.choice(v.SLOTS[key])

        text = ALT_RE.sub(lambda m: rv.choice(m.group(1).split("|")), tmpl)
        return GENDER_RE.sub(lambda m: m.group(2 if BY_SHORT[sender].female else 1), SLOT_RE.sub(slot, text))

    def choice(self, options) -> str:
        """rv.choice que esquiva las últimas RECENT elecciones (hasta seis intentos)."""
        for _ in range(6):
            option = self.rv.choice(options)
            if option not in self.recent:
                break
        self.recent.append(option)
        return option

    def acceptable(self, text: str, sender: str) -> bool:
        """No nombra a quien lo manda, Bruno escribe corto (menos de QUOTE_WORDS palabras: group_report cuenta como
        cita suya todo 5-grama que escribió y otros repitieron después) y entra en el presupuesto de repeticiones."""
        if re.search(rf"\b{re.escape(sender)}\b", text):
            return False
        if sender == DEPARTER and len(QUOTE_SPLIT_RE.findall(text.lower())) >= QUOTE_WORDS:
            return False
        return self.budget.ok(text, sender)

    def decorate(self, text: str) -> str:
        """Otro arranque y/o cierre de discurso (vocab.DECOR): "che, mi jefe no entiende nada, posta"."""
        rv, d = self.rv, self.v.DECOR
        r = rv.random()
        if r < 0.7:
            first = text[:1] if text[:2].isupper() or text[:1] in "¿¡@" else text[:1].lower()
            text = f"{rv.choice(d['pre'])} {first}{text[1:]}"
        if r > 0.4:
            end = text.rstrip("?!.")
            text = end + rv.choice(d["post"]) + text[len(end):]
        return text

    def pick(self, options: list[str], sender: str, fallback: list[str] | None = None) -> str:
        """Una plantilla llena aceptable (hasta PICK_TRIES intentos, desde el tercero con otro arranque o cierre); si
        no, una de `fallback` (por defecto, una reacción corta)."""
        for k in range(PICK_TRIES):
            text = self.fill(self.choice(options), sender)
            if k >= 2:
                text = self.decorate(text)
            if self.acceptable(text, sender):
                break
        else:
            self.fallbacks += 1
            short = fallback or self.v.GENERIC["react"]
            for _ in range(12):
                text = self.fill(self.choice(short), sender)
                if self.acceptable(text, sender):
                    break
        self.budget.use(text, sender)
        return text

    def style(self, text: str, who: str) -> str:
        rv, style = self.rv, BY_SHORT[who].style
        if style == "caps" and rv.random() < 0.15:
            return text.upper() + "!!"
        if style == "lower":
            text = text.lower().translate(ACCENTS).replace("¿", "").replace("¡", "")
            return text.replace("'", "") if self.lang == "en" and rv.random() < 0.6 else text
        if style == "proper":
            text = text[:1].upper() + text[1:]
            return text + "." if text[-1:].isalpha() and rv.random() < 0.4 else text
        if style == "dots" and rv.random() < 0.25:
            return text + "..."
        if style == "bang" and rv.random() < 0.3:
            return text + "!!"
        if style == "plain" and rv.random() < 0.3:
            return text.replace("¿", "")
        return text

    def text(self, e: Event) -> str:
        v, rv, role, s = self.v, self.rv, e.role, e.sender
        g = v.GENERIC
        if role in ("open", "say", "ask"):
            src = v.EVENTS[e.topic] if e.topic in EVENTS else v.TOPICS[e.topic or "plans"]
            body = self.pick(src[role], s)
        elif role == "memory":
            body = self.pick(v.EVENTS[e.topic]["memory"], s)
        elif role in ("answer", "react", "agree", "disagree", "morning", "night", "joke"):
            body = self.pick(g[role], s)
        elif role in ("welcome", "poll_react"):
            body = self.fill(g[role][e.tag["i"]], s)
        elif role == "laugh":
            body = rv.choice(v.LAUGHS[e.tag["slot"]])
            if e.tag.get("tail"):
                body = f"{body} {self.choice(g['laugh_tail'])}"
        elif role == "list":
            body = "\n".join([rv.choice(v.LISTS["header"]), *rv.sample(v.LISTS["items"], e.tag["items"])])
        elif role == "lore":
            word, phrases = v.LORE[e.tag["lore"]]
            body = self.pick(phrases, s, fallback=[f"{word}<|!|, posta|, eh>"])
        elif role == "catch":
            owner, k = e.tag["catch"]
            body = v.CATCH[owner][k]
            if rv.random() < 0.35:
                tail = f"{body}, {self.fill(self.choice(g['react']), s)}"
                if self.acceptable(tail, s):
                    body = tail
                    self.budget.use(body, s)
        elif role == "quote":
            body = v.QUOTES[e.tag["quote"]]
        elif role == "quote_rep":
            body = v.QUOTE_REPEAT[e.tag["tmpl"]].replace("{q}", v.QUOTES[e.tag["quote"]])
        elif role == "badword":
            kind, tmpl = v.BAD_TEMPLATES[e.tag["bad"]]
            word = rv.choice(v.BAD_EXCL if kind == "excl" else v.BAD_INSULT)
            if kind == "insult_self" and BY_SHORT[s].female:
                word = v.BAD_FEMININE.get(word, word)
            body = tmpl.replace("{w}", word)
            if not self.acceptable(body, s):
                body = v.BAD_FALLBACK["excl" if kind == "excl" else "insult"].replace("{w}", word)
                body = self.fill(body, s)
            self.budget.use(body, s)
            self.bad_used.add(word)
        elif role == "complain_exit":
            body = v.COMPLAIN_EXIT[e.tag["exit"]]
        elif role == "complain":
            body = v.COMPLAIN[e.tag["i"]]
        elif role == "accuse":
            body = v.ACCUSE[e.tag["i"]]
        elif role == "scene_reply":
            body = v.SCENE_REPLY[e.tag["i"]]
        elif role == "back":
            body = v.BACK[e.tag["i"]]
        elif role == "welcome_back":
            body = v.WELCOME_BACK[e.tag["i"]]
        else:
            raise ValueError(f"rol sin vocabulario: {role!r}")
        if role in STYLE_ROLES:
            body = self.style(body, s)
        if e.tag.get("emoji"):
            body = f"{body} {e.tag['emoji']}"
        return body

    def realize(self, e: Event) -> None:
        if e.kind in ("text", "edited"):
            e.body = self.text(e)
        elif e.kind == "poll":
            question, labels = self.v.POLLS[e.tag["poll"]]
            e.tag["question"], e.tag["labels"] = question, labels
        elif e.kind == "media:document":
            e.tag["doc_name"], e.tag["pages"] = self.v.DOCS[e.tag["doc"]]
            e.tag["pages_word"] = self.v.PAGES[e.tag["pages"] != 1]


def build(seed: int, lang: str, lines: int) -> Story:
    """La historia de `seed` con unas `lines` líneas de export (exactas salvo que el guion solo ya las supere)."""
    plan = _Plan(seed, lines)
    plan.scripted()
    plan.filler()
    plan.fit()
    plan.quotas()
    words = _Words(seed, lang)
    for e in plan.events:
        words.realize(e)
    return Story(seed=seed, lang=lang, target_lines=lines, title=TITLE, people=PEOPLE, events=plan.events,
                 event_days=dict(EVENT_DAYS), badwords_used=tuple(sorted(words.bad_used)))
