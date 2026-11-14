"""Vocabulario del chat ficticio en castellano rioplatense. Mismas claves e índices que vocab_en (ver synth/cast.py).

Plantillas con huecos {day} {hour} {place} {food} {drink} {show} {num} {name}; {name} es otra persona del grupo
(nombre corto o apodo); `[o|a]` concuerda con quien escribe ("aburrid[o|a]"). Las listas genéricas no llevan
risas, puteadas, quejas ni palabras del lore: esas entran solo
por sus cupos (story.py), así los conteos de cada capítulo son los que la historia decide.
"""

SLOTS = {
    "day": ["el sábado", "el viernes", "el domingo", "mañana", "hoy", "el finde", "el jueves", "el lunes"],
    "hour": ["a las 8", "a las 9", "tipo 10", "a las 21", "a la tarde", "después de las 7", "a la una"],
    "place": ["el parque", "la plaza", "el bar de siempre", "lo de Tomi", "lo de Caro", "la costanera", "el club",
              "lo de Lucas", "la terraza de Flor"],
    "food": ["pizza", "empanadas", "milanesas", "sushi", "hamburguesas", "ravioles", "un guiso", "tacos",
             "choripanes", "medialunas"],
    "drink": ["birra", "fernet", "vino", "mate", "una coca", "helado"],
    "show": ["la serie nueva", "esa peli de terror", "el documental de los pulpos", "la de los zombies",
             "la novela turca", "la de abogados"],
    "num": ["2", "3", "4", "5", "10", "15", "20"],
}

