"""Vocabulary of the fictional chat in English. Same keys and indices as vocab_es (see synth/cast.py).

Templates with slots {day} {hour} {place} {food} {drink} {show} {num} {name}; {name} is another member (short name or
nickname). The generic lists carry no laughs, swear words, complaints or lore words: those only enter through their
quotas (story.py), so each chapter's counts are the ones the story decides.
"""

SLOTS = {
    "day": ["on Saturday", "on Friday", "on Sunday", "tomorrow", "today", "this weekend", "on Thursday",
            "on Monday"],
    "hour": ["at 8", "at 9", "around 10", "at 9pm", "in the afternoon", "after 7", "at 1"],
    "place": ["the park", "the square", "the usual bar", "Tomi's place", "Caro's place", "the riverside",
              "the club", "Lucas's place", "Flor's rooftop"],
    "food": ["pizza", "empanadas", "burgers", "sushi", "tacos", "pasta", "a stew", "ramen", "hot dogs",
             "croissants"],
    "drink": ["beer", "wine", "coffee", "soda", "ice cream", "lemonade"],
    "show": ["the new series", "that horror movie", "the octopus documentary", "the zombie one",
             "that soap opera", "the lawyer show"],
    "num": ["2", "3", "4", "5", "10", "15", "20"],
}

