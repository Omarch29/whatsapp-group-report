"""English: the same resources as wa.lang.es, for chats in English.

Words are matched the way the pipeline normalizes them (lowercase, no accents). The apostrophe is a word character
between letters (word_re, word_chars: "don't", "it's", "i'm" are one word; the typographic ’ counts as '), and people
also write contractions without it ("dont", "im", "youre"), so both forms are stopwords. The departure patterns
accept ' and ’ (and no apostrophe at all).
"""
from __future__ import annotations

import re

from wa.lang import DeparturesPatterns, Labels, Lang

STOPWORDS = frozenset(
    """
a about above after again against all also am an and any are aren arent as at be because been before being below
between both but by can cant cannot could couldn couldnt did didn didnt do does doesn doesnt doing don dont down
during each even ever every few for from further get gets getting go goes going gonna got gotta had hadn hadnt has
hasn hasnt have haven havent having he hed hes her here heres hers herself him himself his how hows i id ill im is
isn isnt it its itself ive just let lets like me more most much must my myself no nor not now of off oh ok okay on
once only or other our ours ourselves out over own really same she shes should shouldn shouldnt so some such than
that thats the their theirs them themselves then there theres these they theyd theyll theyre theyve this those
through to too under until up us very was wasn wasnt we wed well were weren werent weve what whats when whens where
wheres which while who whos whom why whys will with won wont would wouldn wouldnt yeah yes yep yup you youd youll
your youre yours yourself yourselves youve u ur r pls thx ah uh um hey hi hmm still maybe thing things one two
haha hahaha lol lmao
aren't can't couldn't didn't doesn't don't hadn't hasn't haven't he'd he'll he's here's how's i'd i'll i'm i've
isn't it'd it'll it's let's mustn't she'd she'll she's shouldn't that's there's they'd they'll they're they've
wasn't we'd we'll we're we've weren't what's when's where's who's why's won't wouldn't you'd you'll you're you've
y'all ain't gonna wanna gotta idk omg lemme kinda yall aint into something anything nothing
""".split()
)

LAUGH_RE = re.compile(
    r"^(?:(?:h+a+)+h*|a(?:h+a+){2,}h*|h+e+h+(?:e+h*)*|l+o+l+(?:o+l+)*|lmf?a+o+|rofl+|x+d+)$", re.IGNORECASE
)
LAUGH_KINDS = (
    ("haha", "haha", re.compile(r"^(?:(?:h+a+)+h*|a(?:h+a+){2,}h*)$")),  # as in LAUGH_RE: "aha" is not a laugh
    ("hehe", "hehe", re.compile(r"^h+e+h+(?:e+h*)*$")),  # "he" alone is the pronoun, not a laugh
    ("lol", "lol", re.compile(r"^l+o+l+(?:o+l+)*$")),
    ("lmao", "lmao", re.compile(r"^lmf?a+o+$")),
    ("xd", "xd", re.compile(r"^x+d+$")),
)

EDGE = frozenset({"the", "a", "an", "of", "to", "in", "on", "at", "for", "with", "by", "from", "and", "or", "that"})
# A phrase does not start or end in an article, preposition or conjunction ("of the", "and then").
START_BLOCK = EDGE | {"as", "into", "than"}
# Nor end in a subject pronoun, possessive, auxiliary (also contracted) or connective ("and i", "so we", "i don't",
# "if you have", "my"): fragments of something longer. Object pronouns, "you" and "it" included, may end one
# ("miss you", "love you", "forget it", "tell me").
END_BLOCK = START_BLOCK | {
    "i", "my", "your", "his", "its", "our", "their", "is", "are", "was", "were", "am", "be", "been", "do", "does",
    "did", "have", "has", "had", "will", "would", "can", "could", "should", "not", "no", "but", "because", "so",
    "very", "too", "if", "just", "about", "we", "they", "he", "she",
    "i'm", "i've", "i'll", "i'd", "it's", "that's", "you're", "we're", "they're", "he's", "she's", "there's",
    "don't", "doesn't", "didn't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't", "wouldn't",
    "couldn't", "shouldn't", "haven't", "hasn't",
}
ABBREVIATIONS = {"u": "you", "ur": "your", "r": "are", "pls": "please", "thx": "thanks"}
ONE_CHAR_OK = frozenset({"a", "i"})
FILLER_REDUP = frozenset({"yes", "no", "ok", "yeah", "nah", "oh", "ah"})
# Phrases anyone says: never anyone's catchphrase. Normalized (lowercase, no accents; with and without apostrophe).
GENERIC = frozenset({
    "i dont know", "i don't know", "whats up", "what's up", "i'm in", "im in", "let's go", "lets go", "no way", "oh ok", "oh okay", "same here", "me too",
    "of course", "see you", "see ya", "good morning", "good night", "thank you", "oh no", "oh yeah", "yes yes",
    "no no", "for sure", "i know", "i think", "i mean", "you know", "right now", "let me know", "how are you",
    "happy birthday", "sounds good", "oh my god", "oh god", "what time", "what happened", "holy shit",
    "what the fuck", "what the hell", "son of a bitch", "are you", "you guys",
})