TOPICS = {
    "plans": {
        "open": ["che, ¿qué hacemos {day}?", "gente, ¿salimos {day}?", "¿alguien se prende a algo {day}?",
                 "<propongo|qué tal una|y si hacemos una> juntada en {place} {day}",
                 "¿y si hacemos algo {day} <a la noche|tranqui|temprano>?"],
        "say": ["<yo|che, yo> puedo después de las <8|9|10>",
                "{day} no puedo, tengo <cumple familiar|un compromiso|turno>",
                "dale, en {place} {hour}", "yo llevo {drink}", "si es temprano me sumo",
                "voy pero me <voy|vuelvo|tomo el último> <temprano|antes|rápido>",
                "<llego|caigo> tarde pero <llego|caigo|voy>",
                "{place} me queda <lejísimo|a trasmano|re lejos> pero voy <igual|de todas formas|sí o sí>"],
        "ask": ["¿a qué hora?", "¿quiénes van?", "¿llevo algo?", "¿en lo de quién?"],
    },
    "football": {
        "open": ["¿vieron el partido de <anoche|ayer|del domingo>?",
                 "qué partido el de <ayer|anoche|hoy>, no lo <puedo|podía> <creer|entender>",
                 "¿quién se prende al fulbito {day}?", "faltan <dos|tres|uno> para el fulbito, <avisen|confirmen>"],
        "say": ["el árbitro nos <robó|perjudicó|tiró abajo>, <es así|no hay vuelta|clarísimo>",
                "jugamos <horrible|pésimo|muy mal> el <primer|segundo> tiempo",
                "ese gol fue una <obra de arte|pintura|locura>",
                "al arquero lo saco ya", "el segundo tiempo fue otra cosa",
                "con este <técnico|DT|plantel> no <llegamos|vamos> a <nada|ningún lado>",
                "me quedé afónic[o|a] <gritando|de tanto gritar|alentando>",
                "la cancha estaba <hecha un barro|imposible|como una pileta>"],
        "ask": ["¿quién lleva la pelota?", "¿cancha de 5 o de 7?", "¿a qué hora es el <partido|fulbito>?"],
    },
    "work": {
        "open": ["qué día <largo|pesado|eterno> en el laburo", "no saben la reunión que me <comí|bancamos|tuve> hoy",
                 "mañana arranco a las <7|6|8>, mátenme", "me cambiaron el horario <otra vez|de nuevo>"],
        "say": ["mi jefe no <entiende|sabe|cacha> nada", "estoy con mil cosas", "hoy salgo tarde seguro",
                "<tres|cuatro|dos> reuniones que podían ser un <mail|mensaje|audio>",
                "por suerte el <viernes|lunes|jueves> es feriado",
                "me tomo vacaciones en <marzo|enero|julio> sí o sí",
                "<teletrabajo|home office> hoy, en <pijama|ojotas|bata>",
                "el jefe quiere un <informe|presupuesto|reporte> para <ayer|hace una hora|ya>"],
        "ask": ["¿vos seguís en el mismo laburo?", "¿a qué hora salís?", "¿te pagaron el aguinaldo?"],
    },
    "food": {
        "open": ["tengo un hambre que me como <un caballo|una vaca|la mesa>", "¿pedimos {food}?",
                 "hice {food} y me <salió|quedó> <espectacular|buenísimo|de diez>",
                 "descubrí un lugar de {food} <buenísimo|bárbaro|baratísimo>"],
        "say": ["yo con {food} soy feliz",
                "la última vez que pedí <ahí|en ese lugar> tardó <dos horas|una vida|90 minutos>",
                "prefiero cocinar, sale <la mitad|más barato|re barato>", "hoy es día de {food}, no se discute",
                "comí tanto que no me puedo mover", "{food} con {drink}, plan perfecto", "pasame la receta",
                "el delivery <ya|hasta> me conoce por el nombre"],
        "ask": ["¿dónde lo compraste?", "¿cuánto salió?", "¿alguien sabe hacer {food}?"],
    },
    "shows": {
        "open": ["¿alguien vio {show}?", "terminé {show} <anoche|ayer|recién>, qué final",
                 "recomienden algo para ver, estoy aburrid[o|a]", "arranqué {show} y no <puedo|logro> parar"],
        "say": ["el primer capítulo es <lento|medio aburrido|flojo> pero después <engancha|mejora|explota>",
                "no me hagan spoiler <por favor|eh|que no la terminé>",
                "la segunda temporada es <mucho|bastante|re> mejor", "me dormí a la mitad",
                "el final me dejó loc[o|a]", "la vi en <dos|tres> días", "esa actriz es lo más",
                "la música de la serie es <tremenda|lo mejor|una joya>"],
        "ask": ["¿en qué plataforma está?", "¿cuántas temporadas tiene?", "¿vale la pena?"],
    },
    "weather": {
        "open": ["qué calor por favor", "se viene una tormenta <terrible|bárbara|de novela>",
                 "hace un frío de locos hoy", "¿vieron el pronóstico para <el finde|mañana|el sábado>?"],
        "say": ["salí sin paraguas y me <empapé|mojé entero|ahogué>", "en casa se cortó la luz",
                "ojalá llueva así refresca", "para {day} dicen que hay sol", "no doy más de la humedad",
                "ya saqué las camperas", "el ventilador no da abasto",
                "granizo en pleno <noviembre|verano|enero>, <cualquiera|qué locura|no entiendo nada>"],
        "ask": ["¿llueve allá?", "¿suspendemos si llueve?", "¿cuántos grados hace?"],
    },
    "music": {
        "open": ["pasen temas para el auto", "¿quién va al recital?",
                 "no puedo sacarme este tema de la cabeza", "armé una playlist para <el finde|el viaje|la juntada>"],
        "say": ["ese disco es una joya", "lo vi en vivo y es <otra cosa|otro nivel|tremendo>",
                "las entradas se agotaron en <diez|cinco|veinte> minutos",
                "tengo el tema en loop hace <tres|dos|cuatro> días",
                "el que pone la música en <la juntada|el auto|la previa> soy yo",
                "ese tema me <recuerda|lleva> a la <secundaria|facu|primaria>", "pónganlo fuerte",
                "el <bajista|baterista|cantante> es un genio"],
        "ask": ["¿cómo se llama ese tema?", "¿cuánto salen las entradas?", "¿alguien tiene una entrada de más?"],
    },
    "travel": {
        "open": ["¿y si nos vamos un finde a <la costa|las sierras|Mar del Plata>?",
                 "volví del viaje, qué <lindo|hermoso|bueno> todo", "encontré pasajes baratísimos",
                 "estoy armando las vacaciones, ¿alguien se <suma|copa|prende>?"],
        "say": ["la ruta estaba vacía", "el hotel era un desastre pero la pasamos <bien|bárbaro|genial>",
                "llevo el mate y <las galletitas|los bizcochitos|las facturas>",
                "salimos el <viernes|sábado|jueves> temprano",
                "la playa estaba <llena de gente|explotada|imposible>",
                "me <quemé|insolé|pelé> todo el <primer|segundo> día",
                "volvería mañana mismo", "el micro tardó <nueve|diez|doce> horas"],
        "ask": ["¿cuántos días se van?", "¿cuánto salió el pasaje?", "¿vamos en auto o en micro?"],
    },
    "money": {
        "open": ["todo aumentó otra vez", "fui al <súper|chino|mercado> y gasté una <fortuna|locura|millonada>",
                 "este mes estoy re ajustad[o|a]",
                 "me llegó el resumen de la tarjeta y casi me <desmayo|muero|infarto>"],
        "say": ["hay que ahorrar en algo", "el <alquiler|gas|cable> subió un <montón|disparate|40%>",
                "cobro el 5, aguanten",
                "ya no salgo a comer afuera", "cada vez rinde menos el sueldo",
                "me <puse|largué> a hacer una <planilla|lista|tabla> de <gastos|cuentas|todo>",
                "vendo la <bici|tele|guitarra> si alguien quiere",
                "el café de la esquina sale como un <almuerzo|asado|sueldo>"],
        "ask": ["¿cuánto te cobraron?", "¿me prestás hasta el viernes?",
                "¿alguien sabe de un <plomero|gasista|electricista> barato?"],
    },
    "pets": {
        "open": ["el cachorro me rompió <las zapatillas|el sillón|un almohadón> otra vez", "adopté un gatito",
                 "miren lo que hizo la gata", "¿alguien me cuida el cachorro <el finde|el sábado|unos días>?"],
        "say": ["duerme todo el día, <lo envidio|qué vida|quiero ser él>",
                "lo llevé al veterinario y está <bien|joya|perfecto>",
                "se comió media pizza", "no para de <maullar|llorar|ladrar> a las <5|6|4>",
                "es el más <mimoso|lindo|dormilón> del <mundo|barrio|planeta>",
                "ya <aprendió|sabe> a <dar la pata|sentarse|traer la pelota>",
                ("le <compré|regalé|armé> una <manta|cama|camita> nueva y <duerme|se acuesta|se tira> "
                 "<afuera|en el piso|en mi cama>"),
                "le tiene <miedo|pánico|terror> a la <aspiradora|licuadora|escoba>"],
        "ask": ["¿cómo se llama?", "¿qué edad tiene?", "¿qué come?"],
    },
    "gossip": {
        "open": ["no saben a quién me crucé <hoy|ayer|en el súper>", "tengo un chisme buenísimo",
                 "¿se enteraron de lo de la vecina?", "adivinen quién me escribió"],
        "say": ["no lo puedo contar acá", "se los cuento en persona", "yo lo sabía desde antes",
                "eso no termina bien", "me lo dijo una fuente <confiable|segura|muy cercana>", "es todo muy raro",
                "después les paso los detalles", "la vecina sabe todo de <todos|todo el barrio|cada uno>"],
        "ask": ["¿quién te contó?", "¿en serio?", "¿y qué le dijiste?"],
    },
    "health": {
        "open": ["estoy <resfriad[o|a]|engripad[o|a]|hech[o|a] pelota>, no salgo de la <cama|casa|pieza>",
                 "arranqué <el gimnasio|crossfit|natación>, deséenme suerte",
                 "me duele <todo|hasta el pelo|cada músculo> de ayer",
                 "hoy salí a correr <cinco|tres|ocho> kilómetros"],
        "say": ["tomé un té con <miel|limón|jengibre> y nada", "el lunes arranco la dieta", "dormí doce horas",
                "me <hice|llegaron> los estudios y está todo <bien|joya|en orden>",
                "el profe del gimnasio es un <sargento|militar|tirano>",
                "camino al laburo y llego muert[o|a]", "hay que dormir más", "me tomé el día, no doy más"],
        "ask": ["¿fuiste al médico?", "¿a qué gimnasio vas?", "¿ya estás mejor?"],
    },
}

