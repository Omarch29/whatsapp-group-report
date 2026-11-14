import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from wa.locales import LOCALES  # noqa: E402
from wa.parser import Message, classify, detect_format, iter_messages, parse_file  # noqa: E402

FORMATS = Path(__file__).resolve().parent / "fixtures" / "formats"
EDIT_MARKS = {"es": "<Se editó este mensaje.>", "en": "<This message was edited>"}

LRM = "‎"
NB = " "


def parse(text: str):
    return list(iter_messages(text.splitlines(keepends=True)))


def test_basic_text_with_narrow_spaces():
    msgs = parse(f"[1/9/23, 12:08:49{NB}p.{NB}m.] Ana Rivas: traigan sillas plegables\r\n")
    assert len(msgs) == 1
    m = msgs[0]
    assert m.sender == "Ana Rivas"
    assert m.body == "traigan sillas plegables"
    assert m.kind == "text"
    assert (m.ts.year, m.ts.month, m.ts.day, m.ts.hour, m.ts.minute) == (2023, 9, 1, 12, 8)


def test_am_pm_conversion():
    msgs = parse(
        "[3/2/17, 12:30:04 a. m.] A: x\n"
        "[3/2/17, 1:00:05 p. m.] A: y\n"
        "[3/2/17, 12:30:04 p. m.] A: z\n"
    )
    assert [m.ts.hour for m in msgs] == [0, 13, 12]


def test_media_with_leading_lrm():
    msgs = parse(f"{LRM}[8/11/23, 11:23:48{NB}p.{NB}m.] Ana Rivas: {LRM}imagen omitida\n")
    assert msgs[0].kind == "image"
    assert msgs[0].body == ""
    assert msgs[0].caption is False


def test_media_with_caption():
    msgs = parse(f"{LRM}[8/11/26, 9:22:31{NB}p.{NB}m.] Rodrigo: Miren la tortita {LRM}imagen omitida\n")
    assert msgs[0].kind == "image"
    assert msgs[0].body == "Miren la tortita"
    assert msgs[0].caption is True


def test_multiline_and_poll():
    text = (
        f"[1/9/23, 12:08:49{NB}p.{NB}m.] Tomi: {LRM}ENCUESTA:\n"
        f"{LRM}OPCIÓN: Si (3 votos)\n"
        f"{LRM}OPCIÓN: No (0 votos)\n"
        f"[1/9/23, 12:09:00{NB}p.{NB}m.] Ana Rivas: ok\n"
    )
    msgs = parse(text)
    assert len(msgs) == 2
    assert msgs[0].kind == "poll"
    assert msgs[0].body == "POLL:\nOPTION: Si (3)\nOPTION: No (0)"  # formato canónico, el mismo en todo idioma
    assert msgs[1].body == "ok"


def test_system_messages():
    text = (
        f"[1/9/23, 12:09:52{NB}p.{NB}m.] Lalo: {LRM}Tomi quitó a Lalo.\n"
        f"[1/9/23, 12:09:52{NB}p.{NB}m.] Grupo: {LRM}Los mensajes y las llamadas están cifrados de extremo a extremo.\n"
    )
    msgs = parse(text)
    assert [m.kind for m in msgs] == ["system", "system"]


def test_edited_and_deleted():
    text = (
        f"[1/9/23, 12:09:52{NB}p.{NB}m.] A: hola {LRM}<Se editó este mensaje.>\n"
        f"[1/9/23, 12:09:53{NB}p.{NB}m.] A: {LRM}Se eliminó este mensaje.\n"
    )
    msgs = parse(text)
    assert msgs[0].kind == "text" and msgs[0].edited and msgs[0].body == "hola"
    assert msgs[1].kind == "deleted"


def test_mention_is_text():
    msgs = parse(f"[1/9/23, 12:09:52{NB}p.{NB}m.] A: @{LRM}todos⁩ vengan\n")
    assert msgs[0].kind == "text"
    assert "todos" in msgs[0].body


def test_text_after_mention_is_not_system():
    """Un mensaje escrito por una persona con una mención ("@‎Tomi⁩ left") nunca es un aviso del sistema: los avisos
    reales empiezan con el LRM."""
    es = parse(f"[1/9/23, 12:09:52{NB}p.{NB}m.] Ana Rivas: @{LRM}Tomi⁩ salió del grupo\n")
    assert (es[0].kind, es[0].sys_event) == ("text", "")
    loc = LOCALES[("ios", "en")]
    en = list(iter_messages([f"[1/9/23, 12:09:52{NB}PM] Ana: @{LRM}Tomi⁩ left\n"], loc, "mdy"))
    assert (en[0].kind, en[0].sys_event) == ("text", "")
    real = list(iter_messages([f"[1/9/23, 12:09:52{NB}PM] Ana: {LRM}Tomi left\n"], loc, "mdy"))
    assert (real[0].kind, real[0].sys_event, real[0].sys_who) == ("system", "left", "Tomi")


