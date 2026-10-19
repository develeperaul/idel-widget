"""Package the built browser widget for copying into Unreal Content/UI."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_FILES = (
    "index.html", "widget.css", "session.css", "location.css",
    "project.css", "apartments.css", "saved.css", "build/app.js",
)
DOCUMENTS = ("README.md", "PANELS.md", "EVENTS.md", "DATA_CACHE.md")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/package_unreal.py OUTPUT.zip", file=sys.stderr)
        return 2
    output = Path(sys.argv[1]).resolve()
    files = [ROOT / name for name in (*RUNTIME_FILES, *DOCUMENTS)]
    files += sorted(path for path in (ROOT / "assets").rglob("*") if path.is_file())
    missing = [str(path.relative_to(ROOT)) for path in files if not path.is_file()]
    if missing:
        print(f"Missing package files: {', '.join(missing)}", file=sys.stderr)
        return 1
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT).as_posix())
    with ZipFile(output) as archive:
        bad = archive.testzip()
        names = set(archive.namelist())
        required = set(RUNTIME_FILES)
        if bad or not required.issubset(names):
            print(f"Archive verification failed: {bad or sorted(required - names)}", file=sys.stderr)
            return 1
        print(f"Verified {len(names)} files: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