GENERIC = {
    "answer": ["a las 9", "yo voy", "ni idea", "creo que sí", "no sé, preguntale a {name}", "en un rato te digo",
               "mañana te confirmo", "sí, obvio", "no, ni loc[o|a]", "dale, yo me encargo", "depende del clima",
               "me fijo y te aviso", "no tengo idea, <la verdad|posta|ni la menor>", "eso dijeron", "ahí lo veo",
               "{name} sabe", "creo que {day}", "como {num} lucas"],
    "react": ["dale", "de una", "posta?", "ni en pedo", "uff", "qué bueno", "noo", "tal cual", "una locura",
              "bien ahí", "qué lindo", "naaa", "en serio?", "jodeme", "es así", "uff qué bajón", "me encanta",
              "genial", "qué garrón", "joya", "listo", "qué buena", "ah bueno", "épico", "grande", "vamos",
              "nooo no puedo", "mal ahí", "ufa", "ok", "sí", "re", "obvio", "ya fue", "qué onda eso"],
    "agree": ["lo mismo digo", "tal cual lo que dice {name}", "totalmente", "es lo que digo yo", "banco a {name}",
              "estoy con {name}", "pienso igual"],
    "disagree": ["nada que ver", "no estoy de acuerdo", "para mí no", "no sé eh", "mmm no"],
    "morning": ["buenas, ¿cómo amanecieron?", "ya estoy en el colectivo", "primer mate del día",
                "me levanté a las 6 y ya <corrí|entrené|fui al súper>", "qué lindo amanecer hoy",
                "salgo a correr, nos vemos", "buen día, ¿alguien más <madrugó|se levantó|está despierto>?",
                "café y a laburar"],
    "night": ["no me puedo dormir", "estoy viendo videos de <gatos|cocina|accidentes> a las <3|2|4>",
              "mañana me arrepiento de esto", "se me fue el sueño", "último mensaje y me duermo",
              "escucho ruidos raros afuera", "me comí todo lo que había en <la heladera|la alacena|casa>",
              "¿alguien sigue por acá?"],
    "joke": ["me caí de la <bici|vereda|escalera> delante de <todo el colectivo|medio barrio|mi jefe>",
             "le dije '<igualmente|vos también|gracias, igual>' al mozo cuando me dijo buen provecho",
             "mi abuela me reenvió <7|9|12> fotos de flores para desearme buen <lunes|martes|jueves>",
             "saludé a uno que no me saludaba a mí, <qué vergüenza|me quiero morir|tierra trágame>",
             "me quedé encerrad[o|a] en el baño <del laburo|de un bar|del gimnasio>",
             "fui al <súper|chino|mercado> con la lista y <volví|salí> con <todo|cualquier cosa> menos lo de la lista",
             "le puse sal al <café|mate|té> <sin querer|otra vez|y me lo tomé igual>",
             "el cachorro me miró con cara de <decepción|lástima|vergüenza ajena>",
             "le respondí al <jefe|grupo de la familia|portero> con un sticker sin querer",
             "me dormí en el colectivo y terminé en <otro barrio|la terminal|Tigre>",
             "me probé la campera de {name} y me queda de <vestido|carpa|capa>",
             "<hoy|ayer> le hablé a la heladera pensando que era <mi vieja|el contestador|Alexa>",
             "pedí un <café|cortado|jugo> y me trajeron <una milanesa|un licuado|la cuenta>",
             "me metí al grupo equivocado y mandé <el audio|la foto|la lista> del asado",
             "estuve diez minutos buscando el celular <con el celular en la mano|mientras hablaba por teléfono>"],
    "laugh_tail": ["no puedo más", "me muero", "lloro", "estoy llorando", "posta", "no da", "basta", "genio",
                   "qué personaje", "te amo"],
    "poll_react": ["ya voté", "voten gente", "falta que voten tres", "esta encuesta está arreglada",
                   "voté lo que dijo {name}"],
    "welcome": ["bienvenidos al grupo, acá se organizan los asados", "qué lindo grupo", "gracias por sumarme",
                "por fin un grupo serio"],
}