def test_ios_es_you_created_the_group():
    es = LOCALES[("ios", "es")]
    assert classify(f"{LRM}Creaste este grupo", es).sys == ("created", "", "__you__")
    assert classify(f"{LRM}Creaste el grupo “Los del Parque”", es).sys == ("created", "Los del Parque", "__you__")


@pytest.mark.parametrize("name", ["ios-es", "ios-en", "android-es", "android-en", "ios-es-24h"])
def test_fixture_messages_normalized(name):
    msgs = list(parse_file(str(FORMATS / f"{name}.txt")))
    kinds = {m.kind for m in msgs}
    assert {"text", "system", "deleted", "poll"} <= kinds
    assert ("media" in kinds) == name.startswith("android")
    sys_events = [m.sys_event for m in msgs if m.kind == "system"]
    assert {"created", "added", "joined_link", "left", "removed", "name_changed", "photo_changed"} <= set(sys_events)
    poll = next(m for m in msgs if m.kind == "poll")
    assert poll.body.startswith("POLL:\n") and "OPTION: " in poll.body and poll.body.count("(") == 2
    edited = [m for m in msgs if m.edited]
    assert len(edited) == 1 and EDIT_MARKS[name.split("-")[1]] not in edited[0].body and edited[0].kind == "text"
    added = next(m for m in msgs if m.sys_event == "added")
    assert added.sys_who == "Bruno" and added.sys_by == "Ana"
    you = next(m for m in msgs if m.sys_event == "added" and m.sys_by == "__you__")
    assert you.sys_who == "Caro"
    assert all(m.sys_event == m.sys_who == m.sys_by == "" for m in msgs if m.kind != "system")


@pytest.mark.parametrize("name", ["ios-es", "ios-en", "android-es", "android-en", "ios-es-24h"])
def test_fixtures_tell_the_same_story(name):
    """Los cinco fixtures son la misma charla: mismas horas, remitentes, tipos y eventos en cada formato."""
    msgs = list(parse_file(str(FORMATS / f"{name}.txt")))
    assert len(msgs) == 30
    assert (msgs[0].ts.year, msgs[0].ts.month, msgs[0].ts.day, msgs[0].ts.hour) == (2026, 10, 13, 9)
    assert (msgs[13].ts.day, msgs[13].ts.hour, msgs[13].ts.minute) == (14, 20, 15)  # 8:15 p. m.
    assert [m.sys_event for m in msgs if m.kind == "system"] == [
        "encryption", "created", "added", "added", "added", "joined_link", "left", "joined_link", "removed",
        "name_changed", "photo_changed"]
    multi = msgs[9]
    assert multi.sender == "Lucas" and multi.kind == "text" and multi.body.count("\n") == 2
    loc = next(m for m in msgs if m.kind == "location")
    assert loc.body.lower().startswith(("ubicación: https://maps.google.com", "location: https://maps.google.com"))
    deleted = [m for m in msgs if m.kind == "deleted"]
    assert [m.sender for m in deleted] == ["Bruno", "Ana"] and all(m.body == "" for m in deleted)
    left = next(m for m in msgs if m.sys_event == "left")
    assert left.sys_who == "Bruno" and left.sys_by == ""
    removed = next(m for m in msgs if m.sys_event == "removed")
    assert (removed.sys_who, removed.sys_by) == ("Bruno", "Ana")
    renamed = next(m for m in msgs if m.sys_event == "name_changed")
    assert (renamed.sys_who, renamed.sys_by) == ("Los del Parque 🌳", "Tomi")  # sys_who = el nombre nuevo
    assert next(m for m in msgs if m.sys_event == "photo_changed").sys_by == "Caro"
    assert next(m for m in msgs if m.sys_event == "joined_link").sys_who == "Lucas"
    mention = msgs[18]
    assert mention.kind == "text" and "Tomi" in mention.body


