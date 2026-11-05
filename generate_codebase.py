import os
import re
import sys
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent
ALL_OUTPUT = ROOT_DIR / "codebase.txt"
BACKEND_OUTPUT = ROOT_DIR / "backend_codebase.txt"
FRONTEND_OUTPUT = ROOT_DIR / "frontend_codebase.txt"

# Ignored directory names
IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "build",
    ".vscode",
    ".idea",
    ".gemini",
    "coverage",
}

# Ignored file extensions (binaries, media, fonts, locks, caches)
IGNORE_EXTS = {
    ".png", ".jpg", ".jpeg", ".ico", ".svg", ".lock", ".pyc", ".pyo",
    ".tsbuildinfo", ".pdf", ".jfif", ".webp", ".gif", ".woff", ".woff2",
    ".ttf", ".eot", ".map", ".mp4", ".mp3", ".zip", ".tar", ".gz",
    ".exe", ".xlsx", ".xls", ".doc", ".docx", ".bin", ".dll", ".so",
    ".dylib", ".db", ".sqlite", ".sqlite3"
}

# Ignored specific file names
IGNORE_FILES = {
    "codebase.txt",
    "backend_codebase.txt",
    "frontend_codebase.txt",
    "generate_codebase.py",
    "compress_codebase.py",
    "dump.txt",
    "raw_fail.txt",
    "entity_raw.txt",
    "1.1.2",
    "pnpm-lock.yaml",
    "uv.lock",
    "package-lock.json",
    "yarn.lock",
    "tsconfig.tsbuildinfo",
    ".env",
    ".env.local",
    ".env.production",
}

def clean_content(content: str) -> str:
    # Normalize newline characters
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ consecutive newlines into 2
    content = re.sub(r"\n{3,}", "\n\n", content)
    # Strip trailing whitespace on each line
    lines = [line.rstrip() for line in content.split("\n")]
    return "\n".join(lines).strip()

def collect_files():
    valid_files = []
    for dirpath, dirnames, filenames in os.walk(ROOT_DIR):
        # Exclude directories in-place
        dirnames[:] = [
            d for d in dirnames
            if d not in IGNORE_DIRS and not d.startswith(".")
        ]

        for fname in sorted(filenames):
            ext = os.path.splitext(fname)[1].lower()
            if ext in IGNORE_EXTS or fname in IGNORE_FILES:
                continue
            
            full_path = Path(dirpath) / fname
            rel_path = full_path.relative_to(ROOT_DIR).as_posix()
            valid_files.append((rel_path, full_path))

    return sorted(valid_files, key=lambda x: x[0])

def write_bundle(output_file: Path, files: list, title: str):
    processed_count = 0
    total_lines = 0

    with open(output_file, "w", encoding="utf-8") as out:
        out.write("=" * 80 + "\n")
        out.write(f"{title}\n")
        out.write(f"Total Files: {len(files)}\n")
        out.write("=" * 80 + "\n\n")

        out.write("TABLE OF CONTENTS:\n")
        for rel_path, _ in files:
            out.write(f"  - {rel_path}\n")
        out.write("\n" + "=" * 80 + "\n\n")

        for rel_path, full_path in files:
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                cleaned = clean_content(content)
                line_count = len(cleaned.splitlines())
                total_lines += line_count

                out.write(f'<file path="{rel_path}">\n')
                out.write(cleaned)
                out.write("\n</file>\n\n")

                processed_count += 1
            except Exception as e:
                print(f"Error reading {rel_path}: {e}", file=sys.stderr)

    size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"[DONE] {title}: {processed_count} files ({total_lines:,} lines) -> {output_file.name} ({size_mb:.2f} MB)")

def main():
    print(f"Scanning files in: {ROOT_DIR}")
    all_files = collect_files()
    backend_files = [f for f in all_files if f[0].startswith("backend/")]
    frontend_files = [f for f in all_files if f[0].startswith("frontend/")]

    print(f"Total matching files: {len(all_files)}")
    print(f"  - Backend files: {len(backend_files)}")
    print(f"  - Frontend files: {len(frontend_files)}")
    print("-" * 60)

    # Write backend codebase
    write_bundle(BACKEND_OUTPUT, backend_files, "BACKEND CODEBASE DUMP")

    # Write frontend codebase
    write_bundle(FRONTEND_OUTPUT, frontend_files, "FRONTEND CODEBASE DUMP")

    # Write combined codebase
    write_bundle(ALL_OUTPUT, all_files, "FULL CODEBASE DUMP")

if __name__ == "__main__":
    main()