# Muletillas de discurso que story.pick suma al reintentar (una oración larga ya gastada vuelve con otro arranque o
# cierre, como se escribe de verdad).
DECOR = {
    "pre": ["che,", "igual", "bueno,", "posta,", "uff,", "nada,", "mirá,", "la verdad,", "ah,", "eh,", "che no,",
            "ojo,", "tipo,", "o sea,"],
    "post": [", posta", ", eh", ", che", ", lo firmo", ", en serio", ", la verdad", ", nada más", ", viste",
             ", ojo", ", qué sé yo", ", no sé"],
}

LISTS = {
    "header": ["lista de cosas:", "lo que falta:", "para el finde:", "compras:"],
    "items": ["carbón", "hielo", "pan", "chorizos", "vacío", "papas", "ensalada", "birra", "fernet", "coca",
              "servilletas", "vasos", "postre", "mayonesa", "limones", "carbón de más"],
}

EVENTS = {
    "asado": {
        "open": ["¿qué onda el asado del sábado?", "confirmen para el asado así <compro|organizo|hago la lista>",
                 "hoy asado en lo de Tomi, no <falten|se lo pierdan|lleguen tarde>"],
        "say": ["yo llevo el vacío", "prendan el fuego que llego en <diez|cinco|quince>",
                "el asado arranca a la <una|dos|una y media>", "traje carbón de más por las dudas",
                "qué asado gente, una locura", "el chimichurri lo hice yo", "no queda ni un chori",
                "Tomi es el mejor asador del <mundo|barrio|universo>",
                "la previa del asado ya <empezó|arrancó|está a full>",
                "esa parrilla tiene más años que <nosotros|el grupo|mi abuela>"],
        "ask": ["¿quién lleva el carbón?", "¿cuánta carne llevamos?", "¿a qué hora es el asado?"],
        "memory": ["como en el asado de <abril|lo de Tomi|aquella vez>",
                   "ese asado fue el mejor <del año|de la historia|de todos>",
                   "todavía me acuerdo del asado en lo de Tomi", "hay que repetir el asado de <abril|lo de Tomi>"],
    },
    "mundial": {
        "open": ["hoy es la final del mundial, no se <olviden|duerman|lo pierdan>", "¿dónde vemos la final?",
                 "nervios por la final, no dormí"],
        "say": ["llevo las cábalas de siempre", "nadie se mueve de su lugar en el <partido|segundo tiempo|alargue>",
                "no puedo mirar los penales", "qué final por favor", "estoy temblando",
                "este mundial lo vimos todos juntos", "voy a llorar", "dale dale dale", "esto es historia pura",
                "el partido de mi vida"],
        "ask": ["¿quién trae la camiseta de la suerte?", "¿a qué hora arranca la final?",
                "¿salimos a festejar después del partido?"],
        "memory": ["como en la final del mundial", "todavía tengo la voz rota de la final",
                   "nada supera ver la final del mundial <juntos|en lo de Lucas|con ustedes>",
                   "las fotos de la final del mundial son <lo más|lo mejor|historia>"],
    },
    "cumple": {
        "open": ["mañana es el cumple de Caro, ¿qué le <regalamos|damos|llevamos>?", "feliz cumple Caro!!! 🎂",
                 "hoy festejamos el cumple, no falten"],
        "say": ["la torta la llevo yo", "el regalo ya está", "que los cumplas feliz", "¡feliz cumple!",
                "pongan plata para el regalo", "qué lindo festejo", "la torta estaba increíble",
                "bailamos hasta las 4", "el regalo le encantó", "hay torta para <una semana|un mes|todo el barrio>"],
        "ask": ["¿a qué hora es el cumple?", "¿quién lleva la torta?",
                "¿cuánto ponemos para el <regalo|cumple|regalo de Caro>?"],
        "memory": ["como en el cumple de Caro", "el cumple de Caro fue <épico|lo más|una fiesta>",
                   "las fotos del cumple son lo más", "todavía queda torta del cumple"],
    },
}

