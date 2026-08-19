"""Read-only self-test for example_loader."""

from pathlib import Path

from app.shared.example_loader import load_examples


def main() -> None:
    examples_root = Path(__file__).resolve().parent.parent / "prompt_examples"
    yaml_files = sorted(examples_root.rglob("*.yaml"))

    if not yaml_files:
        raise SystemExit(f"No YAML example files found under: {examples_root}")

    for yaml_path in yaml_files:
        relative = yaml_path.relative_to(examples_root).as_posix()
        data = load_examples(relative)
        print(f"{relative}: {len(data['examples'])} examples")

    print("ALL_EXAMPLE_FILES_LOADED_OK")


if __name__ == "__main__":
    main()