def test_ios_media_kinds_and_poll_canonical():
    es_kinds = [m.kind for m in parse_file(str(FORMATS / "ios-es.txt"))]
    assert es_kinds[10:18] == ["image", "audio", "sticker", "video", "gif", "video_note", "document", "contact"]
    msgs = list(parse_file(str(FORMATS / "ios-en.txt")))
    assert [m.kind for m in msgs[10:18]] == ["image", "audio", "sticker", "video", "gif", "video_note", "document",
                                             "contact"]
    assert (msgs[16].body, msgs[16].caption) == ("budget.pdf •", True)  # el nombre del archivo queda como caption
    poll = next(m for m in msgs if m.kind == "poll")
    assert poll.body == "POLL:\nBarbecue on Saturday?\nOPTION: Yes (3)\nOPTION: No (1)"
    android_poll = next(m for m in parse_file(str(FORMATS / "android-es.txt")) if m.kind == "poll")
    assert android_poll.body == "POLL:\n¿Asado el sábado?\nOPTION: Sí (3)\nOPTION: No (1)"


def test_android_system_line_without_sender():
    msgs = list(parse_file(str(FORMATS / "android-es.txt")))
    s = [m for m in msgs if m.sys_event == "added"][0]
    assert s.sender == "__system__" and s.kind == "system"
    assert all(m.sender == "__system__" for m in msgs if m.kind == "system")
    assert msgs[1].body == 'Ana creó el grupo "Los del Asado"' and msgs[1].sys_who == "Los del Asado"


def test_android_unknown_system_line_is_other():
    loc = LOCALES[("android", "en")]
    msgs = list(iter_messages(["11/13/26, 2:05 PM - Ana did something new", "11/13/26, 2:06 PM - Ana: hi"], loc, "mdy"))
    assert [(m.kind, m.sys_event, m.sender) for m in msgs] == [("system", "other", "__system__"), ("text", "", "Ana")]


def test_android_media_with_caption():
    loc = LOCALES[("android", "es")]
    msgs = list(iter_messages(["13/11/26 14:05 - Caro: <Multimedia omitido> mirá esto"], loc, "dmy"))
    assert (msgs[0].kind, msgs[0].body, msgs[0].caption) == ("media", "mirá esto", True)


def test_you_as_object_and_subject():
    ios_es, ios_en = LOCALES[("ios", "es")], LOCALES[("ios", "en")]
    assert classify("‎Tomi te añadió.", ios_es).sys == ("added", "__you__", "Tomi")
    assert classify("‎Saliste del grupo.", ios_es).sys == ("left", "__you__", "")
    assert classify("‎Ana added you", ios_en).sys == ("added", "__you__", "Ana")
    assert classify("‎You removed Bruno", ios_en).sys == ("removed", "Bruno", "__you__")
    k = classify("‎Ana añadió a Bruno.", ios_es)
    assert (k.kind, k.body, k.edited, k.caption, k.sys) == ("system", "Ana añadió a Bruno.", False, False,
                                                             ("added", "Bruno", "Ana"))
    assert classify("hola", ios_es).sys == ("", "", "")


def test_parse_file_with_explicit_locale_and_order(tmp_path):
    f = tmp_path / "chat.txt"
    f.write_text("[1/2/26, 10:00:00 PM] Ana: hi\n", encoding="utf-8")
    msgs = list(parse_file(str(f), locale=LOCALES[("ios", "en")], date_order="mdy"))
    assert (msgs[0].ts.month, msgs[0].ts.day, msgs[0].ts.hour) == (1, 2, 22)


def test_ambiguous_head_is_settled_by_the_rest_of_the_file(tmp_path):
    """Las primeras 50 líneas no deciden el orden; el resto del archivo sí: 2/13 solo puede ser m/d."""
    lines = [f"[1/2/26, 10:{i:02d}:00 AM] Ana: hola {i}" for i in range(55)] + ["[2/13/26, 9:00:00 AM] Ana: chau"]
    f = tmp_path / "chat.txt"
    f.write_text("\n".join(lines) + "\n", encoding="utf-8")
    assert detect_format(str(f))["date_order"] == "mdy"
    msgs = list(parse_file(str(f)))
    assert (msgs[0].ts.month, msgs[0].ts.day) == (1, 2) and (msgs[-1].ts.month, msgs[-1].ts.day) == (2, 13)


def test_detect_format_reports_verified_flag():
    assert detect_format(str(FORMATS / "ios-es.txt")) == {"platform": "ios", "lang": "es", "date_order": "dmy",
                                                          "verified": True}
    assert detect_format(str(FORMATS / "android-en.txt"))["verified"] is False


def test_message_new_fields_default_empty():
    from datetime import datetime

    m = Message(datetime(2026, 1, 1), "Ana", "hola", "text", False, False)
    assert (m.sys_event, m.sys_who, m.sys_by) == ("", "", "")