EVENT_META = {
    "asado": {"id": "el-asado", "title": "El asado del año", "terms": r"\basado|parrilla|chori|carb[oó]n|vac[ií]o\b",
              "note": "Un sábado de abril en lo de Tomi: la parrilla, el chimichurri casero y la foto que todavía "
                      "circula."},
    "mundial": {"id": "la-final", "title": "La final del Mundial", "terms": r"mundial|la final|penales|partido",
                "note": "La final se vio todos juntos, con las cábalas de siempre y nadie moviéndose de su lugar."},
    "cumple": {"id": "cumple-caro", "title": "El cumple de Caro", "terms": r"cumple|torta|regalo",
               "note": "El festejo más largo del grupo: torta, regalo entre todos y baile hasta las 4."},
}

# Lore: 12 palabras inventadas del grupo (vocab_en tiene las suyas en el mismo orden), con sus frases.
LORE = [
    ("pirulazo", ["eso es un pirulazo", "qué pirulazo de idea", "un pirulazo total", "esto merece un pirulazo",
                  "<eso|lo de ayer|tu idea> fue un pirulazo <eh|posta|total>"]),
    ("zorzalear", ["me voy a zorzalear <un rato|una horita|un toque>", "hoy toca zorzalear",
                   "nada como zorzalear después de <comer|almorzar|un asado>",
                   "no me molesten que estoy por zorzalear", "a zorzalear se ha dicho"]),
    ("chimichurrear", ["vengan a chimichurrear que tengo <novedades|un chisme|noticias>", "basta de chimichurrear",
                       "nos quedamos a chimichurrear hasta <tarde|las 3|cualquier hora>", "a chimichurrear"]),
    ("bombolón", ["qué bombolón se armó", "el tránsito es un bombolón",
                  "la <casa|cocina|oficina> quedó hecha un bombolón", "flor de bombolón"]),
    ("tarlipes", ["no tengo tarlipes <este mes|hoy|para nada>", "hay que juntar tarlipes para el <viaje|asado|regalo>",
                  "¿cuántos tarlipes sale eso?", "cero tarlipes"]),
    ("fruncheta", ["no seas fruncheta", "el más fruncheta del <grupo|barrio|universo>",
                   "fruncheta total, no se <animó|tiró|atrevió>", "qué fruncheta"]),
    ("guasafa", ["el sábado hay guasafa", "qué guasafa la de <anoche|ayer|aquella vez>", "armemos una guasafa",
                 "guasafa en lo de <Flor|Juli|Caro>"]),
    ("menganeta", ["pasame la menganeta esa", "se me rompió la menganeta del <auto|baño|horno>",
                   "compré una menganeta para la <cocina|bici|parrilla>", "esa menganeta"]),
    ("brolazo", ["un brolazo para todos", "te mando un brolazo", "brolazo grupal ya",
                 "<flor de|tremendo|un> brolazo <para vos|de oso|grupal>"]),
    ("pistuncho", ["el pistuncho no arranca <otra vez|de nuevo|ni empujando>", "vamos en el pistuncho",
                   "el pistuncho aguanta todo", "<viva|grande|aguante> el pistuncho"]),
    ("morfilón", ["sos un morfilón", "el morfilón se comió <todo|la torta|los choris>", "hoy estoy morfilón",
                  "qué morfilón"]),
    ("quilombete", ["se armó un quilombete en el <laburo|edificio|consorcio>",
                    "un quilombete bárbaro con el <alquiler|banco|auto>",
                    "qué quilombete con los <horarios|turnos|pagos>", "mini quilombete"]),
]

