import json

import pandas as pd
from conftest import RENAMED_GROUP, ROOT

import build_dataset
from wa.names import load_people

ANDROID_ES = str(ROOT / "tests" / "fixtures" / "formats" / "android-es.txt")


def test_fixture_parses(mini_parquet):
    df = pd.read_parquet(mini_parquet)
    assert len(df) >= 60
    assert set(df["sender"].astype(str)) >= {"Bruno", "Tomi", "Ana"}
    assert (df["kind"] == "poll").sum() == 1
    assert (df["kind"] == "system").sum() >= 2


def test_fixture_outputs(mini_out):
    assert (mini_out / "events.json").exists()
    assert (mini_out / "records.json").exists()
    assert (mini_out / "departures.csv").exists()


def test_fixture_outputs_content(mini_out):
    events = json.loads((mini_out / "events.json").read_text(encoding="utf-8"))
    assert any("error" not in e for e in events)
    records = json.loads((mini_out / "records.json").read_text(encoding="utf-8"))
    assert "polls" in records
    reentries = pd.read_csv(mini_out / "departures.csv")
    assert len(reentries) >= 1


def test_fixture_system_events(mini_parquet):
    df = pd.read_parquet(mini_parquet)
    assert {"sys_event", "sys_who", "sys_by"} <= set(df.columns)
    sys = df[df["kind"] == "system"]
    assert sys["sys_event"].value_counts().to_dict() == {"added": 2, "removed": 2, "created": 1, "left": 1,
                                                         "joined_link": 1, "name_changed": 1}
    assert (df.loc[df["kind"] != "system", ["sys_event", "sys_who", "sys_by"]] == "").all().all()
    renamed = sys[sys["sys_event"] == "name_changed"].iloc[0]
    assert (renamed["sys_who"], renamed["sys_by"]) == (RENAMED_GROUP, 'Tomi "Tomate" Suárez🍅')
    removed = sys[sys["sys_event"] == "removed"]
    assert list(removed["sys_who"]) == ['Bruno "Brujo" Castro', 'Caro "Carola" Méndez👝']  # crudos, como sender_raw


def test_android_build_maps_system_sender_and_owner(people):
    df = build_dataset.build([(ANDROID_ES, "main")], people)
    sys = df[df["kind"] == "system"]
    assert set(sys["sender_raw"]) == {"Los del Parque 🌳"} and set(sys["sender"].astype(str)) == {"__grupo__"}
    you = sys[sys["sys_who"] == "Caro"].iloc[0]
    assert (you["sys_event"], you["sys_by"]) == ("added", "Ana")  # "Añadiste a Caro": el dueño es people.me
    assert (df["kind"] == "media").sum() == 8
    bare = build_dataset.build([(ANDROID_ES, "main")], load_people(None))  # sin people.json: ni grupo ni dueño
    bare_sys = bare[bare["kind"] == "system"]
    assert set(bare_sys["sender_raw"]) == {"__grupo__"} and "?" in set(bare_sys["sys_by"])