TOPICS = {
    "plans": {
        "open": ["so what are we doing {day}?", "guys, going out {day}?", "anyone up for something {day}?",
                 "<proposal|idea|how about a>: hangout at {place} {day}",
                 "what if we do something {day} <night|chill|early>?"],
        "say": ["I can make it after <8|9|10>", "can't make it {day}, <family thing|got plans|work stuff>",
                "ok, {place} {hour}", "I'll bring {drink}", "if it's early I'm in",
                "I'll go but <leave|head home|bail> <early|before midnight|after an hour>",
                "I'll be <late|a bit late|super late> but I'll <be there|show up|make it>",
                "{place} is <so far|miles away|a trek> for me but I'll go <anyway|regardless|for sure>"],
        "ask": ["what time?", "who's going?", "should I bring something?", "whose place?"],
    },
    "football": {
        "open": ["did you watch the game <last night|yesterday|on Sunday>?",
                 "what a game <yesterday|last night|today>, I <can't|still can't> <believe it|get over it>",
                 "who's up for five-a-side {day}?", "we need <two|three|one> more for football, <let us know|confirm>"],
        "say": ["the ref <robbed us|ruined it|killed the game>, <simple as that|no doubt|period>",
                "we played <awful|terrible|so bad> in the <first|second> half",
                "that goal was a <work of art|painting|masterpiece>", "bench the keeper already",
                "the second half was something else",
                "with this <coach|manager|squad> we're going <nowhere|absolutely nowhere|down>",
                "I lost my voice <screaming|cheering|yelling>",
                "the pitch was <pure mud|a swamp|a swimming pool>"],
        "ask": ["who's bringing the ball?", "five or seven a side?", "what time is the <game|match>?"],
    },
    "work": {
        "open": ["<long|heavy|endless> day at work",
                 "you won't believe the meeting I <sat through|survived|had> today",
                 "starting at <7|6|8> tomorrow, send help", "they changed my shift <again|one more time>"],
        "say": ["my boss has no clue", "I've got <a million|a thousand|way too many> things",
                "staying late today for sure",
                "<three|four|two> meetings that could have been <an email|a message|a voice note>",
                "luckily <Friday|Monday|Thursday> is a holiday",
                "taking vacation in <March|January|July> no matter what",
                "working from home <today|all week>, in <pajamas|my robe|slippers>",
                "they asked me for a <report|budget|deck> due <yesterday|an hour ago|now>"],
        "ask": ["are you still at the same job?", "what time do you get off?", "did you get your bonus?"],
    },
    "food": {
        "open": ["I'm so hungry I could eat a <horse|cow|whole table>", "should we order {food}?",
                 "made {food} and it came out <amazing|perfect|so good>",
                 "found a <great|cheap|crazy good> {food} place"],
        "say": ["give me {food} and I'm happy",
                "last time I ordered <there|from them> it took <two hours|forever|90 minutes>",
                "I'd rather cook, it's <half the price|way cheaper|so much cheaper>",
                "today is {food} day, no discussion", "ate so much I can't move", "{food} and {drink}, perfect plan",
                "send me the recipe", "the delivery guy <already|even> knows me by name"],
        "ask": ["where did you get it?", "how much was it?", "anyone know how to make {food}?"],
    },
    "shows": {
        "open": ["has anyone seen {show}?", "finished {show} <last night|yesterday|just now>, what an ending",
                 "recommend me something to watch, I'm bored", "started {show} and I <can't|just can't> stop"],
        "say": ["the <first|pilot> episode is <slow|meh|boring> but then it <hooks you|gets good|explodes>",
                "no spoilers <please|ok|I haven't finished>", "the second season is <way|much|so much> better",
                "fell asleep halfway through", "the ending blew my mind", "watched it in <two|three> days",
                "that actress is the best", "the soundtrack is <insane|the best part|a gem>"],
        "ask": ["which platform is it on?", "how many seasons?", "is it worth it?"],
    },
    "weather": {
        "open": ["this heat, seriously", "a <huge|crazy|massive> storm is coming", "it's freezing today",
                 "seen the forecast for <the weekend|tomorrow|Saturday>?"],
        "say": ["went out without an umbrella and got <soaked|drenched|wet to the bone>", "power went out at home",
                "hope it rains to cool off", "they say sun {day}", "I can't take this humidity",
                "already got the jackets out", "the fan can't keep up",
                "hail in <November|summer|January>, <what is this|so weird|unreal>"],
        "ask": ["is it raining there?", "do we cancel if it rains?", "how hot is it?"],
    },
    "music": {
        "open": ["send songs for the car", "who's going to the concert?", "can't get this song out of my head",
                 "made a playlist for <the weekend|the trip|the hangout>"],
        "say": ["that album is a gem", "saw them live and it's <another level|something else|insane>",
                "tickets sold out in <ten|five|twenty> minutes", "had the song on loop for <three|two|four> days",
                "I'm the one who picks the music at <hangouts|parties|the barbecue|road trips>",
                "that song takes me back to <high school|college|primary school>", "turn it up",
                "the <bass player|drummer|singer> is a genius"],
        "ask": ["what's that song called?", "how much are the tickets?", "anyone have a spare ticket?"],
    },
    "travel": {
        "open": ["what if we go to the <coast|mountains|lake> one weekend?",
                 "back from the trip, everything was <lovely|perfect|amazing>", "found super cheap tickets",
                 "planning the holidays, anyone <joining|in|up for it>?"],
        "say": ["the road was empty", "the hotel was a mess but we had <fun|a blast|a great time>",
                "I'll bring the <snacks|cookies|sandwiches> and the <thermos|cooler|coffee>",
                "we leave <Friday|Saturday|Thursday> early",
                "the beach was <packed|full|a nightmare>", "got <sunburned|burnt|fried> on day <one|two>",
                "I'd go back tomorrow",
                "the bus took <nine|ten|twelve> hours"],
        "ask": ["how many days are you going?", "how much was the ticket?", "car or bus?"],
    },
    "money": {
        "open": ["prices went up again",
                 "went to the <supermarket|store|market> and spent <a fortune|so much|half my salary>",
                 "money is so tight this month", "got my credit card bill and nearly <fainted|died|cried>"],
        "say": ["we have to save somewhere", "<rent|gas|internet> went up <a lot|like crazy|40%>",
                "I get paid on the 5th, hang in there",
                "I don't eat out anymore", "the salary goes <less and less far|nowhere|shorter every month>",
                "<started|made> a <spreadsheet|list|table> for <expenses|everything|the bills>",
                "selling my <bike|tv|guitar> if anyone wants it",
                "a coffee on the corner costs like <a lunch|a barbecue|a whole meal>"],
        "ask": ["how much did they charge you?", "can you lend me some until Friday?",
                "anyone <know|got> a <cheap|decent|good> <plumber|electrician|mechanic>?"],
    },
    "pets": {
        "open": ["the dog chewed my <sneakers|couch|pillow> again", "I adopted a kitten", "look what the cat did",
                 "can anyone watch my dog <this weekend|on Saturday|for a few days>?"],
        "say": ["sleeps all day, <I envy him|what a life|goals>",
                "took him to the vet and he's <fine|great|perfect>", "ate half a pizza",
                "won't stop <meowing|crying|barking> at <5am|6am|4am>",
                "the <cuddliest|cutest|laziest> in the <world|block|galaxy>", "already learned to <give paw|sit|fetch>",
                ("<bought|got|built> him a new <bed|cushion|basket> and he <sleeps|lies down|naps> "
                 "<outside|on the floor|in mine>"),
                "<terrified|scared to death|afraid> of the <vacuum|blender|broom>"],
        "ask": ["what's his name?", "how old is he?", "what does he eat?"],
    },
    "gossip": {
        "open": ["you won't believe who I ran into <today|yesterday|at the supermarket>", "I have amazing gossip",
                 "did you hear about the neighbor?", "guess who texted me"],
        "say": ["can't tell you here", "I'll tell you in person", "I knew it all along", "that won't end well",
                "a <reliable|trusted|very close> source told me", "it's all very weird", "I'll send details later",
                "the neighbor knows everything about <everyone|the whole block|each of us>"],
        "ask": ["who told you?", "seriously?", "and what did you say?"],
    },
    "health": {
        "open": ["I've got a cold, not leaving bed", "started the gym, wish me luck",
                 "everything hurts from yesterday", "went for a <5k|3k|8k> run today"],
        "say": ["had tea with <honey|lemon|ginger> and nothing", "diet starts Monday", "slept twelve hours",
                "got my tests back and <all good|everything's fine|all clear>",
                "the gym coach is a <drill sergeant|tyrant|general>",
                "I walk to work and arrive <dead|destroyed|wrecked>", "we need more sleep",
                "took the day off, I'm done"],
        "ask": ["did you see a doctor?", "which gym do you go to?", "feeling better?"],
    },
}