# Muletillas: dos frases por persona (pasan web.language.is_candidate: 2-5 palabras, sin nombres, no genéricas).
CATCH = {
    "Ana": ("vamos ordenando", "no me hagan esto"),
    "Tomi": ("fuego total", "arranquemos con todo"),
    "Lucas": ("tranqui tranqui", "posta te digo"),
    "Bruno": ("yo avisé eh", "cualquiera ustedes"),
    "Caro": ("qué divino", "me muero de amor"),
    "Dani": ("buen día familia", "arriba que se hace tarde"),
    "Flor": ("ay no puedo", "cero estrés chicos"),
    "Nico": ("quién está despierto", "mañana lo vemos"),
    "Juli": ("obvio que sí", "me parece bárbaro"),
}

# Frases de Bruno que el grupo repite (capítulo de salidas, "citas"); cada una lleva una palabra rara.
QUOTES = ("acá nadie zorzalea sin avisar, eso es ley", "el que arma el bombolón después lo limpia",
          "yo no me enojo, me voy a zorzalear al parque")
QUOTE_REPEAT = ["{q}", "como dice el brujo, {q}", 'el Brujo dijo: "{q}"', '"{q}" dijo Bruno',
                "ya lo dijo Bruno: {q}"]

# Escenas de las salidas de Bruno (patrones en wa.lang.es.departures).
COMPLAIN_EXIT = ("¿fueron al cine y no me invitan? bárbaro", "la juntada la hicieron sin mí, gracias eh",
                 "el partido lo ven sin mí, ya sé que no me invitan")
