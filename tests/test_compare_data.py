import json

import compare_data


def _write(root, files):
    for rel, data in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return root


def _run(tmp_path, a, b, *extra):
    da, db = _write(tmp_path / "a", a), _write(tmp_path / "b", b)
    return compare_data.run(["--a", str(da), "--b", str(db), *extra])


def test_equal_dirs_exit_zero(tmp_path, capsys):
    data = {"global.json": {"x": 1, "l": [1, {"y": "z"}]}, "people/ana.json": {"slug": "ana"}}
    assert _run(tmp_path, data, data) == 0
    assert capsys.readouterr().out == ""


def test_value_difference_names_file_path_and_values(tmp_path, capsys):
    assert _run(tmp_path, {"g.json": {"t": {"n": [1, 2]}}}, {"g.json": {"t": {"n": [1, 3]}}}) == 1
    assert capsys.readouterr().out.strip() == "g.json:t.n[1]: a=2 b=3"


def test_missing_key_and_missing_file(tmp_path, capsys):
    assert _run(tmp_path, {"g.json": {}}, {"g.json": {"k": 1}, "h.json": {}}) == 1
    out = capsys.readouterr().out
    assert "g.json:k: a=<missing> b=1" in out
    assert "h.json: a=<missing>" in out


def test_extra_file_in_a_is_a_difference(tmp_path, capsys):
    assert _run(tmp_path, {"g.json": {}, "new.json": {}}, {"g.json": {}}) == 1
    assert "new.json: a=" in capsys.readouterr().out


def test_ignore_keys_anywhere(tmp_path):
    a = {"g.json": {"generatedAt": "1", "p": [{"verifiedOn": "x", "v": 1}]}}
    b = {"g.json": {"generatedAt": "2", "p": [{"verifiedOn": "y", "v": 1}]}}
    assert _run(tmp_path, a, b, "--ignore", "generatedAt,verifiedOn") == 0


def test_rename_files_and_keys(tmp_path):
    a = {"departures.json": {"n": 1}, "facts.json": {"departerPeak": [1]}, "people/old.json": {"s": 1}}
    b = {"old.json": {"n": 1}, "facts.json": {"oldPeak": [1]}, "people/old.json": {"s": 1}}
    assert _run(tmp_path, a, b, "--rename", "old.json=departures.json,oldPeak=departerPeak") == 0


def test_rename_file_matches_relative_path_only(tmp_path, capsys):
    # people/old.json no se renombra: el renombre es de la ruta relativa entera
    a = {"departures.json": {}, "people/departures.json": {}}
    b = {"old.json": {}, "people/old.json": {}}
    assert _run(tmp_path, a, b, "--rename", "old.json=departures.json") == 1
    assert "people/old.json: a=<missing>" in capsys.readouterr().out


def test_extra_ok_allows_paths_only_in_a(tmp_path, capsys):
    a = {"g.json": {"title": "T", "k": 1}, "d.json": {"person": "P", "n": [{"x": 1, "new": 2}]}}
    b = {"g.json": {"k": 1}, "d.json": {"n": [{"x": 1}]}}
    assert _run(tmp_path, a, b, "--extra-ok", "g.title,d.person,d.n[*].new") == 0
    # extra-ok solo vale para lo que falta en b, no para un valor distinto
    b2 = {"g.json": {"title": "U", "k": 1}, "d.json": {"person": "P", "n": [{"x": 1, "new": 2}]}}
    assert _run(tmp_path / "2", a, b2, "--extra-ok", "g.title") == 1
    assert "g.json:title: a=\"T\" b=\"U\"" in capsys.readouterr().out


def test_value_map_global_and_scoped_by_key(tmp_path):
    a = {"c.json": {"timeline": [{"kind": "departures", "href": "/salidas/", "slug": "old"}]}}
    b = {"c.json": {"timeline": [{"kind": "old", "href": "/old/", "slug": "old"}]}}
    assert _run(tmp_path, a, b, "--value-map", "kind:old=departures,/old/=/salidas/") == 0


def test_value_map_scoped_does_not_touch_other_keys(tmp_path, capsys):
    a = {"c.json": {"kind": "departures", "slug": "departures"}}
    b = {"c.json": {"kind": "old", "slug": "old"}}
    assert _run(tmp_path, a, b, "--value-map", "kind:old=departures") == 1
    assert capsys.readouterr().out.strip() == 'c.json:slug: a="departures" b="old"'


def test_list_length_difference(tmp_path, capsys):
    assert _run(tmp_path, {"g.json": {"l": [1, 2, 3]}}, {"g.json": {"l": [1, 2]}}) == 1
    out = capsys.readouterr().out
    assert "g.json:l: a=len 3 b=len 2" in out and "g.json:l[2]: a=3 b=<missing>" in out


def test_floats_close_enough_are_equal(tmp_path):
    assert _run(tmp_path, {"g.json": {"f": 0.1 + 0.2}}, {"g.json": {"f": 0.3}}) == 0


def test_int_and_float_with_same_value_are_equal(tmp_path):
    assert _run(tmp_path, {"g.json": {"f": 2.0}}, {"g.json": {"f": 2}}) == 0


def test_bool_is_not_int(tmp_path):
    assert _run(tmp_path, {"g.json": {"f": True}}, {"g.json": {"f": 1}}) == 1


def test_values_truncated_to_80_chars(tmp_path, capsys):
    assert _run(tmp_path, {"g.json": {"s": "x" * 200}}, {"g.json": {"s": "y"}}) == 1
    line = capsys.readouterr().out.strip()
    a_part = line.split(" a=", 1)[1].split(" b=", 1)[0]
    assert len(a_part) <= 80 and a_part.endswith("…")


def test_summary_line_on_stderr(tmp_path, capsys):
    _run(tmp_path, {"g.json": {"k": 1}, "people/a.json": {}}, {"g.json": {"k": 2}, "people/a.json": {}})
    assert "2 archivos comparados, 1 diferencia" in capsys.readouterr().err