GENERIC = {
    "answer": ["at 9", "I'm going", "no idea", "I think so", "dunno, ask {name}", "I'll tell you in a bit",
               "I'll confirm tomorrow", "yes, obviously", "no way", "ok, I'll handle it", "depends on the weather",
               "I'll check and let you know", "honestly no clue", "that's what they said", "we'll see",
               "{name} knows", "I think {day}", "like {num} bucks"],
    "react": ["ok", "sure", "really?", "not a chance", "ugh", "nice", "nooo", "exactly", "that's crazy", "good one",
              "aww", "nah", "for real?", "you're kidding", "that's how it is", "ugh what a bummer", "love it",
              "great", "what a drag", "cool", "done", "awesome", "oh ok", "legend", "king", "let's go",
              "nooo I can't", "bad move", "meh", "yep", "yes", "totally", "obviously", "whatever", "what's that about"],
    "agree": ["agreed", "exactly what {name} said", "totally", "that's what I keep saying", "with {name} on this",
              "same as {name}", "I think so too"],
    "disagree": ["not at all", "I don't agree", "not for me", "hmm not sure", "nope"],
    "morning": ["hey, how did everyone wake up?", "already on the bus", "first coffee of the day",
                "up at 6 and already <ran|worked out|did groceries>", "beautiful sunrise today",
                "going for a run, see you", "morning, anyone else <up early|awake|alive>?", "coffee and off to work"],
    "night": ["can't sleep", "watching <cat|cooking|fail> videos at <3am|2am|4am>", "I'll regret this tomorrow",
              "totally lost my sleep", "last message and I'm out", "hearing weird noises outside",
              "ate everything in the <fridge|pantry|house>", "anyone still around?"],
    "joke": ["fell off my <bike|stairs|skateboard> in front of <the whole bus|half the block|my boss>",
             "the waiter said enjoy your meal and I said '<you too|thanks, same|likewise>'",
             "my mom sent a <7|9|12> minute voice note to ask if I <ate|got home|was alive>",
             "waved at someone who was waving at someone else, <so embarrassing|I want to die|kill me>",
             "got locked in the <office|bar|gym> bathroom",
             "went to the supermarket with a list and came back with <everything|random stuff> except the list",
             "put salt in my <coffee|tea|cereal> <by accident|again|and drank it anyway>",
             "the dog looked at me with pure <disappointment|pity|second-hand embarrassment>",
             "replied to my <boss|family group|landlord> with a sticker by accident",
             "fell asleep on the bus and ended up <across town|at the terminal|in another city>",
             "tried on {name}'s jacket and it fits me like a <dress|tent|cape>",
             "<today|yesterday> I talked to the fridge thinking it was <my mom|the voicemail|Alexa>",
             "ordered a <coffee|latte|juice> and got <a burger|a smoothie|the bill>",
             "posted in the wrong group and sent <the voice note|the photo|the list> for the barbecue",
             "spent ten minutes looking for my phone <with the phone in my hand|while talking on it>"],
    "laugh_tail": ["I can't", "I'm dying", "crying", "I'm crying", "seriously", "stop", "genius", "what a character",
                   "love you", "dead"],
    "poll_react": ["voted", "vote people", "three more votes missing", "this poll is rigged", "voted what {name} said"],
    "welcome": ["welcome to the group, this is where barbecues get planned", "lovely group", "thanks for adding me",
                "finally a serious group"],
}