COMPLAIN = ["nadie me avisó nada", "me dejaron afuera otra vez", "me entero por las fotos, gracias eh",
            "siempre lo mismo con ustedes", "me olvidaron de nuevo", "otra vez sin mí, qué lindo"]
ACCUSE = ["ya está el brujo con la escena", "Bruno se enojó otra vez", "brujo no te pongas celoso",
          "otra vez el drama de Bruno", "el Brujo ofendido, un clásico", "Bruno, no hagas escena"]
SCENE_REPLY = ["pero si lo hablamos acá", "fue de última, perdón", "no fue a propósito", "estaba en el grupo, leé",
               "fue un plan improvisado"]
BACK = ("volví, no se enojen", "bueno, ya está, perdón", "¿me extrañaron?")
WELCOME_BACK = ["volvió el hijo pródigo", "bienvenido de nuevo", "ya sabíamos que volvías",
                "llegó el que trae las facturas"]

# Puteadas suaves (todas de wa.lang.es.BADWORDS_BASE).
BAD_INSULT = ("boludo", "pelotudo", "gil", "tarado", "forro")
BAD_EXCL = ("carajo", "mierda", "puta madre", "cagada")
BAD_FEMININE = {"boludo": "boluda", "pelotudo": "pelotuda", "tarado": "tarada", "forro": "forra", "gil": "gila"}
BAD_TEMPLATES = (("insult", "no seas {w}"), ("insult_self", "qué {w} que soy"), ("insult", "{w}, te dije a las 9"),
                 ("insult", "che {w}, contestá"), ("excl", "{w}, me olvidé las llaves"),
                 ("excl", "{w}, se cortó la luz"), ("excl", "uh {w}, llueve"), ("excl", "{w}, perdí el colectivo"))
# respaldo corto cuando la plantilla ya se usó demasiado: interjección + la puteada (insulto / exclamación)
BAD_FALLBACK = {"insult": "<che|uy|ay> {w}", "excl": "<uh|ay|uff> {w}"}

LAUGHS = (
    ("jaja", "jajaja", "jajajaja", "JAJAJA", "jajajajaja", "jajaj", "jajajja"),
    ("jsjs", "jsjsjs", "jsjsjsjs"),
    ("jeje", "jejeje", "jejeje"),
    ("jiji", "jijiji"),
    ("xd", "xD", "xdd", "XD"),
    ("😂", "😂😂", "😂😂😂", "🤣"),
)

POLLS = (
    ("¿Asado el sábado?", ("Sí", "No", "Depende del clima")),
    ("¿Qué llevamos al asado?", ("Vacío", "Chorizos", "Matambre", "De todo")),
    ("¿Peli o serie el viernes?", ("Peli", "Serie", "Salimos")),
    ("¿Dónde festejamos el cumple de Caro?", ("Lo de Ana", "El bar de siempre", "El parque", "Lo de Tomi")),
    ("¿Dónde vemos el partido?", ("Lo de Lucas", "El bar", "Lo de Flor")),
    ("¿Escapada el finde largo?", ("Costa", "Sierras", "Me quedo")),
)

DOCS = (("presupuesto.pdf", 2), ("lista-asado.pdf", 1), ("entradas.pdf", 3), ("recibo-alquiler.pdf", 1),
        ("pasajes-costa.pdf", 2), ("menu-cumple.pdf", 1), ("fixture-mundial.pdf", 4), ("reglamento-fulbito.pdf", 2),
        ("receta-chimichurri.pdf", 1), ("horarios-micro.pdf", 3))
PAGES = ("página", "páginas")

BADWORDS_HEADER = ("# Puteadas para el capítulo Lenguaje: las genéricas del idioma más las que usa el chat ficticio.\n"
                   "# Una por línea, minúscula y sin tildes. Las líneas con # se ignoran.")

CONCLUSION = """Arrancamos contando mensajes y terminamos juntando historias: el chimichurri de Tomi en abril, las \
cábalas de la final, la torta de Caro que duró una semana y cada portazo de Bruno, siempre seguido de un "¿me extrañaron?".

Hay récords que dan un poco de vergüenza y palabras que solo entendemos nosotros. Nadie de afuera sabe qué es un \
pirulazo ni por qué zorzalear es sagrado, y está perfecto así.

Que la próxima encuesta también la gane el asado. Nos vemos en el parque.

— Ana
"""
