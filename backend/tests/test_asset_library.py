import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import main
from config import settings


def test_library_categories_endpoint():
    with TestClient(main.app) as client:
        response = client.get("/library/categories")

    assert response.status_code == 200, response.text
    data = response.json()
    ids = {item["id"] for item in data}
    assert {"transitions", "text-presets-mogrt", "effects-overlays"} <= ids


def test_library_assets_scans_category(tmp_path, monkeypatch):
    library_dir = tmp_path / "library"
    category_dir = library_dir / "text-presets-mogrt"
    category_dir.mkdir(parents=True)
    asset = category_dir / "Clean Lower Third.mogrt"
    asset.write_bytes(b"fake mogrt")
    monkeypatch.setattr(settings, "ASSET_LIBRARY_DIR", library_dir)

    with TestClient(main.app) as client:
        response = client.get("/library/assets", params={"category": "text-presets-mogrt", "q": "lower"})

    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Clean Lower Third"
    assert data[0]["kind"] == "mogrt"
    assert data[0]["category"] == "text-presets-mogrt"
