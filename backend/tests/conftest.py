import os
import tempfile
from pathlib import Path


TEST_DB_PATH = Path(tempfile.gettempdir()) / "kade_autoedit_endpoint_tests.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DEBUG"] = "false"
os.environ["DB_PATH"] = str(TEST_DB_PATH)