# Discourse markers that story.pick adds on retries (a long sentence already used comes back with another opening or
# ending, the way people actually write).
DECOR = {
    "pre": ["honestly", "ok so", "man,", "dude,", "listen,", "well,", "oh and", "so yeah,", "ok but", "wait,",
            "like,", "anyway,", "look,", "oh,"],
    "post": [", honestly", ", for real", ", man", ", I swear", ", seriously", ", just saying", ", you know",
             ", whatever", ", I guess", ", right", ", no joke"],
}

LISTS = {
    "header": ["shopping list:", "what's missing:", "for the weekend:", "to buy:"],
    "items": ["charcoal", "ice", "bread", "sausages", "flank steak", "potatoes", "salad", "beer", "wine", "soda",
              "napkins", "cups", "dessert", "mayo", "lemons", "extra charcoal"],
}

EVENTS = {
    "asado": {
        "open": ["what's the plan for Saturday's barbecue?",
                 "confirm for the barbecue so I can <shop|plan|make the list>",
                 "barbecue at Tomi's today, <don't miss it|don't be late|be there>"],
        "say": ["I'll bring the steak", "light the grill, I'm <ten|five|fifteen> minutes away",
                "the barbecue starts at <1|2|1:30>", "brought extra charcoal just in case",
                "what a barbecue people, insane", "I made the chimichurri", "not a single sausage left",
                "Tomi is the best grill master in the <world|city|universe>",
                "the barbecue warm up has <started|begun|kicked off>",
                "that grill is older than <all of us|the group|my grandma>"],
        "ask": ["who's bringing the charcoal?", "how much meat do we buy?", "what time is the barbecue?"],
        "memory": ["just like the <April|Tomi's|legendary> barbecue",
                   "that barbecue was the best <of the year|ever|of all time>",
                   "still thinking about the barbecue at Tomi's", "we need to repeat the <April|Tomi's> barbecue"],
    },
    "mundial": {
        "open": ["world cup final today, don't <forget|fall asleep|miss it>", "where are we watching the final?",
                 "so nervous about the final, didn't sleep"],
        "say": ["bringing the usual lucky charms",
                "nobody moves from their seat during the <game|second half|extra time>",
                "I can't watch the penalties", "what a final omg", "I'm shaking",
                "we watched this world cup together", "I'm gonna cry", "come on come on come on",
                "this is pure history", "game of my life"],
        "ask": ["who's bringing the lucky shirt?", "what time does the final start?",
                "are we going out to celebrate after the game?"],
        "memory": ["just like the world cup final", "my voice is still gone from the final",
                   "nothing beats watching the world cup final <together|at Lucas's|with you guys>",
                   "the world cup final photos are <the best|legendary|history>"],
    },
    "cumple": {
        "open": ["tomorrow is Caro's birthday, what do we <get her|buy her|bring>?", "happy birthday Caro!!! 🎂",
                 "birthday party today, don't miss it"],
        "say": ["I'll bring the cake", "the present is sorted", "happy birthday to you", "happy birthday!",
                "chip in for the present", "what a lovely party", "the cake was incredible", "we danced until 4",
                "she loved the present", "there's cake for <a week|a month|the whole block>"],
        "ask": ["what time is the birthday party?", "who's bringing the cake?",
                "how much do we chip in for the <gift|party|present>?"],
        "memory": ["just like Caro's birthday", "Caro's birthday was <epic|the best|a blast>",
                   "the birthday photos are the best", "there's still cake left from the birthday"],
    },
}

