import os
import re

root_dir = r"D:\projects\mapping"
output_path = os.path.join(root_dir, "codebase.txt")

ignore_dirs = {
    "node_modules", ".next", ".git", ".venv", "__pycache__", ".pytest_cache",
    "dist", "build", ".vscode", ".idea"
}

ignore_file_exts = {
    ".png", ".jpg", ".jpeg", ".ico", ".svg", ".lock", ".pyc", ".tsbuildinfo",
    ".pdf", ".jfif", ".webp", ".gif", ".woff", ".woff2", ".ttf", ".eot", ".map"
}

ignore_files = {
    "pnpm-lock.yaml", "uv.lock", "codebase.txt", "dump.txt", "raw_fail.txt",
    "entity_raw.txt", "1.1.2", "tsconfig.tsbuildinfo"
}

def clean_code(text):
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    lines = [line.rstrip() for line in text.splitlines()]
    return '\n'.join(lines).strip()

count = 0
with open(output_path, "w", encoding="utf-8") as out:
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in ignore_dirs and not d.startswith(".")]
        
        # Skip repetitive third-party UI primitives
        if "components\\ui" in dirpath or "components/ui" in dirpath:
            continue
            
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in ignore_file_exts or filename in ignore_files:
                continue
            
            full_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(full_path, root_dir).replace("\\", "/")
            
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    raw = f.read()
                    
                cleaned = clean_code(raw)
                if not cleaned:
                    continue
                    
                out.write(f'<file path="{rel_path}">\n')
                out.write(cleaned)
                out.write("\n</file>\n\n")
                count += 1
            except Exception:
                pass

size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"Processed {count} source files.")
print(f"Old size was: 2.56 MB")
print(f"New compressed size: {size_mb:.2f} MB")
