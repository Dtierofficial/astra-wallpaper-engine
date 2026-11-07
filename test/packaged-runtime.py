"""Windows-only isolated installation check; never reads personal wallpapers."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--cli", type=Path)
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()
    if os.name != "nt":
        raise SystemExit(
            "Run this test on Windows x64; it must execute the shipped Windows binary."
        )
    project = Path(__file__).resolve().parents[1]
    # OpenCode's approved external scratch directory, with a portable fallback
    # for contributors who do not run OpenCode.
    scratch = Path(tempfile.gettempdir()) / "opencode"
    scratch.mkdir(exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix="we-bundle-", dir=scratch))
    install = root / "Другой пользователь" / "Plugin folder"
    try:
        with zipfile.ZipFile(args.bundle.resolve()) as archive:
            names = archive.namelist()
            assert names[0] == "MANIFEST.json"
            manifest = json.loads(archive.read("MANIFEST.json"))
            assert manifest["entry"] == {
                "command": "./dist/runtime/node.exe",
                "args": ["dist/index.js"],
            }
            assert not any(
                "node_modules/" in name or name.startswith(("src/", "data/"))
                for name in names
            )
            assert not any(name.endswith("settings.json") for name in names)
            for file in manifest["files"]:
                data = archive.read(file["path"])
                assert len(data) == file["size"], file["path"]
                assert hashlib.sha256(data).hexdigest() == file["sha256"], file["path"]
            lock = json.loads(archive.read("dist/runtime/runtime.json"))
            for name, pin in [
                ("dist/runtime/node.exe", lock["binary"]),
                ("ui/legal/NODE-LICENSE.txt", lock["license"]),
            ]:
                data = archive.read(name)
                assert len(data) == pin["size"]
                assert hashlib.sha256(data).hexdigest() == pin["sha256"]
            assert "runtimes = []" in archive.read("plugin.toml").decode()
            # Developer paths and test fixtures must never leak into runtime
            # files; the bridge URL is supplied by Astra on each user's PC.
            for name in names:
                if name.endswith((".js", ".html", ".css", ".json")):
                    text = archive.read(name).decode("utf-8")
                    assert (
                        str(project).replace("\\", "/").lower() not in text.lower()
                    ), name
                    assert (
                        str(project).replace("\\", "\\\\").lower() not in text.lower()
                    ), name
                    assert not re.search(r"[A-Za-z]:[/\\\\]Users[/\\\\]", text), name
            assert b"Astra UI is clickable" not in archive.read("ui/index.html")
            assert b"test wallpaper" not in archive.read("ui/index.html")
            assert (
                next(
                    f for f in manifest["files"] if f["path"] == "dist/runtime/node.exe"
                )["mode"]
                == "0755"
            )
            for name in names:
                assert (
                    not name.startswith("/")
                    and ".." not in Path(name).parts
                    and "\\" not in name
                )
            archive.extractall(install)

        # Windows environment names are case-insensitive; a plain dict is not.
        # Avoid duplicate ProgramFiles/PATH keys retaining the real profile.
        env = {name.upper(): value for name, value in os.environ.items()}
        system_root = os.environ.get("SystemRoot") or os.environ.get(
            "WINDIR", "C:\\Windows"
        )
        for name in list(env):
            if name.upper() in ("PATH", "NODE_PATH", "NODE_OPTIONS") or name.startswith(
                "ASTRA_"
            ):
                env.pop(name)
        env["PATH"] = str(Path(system_root) / "System32")
        env["PROGRAMFILES(X86)"] = str(root / "Empty Program Files")
        env["PROGRAMFILES"] = env["PROGRAMFILES(X86)"]
        env["LOCALAPPDATA"] = str(root / "Clean profile")
        env["ASTRA_WE_DATA_DIR"] = str(root / "Clean profile" / "Preferences")
        env["ASTRA_WE_DISABLE_MONITOR"] = "1"
        assert shutil.which("node", path=env["PATH"]) is None
        executable = install / "dist/runtime/node.exe"
        assert (
            subprocess.check_output(
                [str(executable), "--version"], env=env, text=True
            ).strip()
            == "v" + lock["version"]
        )
        smoke = root / "packaged-smoke.cjs"
        shutil.copyfile(project / "test/fixtures/packaged-smoke.cjs", smoke)
        # Allow only this isolated directory; reads from the development tree
        # and child-process launches are denied in these two functional passes.
        command = [
            str(executable),
            "--permission",
            f"--allow-fs-read={root}{os.sep}*",
            f"--allow-fs-write={root}{os.sep}*",
            str(smoke),
            str(install),
            str(root),
            str(project),
        ]
        isolated_env = dict(env, PATH=str(root / "No programs"))
        for restarted in ("0", "1"):
            subprocess.run(
                command,
                cwd=root,
                env=dict(isolated_env, ASTRA_WE_TEST_RESTART=restarted),
                check=True,
                timeout=30,
            )

        # Check the exact native helper in the archive, not a freshly compiled
        # replacement. It may report either hidden or visible on the test PC.
        helper = subprocess.Popen(
            [str(install / "dist/window-monitor.exe"), str(os.getpid())],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            out, err = helper.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            helper.kill()
            out, err = helper.communicate(timeout=5)
        assert any(line in ("visible", "hidden") for line in out.splitlines()), (
            out,
            err,
        )

        cli = (
            args.cli
            or project / "tools/cli/astra-plugin-0.5.1-windows-x64/astra-plugin.exe"
        )
        if cli.is_file():
            # Real spawned plugin process, real gRPC registration; no Node in PATH.
            subprocess.run(
                [
                    str(cli.resolve()),
                    "test",
                    str(install),
                    "--no-build",
                    "--report",
                    str(root / "conformance.json"),
                ],
                cwd=root,
                env=dict(isolated_env, ASTRA_WE_DISABLE_MONITOR="0"),
                check=True,
                timeout=40,
            )
        else:
            raise AssertionError(
                "Pass --cli pointing to astra-plugin.exe for the spawn/handshake check"
            )
        print(
            json.dumps(
                {
                    "pass": True,
                    "bundle": str(args.bundle),
                    "install": str(install),
                    "no_node_in_path": True,
                    "native_helper": True,
                    "conformance": True,
                    "files": len(names),
                    "bytes": args.bundle.stat().st_size,
                },
                ensure_ascii=True,
            )
        )
    finally:
        if not args.keep:
            shutil.rmtree(root)
        else:
            print(
                "Retained isolated installation:",
                str(install).encode("ascii", "backslashreplace").decode(),
            )


if __name__ == "__main__":
    main()