EVENT_META = {
    "asado": {"id": "the-barbecue", "title": "The barbecue of the year",
              "terms": r"barbecue|\bbbq\b|\bgrill|charcoal|sausage",
              "note": "An April Saturday at Tomi's: the grill, homemade chimichurri and the photo that still goes "
                      "around."},
    "mundial": {"id": "the-final", "title": "The World Cup final", "terms": r"world cup|the final|penalties|the game",
                "note": "Everyone watched the final together, lucky charms included and nobody leaving their seat."},
    "cumple": {"id": "caros-birthday", "title": "Caro's birthday", "terms": r"birthday|cake|present|gift",
               "note": "The group's longest party: cake, a present from everyone and dancing until 4."},
}

LORE = [
    ("piroola", ["that's a piroola", "what a piroola of an idea", "total piroola", "this deserves a piroola",
                 "<that|yesterday|your idea> was a piroola <for real|honestly|totally>"]),
    ("zorzle", ["gonna zorzle for <a bit|an hour|a sec>", "zorzle time",
                "nothing like a zorzle after <lunch|dinner|a barbecue>",
                "do not disturb, about to zorzle", "off to zorzle"]),
    ("chimichatter", ["come over for some chimichatter, I have <news|gossip|updates>", "enough chimichatter",
                      "we stayed for chimichatter until <late|3am|forever>", "chimichatter time"]),
    ("bombolo", ["what a bombolo that was", "traffic is a total bombolo",
                 "the <house|kitchen|office> is a bombolo", "huge bombolo"]),
    ("tarlips", ["no tarlips <this month|today|at all>", "we need to save tarlips for the <trip|barbecue|gift>",
                 "how many tarlips is that?", "zero tarlips"]),
    ("frunchy", ["don't be frunchy", "the most frunchy one in the <group|block|universe>",
                 "total frunchy, didn't <dare|jump|go for it>", "so frunchy"]),
    ("guasafest", ["there's a guasafest on Saturday", "what a guasafest <last night|yesterday|that was>",
                   "let's throw a guasafest", "guasafest at <Flor's|Juli's|Caro's>"]),
    ("flonk", ["pass me that flonk", "the <car|bathroom|oven> flonk broke",
               "bought a flonk for the <kitchen|bike|grill>", "that flonk"]),
    ("brolapse", ["a brolapse for everyone", "sending you a brolapse", "group brolapse now",
                  "<huge|massive|a> brolapse <for you|bear style|for all>"]),
    ("pistuncho", ["the pistuncho won't start <again|one more time|even pushing>", "let's take the pistuncho",
                   "the pistuncho survives anything", "<long live|go|respect> the pistuncho"]),
    ("grumbo", ["you're such a grumbo", "the grumbo ate <everything|the cake|the sausages>", "feeling grumbo today",
                "total grumbo"]),
    ("snorkfest", ["a snorkfest at <work|the building|the bank> today", "small snorkfest with the <rent|bank|car>",
                   "what a snorkfest with the <schedules|shifts|payments>", "mini snorkfest"]),
]

CATCH = {
    "Ana": ("people please focus", "let's get organized"),
    "Tomi": ("absolute fire", "full send tonight"),
    "Lucas": ("easy easy", "trust me on this"),
    "Bruno": ("i called it", "you guys are unbelievable"),
    "Caro": ("so cute", "dying of love"),
    "Dani": ("morning fam", "rise and shine people"),
    "Flor": ("obsessed with this", "zero stress guys"),
    "Nico": ("who's still awake", "we'll see tomorrow"),
    "Juli": ("obviously yes", "sounds amazing to me"),
}