# Generic swear words (normalized like norm_words); content/badwords.txt extends them.
BADWORDS_BASE = frozenset({
    "fuck", "fucking", "fucked", "fucker", "motherfucker", "shit", "shitty", "bullshit", "shithead", "dipshit",
    "damn", "dammit", "goddamn", "ass", "asshole", "dumbass", "jackass", "bitch", "son of a bitch", "bastard",
    "crap", "dick", "dickhead", "prick", "piss", "pissed", "wanker", "twat", "bollocks", "bloody hell", "arse",
    "arsehole", "douche", "douchebag", "jerk", "idiot", "moron", "stupid", "screw you", "wtf", "stfu", "cunt",
    "bugger", "sod off",
})

DOW = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December")


def fmt_int(n: int) -> str:
    return f"{n:,}"  # 2,300


def awards(th) -> list[tuple[str, str, str, str | tuple[str, str]]]:
    """(id, title, criterion, unit) of each award; the unit is a string or, for a count, (singular, plural); the fastest's criterion quotes the real minimum in th."""
    return [
        ("msgs", "Most messages", "Who sent the most messages in the whole chat.", ("message", "messages")),
        ("stickers", "Most stickers", "Who sent the most stickers.", ("sticker", "stickers")),
        ("audios", "Most voice notes", "Who sent the most voice notes.", ("voice note", "voice notes")),
        ("badwords", "Biggest swearer", "Most swear words per thousand messages.", "per thousand"),
        ("early", "The early bird", "Highest share of their messages between 6 and 9 in the morning.", "%"),
        ("owl", "The night owl", "Highest share of their messages between midnight and 6.", "%"),
        ("mentioned", "Most mentioned", "Who got tagged with @ the most.", ("mention", "mentions")),
        ("fastest", "The fastest",
         f"The lowest median reply time, among those who replied at least {th.fastest_min_replies} times.", "s"),
        ("edited", "Most edited", "Most edited messages per thousand.", "per thousand"),
        ("deleted", "Most deleted", "Most deleted messages per thousand.", "per thousand"),
        ("muletilla", "Catchphrase of the year",
         "The phrase with the highest own/rest ratio in the chat's last year.", "x"),
        ("starters", "Conversation starter", "Most times they sent the first message after 3 hours of silence.",
         ("time", "times")),
    ]


# "Scene" triggers: others talking about the member being jealous/upset, and the member's exclusion complaints.
ACCUSE_RE = r"jealous|drama|a scene|upset|angry|mad at|offended|sulk|tantrum"
COMPLAIN_RE = (
    r"didn['’]?t invite me|did not invite me|without me|left me out|nobody told me|no one told me|nobody invited|"
    r"excluded|forgot (?:about )?me|traitor|fake friends|hypocrit|nobody (?:asked|called) me|always the same|"
    r"you never invite|using me"
)
# {names} = alternation of the member's aliases (group_report._alias_re)
QUOTE_TEMPLATES = (
    r'(?i)(?:{names})\s*[:=\-–]\s*[“"](.{{6,160}}?)[”"]',
    r'(?i)[“"](.{{6,160}}?)[”"]\s*(?:says|said|would say|used to say)\s+(?:{names})',
    r'(?i)(?:{names})\s+(?:says|said|would say|used to say|be like)\s*:?\s*[“"](.{{6,160}}?)[”"]',
)

LANG = Lang(
    code="en",
    word_re=re.compile(r"[a-záéíóúüñ]+(?:'[a-záéíóúüñ]+)?", re.IGNORECASE),
    word_chars="a-z0-9ñ'",
    stopwords=STOPWORDS,
    laugh_re=LAUGH_RE,
    laugh_kinds=LAUGH_KINDS,
    laugh_emoji=("😂", "🤣"),
    laugh_unit=re.compile(r"h+a+"),
    laugh_hint="[hHlLxX]",
    filler_redup=FILLER_REDUP,
    generic_phrases=GENERIC,
    edge=EDGE,
    start_block=START_BLOCK,
    end_block=END_BLOCK,
    abbreviations=ABBREVIATIONS,
    one_char_ok=ONE_CHAR_OK,
    exclamative=None,
    badwords_base=BADWORDS_BASE,
    dow=DOW,
    months=MONTHS,
    labels=Labels(
        rest="Others",
        unknown_mention="@someone",
        unnamed_rename="(unnamed)",
        new_photo="New photo",
        msgs=lambda n: f"{fmt_int(n)} messages",
        returns=lambda n: f"{fmt_int(n)} returns",
        awards=awards,
        fmt_int=fmt_int,
    ),
    departures=DeparturesPatterns(
        accuse=ACCUSE_RE,
        complain=COMPLAIN_RE,
        quote_templates=QUOTE_TEMPLATES,
        complaint_chip=(r"didn['’]?t invite me|did not invite me", 'times wrote "didn\'t invite me"'),
    ),
)