QUOTES = ("nobody zorzles without warning, that's the law", "whoever makes the bombolo cleans it up",
          "i don't get mad, i go zorzle in the park")
QUOTE_REPEAT = ["{q}", "like brujo says, {q}", 'Brujo said: "{q}"', '"{q}" said Bruno', "as Bruno says: {q}"]

COMPLAIN_EXIT = ("you didn't invite me to the movies?", "you didn't invite me to the hangout, thanks a lot",
                 "you didn't invite me to watch the game")
COMPLAIN = ["nobody told me anything", "you left me out again", "found out from the photos, without me",
            "always the same with you guys", "you forgot about me again", "nobody called me"]
ACCUSE = ["here comes brujo with the drama", "Bruno is upset again", "brujo don't be jealous",
          "Bruno making a scene again", "Brujo offended, a classic", "Bruno, no tantrums please"]
SCENE_REPLY = ["but we talked about it here", "it was last minute, sorry", "it wasn't on purpose",
               "it was in the group, read", "it was a spontaneous plan"]
BACK = ("I'm back, don't be mad", "ok, it's fine, sorry", "did you miss me?")
WELCOME_BACK = ["the prodigal son returns", "welcome back", "we knew you'd come back",
                "the one who leaves without being kicked comes back without being called"]

BAD_INSULT = ("idiot", "moron", "jerk", "dumbass")
BAD_EXCL = ("damn", "shit", "crap", "dammit")
BAD_FEMININE: dict[str, str] = {}
BAD_TEMPLATES = (("insult", "you absolute {w}"), ("insult", "stop it {w}"), ("insult", "{w}, I told you at 9"),
                 ("insult", "hey {w}, answer the phone"), ("excl", "{w}, forgot my keys"),
                 ("excl", "{w}, the power's out"), ("excl", "oh {w}, it's raining"), ("excl", "{w}, missed the bus"))
# short fallback when the template is used up: interjection + the swear word (insult / exclamation)
BAD_FALLBACK = {"insult": "<ugh|damn|man|dude> {w}", "excl": "<ugh|man|dude> {w}"}

LAUGHS = (
    ("haha", "hahaha", "hahahaha", "HAHAHA", "hahahahaha", "ahahaha", "hahah"),
    ("hehe", "hehehe", "hehe"),
    ("lol", "LOL", "lool"),
    ("lmao", "lmaooo", "LMAO", "lmfao"),
    ("xd", "xD", "xdd", "XD"),
    ("😂", "😂😂", "😂😂😂", "🤣"),
)

POLLS = (
    ("Barbecue on Saturday?", ("Yes", "No", "Depends on the weather")),
    ("What do we bring to the barbecue?", ("Steak", "Sausages", "Ribs", "Everything")),
    ("Movie or series on Friday?", ("Movie", "Series", "Let's go out")),
    ("Where do we celebrate Caro's birthday?", ("Ana's place", "The usual bar", "The park", "Tomi's place")),
    ("Where do we watch the game?", ("Lucas's place", "The bar", "Flor's place")),
    ("Getaway on the long weekend?", ("Coast", "Mountains", "Staying home")),
)

DOCS = (("budget.pdf", 2), ("barbecue-list.pdf", 1), ("tickets.pdf", 3), ("rent-receipt.pdf", 1),
        ("coast-trip.pdf", 2), ("birthday-menu.pdf", 1), ("world-cup-schedule.pdf", 4), ("football-rules.pdf", 2),
        ("chimichurri-recipe.pdf", 1), ("bus-timetable.pdf", 3))
PAGES = ("page", "pages")

BADWORDS_HEADER = ("# Swear words for the Language chapter: the language's generic ones plus the ones the fictional "
                   "chat uses.\n# One per line, lowercase, no accents. Lines with # are ignored.")

CONCLUSION = """We started out counting messages and ended up collecting stories: Tomi's chimichurri in April, the \
lucky charms of the final, Caro's cake that lasted a week and every door Bruno slammed, always followed by a "did you miss me?".

Some records are a little embarrassing and some words only we understand. Nobody outside knows what a piroola is or \
why a zorzle is sacred, and that is just fine.

May the next poll go to the barbecue too. See you at the park.

— Ana
"""
