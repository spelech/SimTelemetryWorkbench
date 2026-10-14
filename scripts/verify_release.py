#!/usr/bin/env python3
"""
Release and Version Verification Engine
Validates SemVer formats, changelog headers, manifest synchronizations,
and markdown relative links across the repository.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Set, Tuple

# Ensure UTF-8 output encoding across Windows and POSIX environments
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

SEMVER_REGEX = re.compile(
    r"^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)

EXCLUDED_DIRS = {
    ".git", ".github", ".gemini", ".vscode", ".venv", "node_modules",
    "bin", "obj", "TestResults", "coverage", "dist", ".system_generated"
}

def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS or (part.startswith(".") and part != ".") for part in path.parts)

def is_valid_semver(version: str) -> bool:
    return bool(SEMVER_REGEX.match(version.strip()))

def normalize_semver(version: str) -> str:
    v = version.strip()
    return v[1:] if v.startswith("v") else v

def get_current_git_context() -> Tuple[Optional[str], Optional[str]]:
    branch = None
    tag = None
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, check=False
        )
        if res.returncode == 0:
            b = res.stdout.strip()
            if b and b != "HEAD":
                branch = b
    except Exception:
        pass

    try:
        res = subprocess.run(
            ["git", "describe", "--tags", "--exact-match"],
            capture_output=True, text=True, check=False
        )
        if res.returncode == 0:
            t = res.stdout.strip()
            if t:
                tag = t
    except Exception:
        pass

    return branch, tag

def check_semver_format(target_version: Optional[str]) -> bool:
    print("🔍 Validating Semantic Versioning (SemVer) format...")
    if not target_version:
        branch, tag = get_current_git_context()
        if tag:
            target_version = tag
        elif branch and (branch.startswith("release/v") or branch.startswith("hotfix/v")):
            target_version = branch.split("/v", 1)[1]

    if target_version:
        if not is_valid_semver(target_version):
            print(f"❌ Error: Target version '{target_version}' violates SemVer 2.0.0 specification.")
            return False
        print(f"✅ SemVer format validated: {target_version}")
    else:
        print("ℹ️ No target version specified via argument, tag, or release branch. Format check skipped.")
    return True

def check_changelog_headers(root_dir: Path, target_version: Optional[str] = None) -> bool:
    print("🔍 Auditing CHANGELOG.md headers and SemVer compliance...")
    changelogs = [
        f for f in root_dir.rglob("*.md")
        if not is_excluded(f) and f.name.lower() == "changelog.md"
    ]

    if not changelogs:
        print("ℹ️ No CHANGELOG.md found. Skipping changelog audit.")
        return True

    all_valid = True
    header_pattern = re.compile(r"^##\s+\[?([^\]\r\n]+)\]?(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?", re.MULTILINE)

    for changelog in changelogs:
        content = changelog.read_text(encoding="utf-8", errors="ignore")
        headers = header_pattern.findall(content)

        if not headers:
            print(f"⚠️ Warning: {changelog.relative_to(root_dir)} has no level-2 release headers (e.g. '## [1.0.0]').")
            continue

        versions_found: List[str] = []
        for version_str, date_str in headers:
            version_clean = version_str.strip()
            if version_clean.lower() == "unreleased":
                continue
            if not is_valid_semver(version_clean):
                print(f"❌ Invalid SemVer header in {changelog.relative_to(root_dir)}: '## [{version_str}]'")
                all_valid = False
            else:
                versions_found.append(normalize_semver(version_clean))

        if target_version:
            norm_target = normalize_semver(target_version)
            if norm_target not in versions_found:
                print(f"❌ Target version '{target_version}' not recorded in {changelog.relative_to(root_dir)}.")
                all_valid = False
            else:
                print(f"✅ Found target version '{norm_target}' in {changelog.relative_to(root_dir)}.")

    if all_valid:
        print("✅ All changelog headers verified successfully.")
    return all_valid

def is_template_dir(path: Path) -> bool:
    return "templates" in path.parts and ("configs" in path.parts or "docs" in path.parts or "vitepress" in path.parts or "workflows" in path.parts)

def check_manifest_versions(root_dir: Path, target_version: Optional[str] = None) -> bool:
    print("🔍 Auditing project manifests for version synchronization...")
    found_versions: List[Tuple[Path, str]] = []

    # package.json
    for pkg_json in root_dir.rglob("package.json"):
        if is_excluded(pkg_json) or is_template_dir(pkg_json):
            continue
        try:
            data = json.loads(pkg_json.read_text(encoding="utf-8"))
            if "version" in data and is_valid_semver(data["version"]):
                found_versions.append((pkg_json, normalize_semver(data["version"])))
        except Exception:
            pass

    # Directory.Build.props / .csproj
    version_tag_regex = re.compile(r"<Version>([^<]+)</Version>")
    for csproj in list(root_dir.rglob("*.csproj")) + list(root_dir.rglob("Directory.Build.props")):
        if is_excluded(csproj) or is_template_dir(csproj):
            continue
        try:
            content = csproj.read_text(encoding="utf-8", errors="ignore")
            match = version_tag_regex.search(content)
            if match and is_valid_semver(match.group(1)):
                found_versions.append((csproj, normalize_semver(match.group(1))))
        except Exception:
            pass

    # pyproject.toml
    pyproject_regex = re.compile(r'version\s*=\s*"([^"]+)"')
    for pyproject in root_dir.rglob("pyproject.toml"):
        if is_excluded(pyproject) or is_template_dir(pyproject):
            continue
        try:
            content = pyproject.read_text(encoding="utf-8", errors="ignore")
            match = pyproject_regex.search(content)
            if match and is_valid_semver(match.group(1)):
                found_versions.append((pyproject, normalize_semver(match.group(1))))
        except Exception:
            pass

    if not found_versions:
        print("ℹ️ No versioned project manifests detected.")
        return True

    all_valid = True
    first_file, baseline_version = found_versions[0]

    for f_path, ver in found_versions:
        if not is_valid_semver(ver):
            print(f"❌ Invalid SemVer '{ver}' in {f_path.relative_to(root_dir)}")
            all_valid = False
        if target_version and ver != normalize_semver(target_version):
            print(f"❌ Version mismatch in {f_path.relative_to(root_dir)}: expected '{normalize_semver(target_version)}', got '{ver}'")
            all_valid = False
        elif not target_version and ver != baseline_version:
            print(f"❌ Manifest version drift between {first_file.relative_to(root_dir)} ({baseline_version}) and {f_path.relative_to(root_dir)} ({ver})")
            all_valid = False

    if all_valid:
        print(f"✅ All manifests synchronized ({len(found_versions)} manifest(s) checked).")
    return all_valid

def check_markdown_links(root_dir: Path) -> bool:
    print("🔍 Auditing markdown relative links and anchors...")
    has_errors = False
    md_files = [f for f in root_dir.rglob("*.md") if not is_excluded(f) and not is_template_dir(f)]

    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')

    for md_file in md_files:
        content = md_file.read_text(encoding="utf-8", errors="ignore")
        links = link_pattern.findall(content)
        for text, link in links:
            # Skip external protocols, anchor-only links, and special editor schemes
            if any(link.startswith(proto) for proto in ["http://", "https://", "mailto:", "#", "file:", "conversation:"]):
                continue

            target_path = link.split("#")[0].strip()
            if not target_path:
                continue

            # Support VitePress root-relative links e.g. /standards/...
            if target_path.startswith("/"):
                candidates = [
                    (root_dir / "docs" / target_path.lstrip("/")),
                    (root_dir / target_path.lstrip("/"))
                ]
            else:
                candidates = [md_file.parent / target_path]

            resolved_exists = False
            for cand in candidates:
                cand_res = cand.resolve()
                if cand_res.exists():
                    resolved_exists = True
                    break
                # Support VitePress extensionless route links (.md omitted)
                if cand_res.with_suffix(".md").exists():
                    resolved_exists = True
                    break
                if (cand_res / "index.md").exists():
                    resolved_exists = True
                    break

            if not resolved_exists:
                print(f"❌ Broken link in {md_file.relative_to(root_dir)}: [{text}]({link})")
                has_errors = True

    if not has_errors:
        print("✅ All markdown links verified successfully.")
    return not has_errors

# ==============================================================================
# Static Test Theatre Audit Engine
# ==============================================================================

TEST_FILE_EXTENSIONS: Set[str] = {".cs", ".py", ".ts", ".tsx", ".cpp", ".cc", ".cxx"}

# Patterns identifying mock setup or verification invocations
MOCK_CALL_PATTERNS = [
    # Python
    re.compile(r"\bassert_(?:called_once_with|called_once|called_with|called|any_call|has_calls|not_called)\s*\("),
    re.compile(r"(?:mock|mocker)\.patch(?:|\.object)\s*\("),
    re.compile(r"@(?:mock\.)?patch(?:\.object)?\s*\("),
    # C#
    re.compile(r"\.\s*Verify(?:All|NoOtherCalls)?\s*(?:<[^>]+>)?\s*\("),
    re.compile(r"\.\s*(?:Received|DidNotReceive)\s*(?:<[^>]+>)?\s*\("),
    re.compile(r"\bA\.CallTo\s*\("),
    # TypeScript / Jest / Vitest
    re.compile(r"\.\s*toHaveBeenCalled(?:With|Times)?\s*\("),
    re.compile(r"\.\s*toHaveBeen(?:LastCalledWith|NthCalledWith)\s*\("),
    re.compile(r"(?:jest|vi)\.spyOn\s*\("),
    # C++
    re.compile(r"\bEXPECT_CALL\s*\("),
    re.compile(r"\bON_CALL\s*\("),
]

# Patterns identifying concrete state assertions
STATE_ASSERTION_PATTERNS = [
    # Python
    re.compile(r"\bassert\s+(?!_called|any_call|has_calls|not_called)"),
    re.compile(r"self\.assert(?:Equal|NotEqual|True|False|In|NotIn|Is|IsNot|IsNone|IsNotNone|AlmostEqual|Greater|GreaterEqual|Less|LessEqual|Regex|Raises|CountEqual)\s*\("),
    re.compile(r"pytest\.raises\s*\("),
    # C#
    re.compile(r"\bAssert\.(?:Equal|NotEqual|True|False|Contains|DoesNotContain|Empty|NotEmpty|Null|NotNull|Same|NotSame|InRange|NotInRange|Throws|ThrowsAsync|Equivalent|Multiple)\s*(?:<[^>]+>)?\s*\("),
    re.compile(r"\.\s*Should\s*\(\s*\)\s*\.\s*(?:Be|NotBe|Match|Contain|HaveCount|Throw|BeTrue|BeFalse|BeNull|NotBeNull|BeEquivalentTo)\b"),
    # TypeScript / Jest / Vitest
    re.compile(r"\bexpect\s*\(.*?\)\s*\.\s*(?:toBe|toEqual|toStrictEqual|toMatch|toContain|toHaveLength|toBeNull|toBeDefined|toBeUndefined|toBeTruthy|toBeFalsy|toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual|toBeLessThanOrEqual|toThrow|toThrowError|toBeVisible|toHaveText|toHaveValue|toHaveAttribute|toHaveCount|toHaveNoLayoutOverflow|toHaveMobileFit|toHaveTouchFriendlyTargets|toPassLayoutAudit)\s*\("),
    # C++
    re.compile(r"\b(?:EXPECT|ASSERT)_(?:EQ|NE|TRUE|FALSE|LT|GT|LE|GE|STREQ|STRNE|NEAR|FLOAT_EQ|DOUBLE_EQ|THROW|NO_THROW)\s*\("),
    re.compile(r"\b(?:REQUIRE|CHECK)(?:_FALSE)?\s*\("),
]

# Patterns identifying mock framework usage in a repository
MOCK_FRAMEWORK_PATTERNS = [
    ("Python unittest.mock/pytest-mock", re.compile(r"\b(?:unittest\.mock|pytest_mock|mocker|MagicMock|mock\.patch)\b|from\s+unittest\.mock|@patch")),
    ("C# Moq/NSubstitute/FakeItEasy", re.compile(r"using\s+(?:Moq|NSubstitute|FakeItEasy)\b|\bMock<[A-Za-z0-9_]+>|new\s+Mock<")),
    ("TypeScript Jest/Vitest Mocks", re.compile(r"(?:jest|vi)\.mock\s*\(|(?:jest|vi)\.spyOn\s*\(|from\s+['\"]sinon['\"]")),
    ("C++ Google Mock", re.compile(r"#include\s*<gmock/gmock\.h>|\bEXPECT_CALL\s*\(|\bON_CALL\s*\(")),
]

# Patterns identifying integration test fixtures/harnesses
INTEGRATION_HARNESS_PATTERNS = [
    re.compile(r"\bWebApplicationFactory\b"),
    re.compile(r"\bCliExecutionHarness\b|\bProcessStartInfo\b|\bProcess\.Start\b"),
    re.compile(r"\bAsyncClient\b|\bTestClient\b|\bASGITransport\b|\bInMemorySessionClient\b"),
    re.compile(r"@playwright/test|\bplaywright\b|\bpage\.goto\s*\("),
    re.compile(r"\bTestWithParam\b|\bINSTANTIATE_TEST_SUITE_P\b|\bBoundarySweeps\b"),
    re.compile(r"subprocess\.(?:Popen|run)\s*\("),
]

# Tautological assertion patterns (checked per-line)
TAUTOLOGY_PATTERNS = [
    re.compile(r"\bassert\s+([a-zA-Z_][a-zA-Z0-9_\.]*|\d+)\s*==\s*\1(?:\s*[,#\n\r]|$)"),
    re.compile(r"\bself\.assertEqual\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\.]*|\d+)\s*,\s*\1\s*(?:,[^)]*)?\)"),
    re.compile(r"\bassert\s+(?:True|False)\b"),
    re.compile(r"\bself\.assert(?:True|False)\s*\(\s*(?:True|False)\s*(?:,[^)]*)?\)"),
    re.compile(r"\bAssert\.Equal\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\.]*|\d+)\s*,\s*\1\s*(?:,[^)]*)?\)"),
    re.compile(r"\bAssert\.True\s*\(\s*true\s*\)"),
    re.compile(r"\bAssert\.True\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\.]*|\d+)\s*==\s*\1\s*\)"),
    re.compile(r"\bexpect\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\.]*|\d+)\s*\)\s*\.\s*(?:toBe|toEqual|toStrictEqual)\s*\(\s*\1\s*\)"),
    re.compile(r"\bexpect\s*\(\s*true\s*\)\s*\.\s*(?:toBe|toEqual)\s*\(\s*true\s*\)"),
    re.compile(r"\b(?:EXPECT|ASSERT)_EQ\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\.]*|\d+)\s*,\s*\1\s*\)"),
    re.compile(r"\b(?:EXPECT|ASSERT)_TRUE\s*\(\s*true\s*\)"),
]

def is_test_file(path: Path) -> bool:
    if path.suffix.lower() not in TEST_FILE_EXTENSIONS:
        return False
    lower_stem = path.stem.lower()
    lower_parts = [p.lower() for p in path.parts]
    is_test_named = "test" in lower_stem or "spec" in lower_stem
    is_in_test_folder = any(p in {"test", "tests", "__tests__", "spec", "specs"} for p in lower_parts)
    return is_test_named or is_in_test_folder

def strip_block_comments_and_docstrings(content: str, suffix: str) -> str:
    """Replaces block comments and docstrings with equivalent newlines to preserve line numbering."""
    def replacer(match: re.Match) -> str:
        return "\n" * match.group(0).count("\n")

    if suffix in {".cs", ".ts", ".tsx", ".cpp", ".cc", ".cxx"}:
        return re.sub(r"/\*.*?\*/", replacer, content, flags=re.DOTALL)
    elif suffix == ".py":
        return re.sub(r'""".*?"""|\'\'\'.*?\'\'\'', replacer, content, flags=re.DOTALL)
    return content

def strip_single_line_comments(content: str, suffix: str) -> str:
    """Strips single-line comments (# for Python, // for C#/TS/C++) preserving string literals, URLs, and line numbers."""
    if suffix == ".py":
        comment_char = "#"
        is_double_slash = False
    elif suffix in {".cs", ".ts", ".tsx", ".cpp", ".cc", ".cxx"}:
        comment_char = "/"
        is_double_slash = True
    else:
        return content

    result = []
    i = 0
    n = len(content)
    in_quote: Optional[str] = None
    escape = False

    quote_chars = {'"', "'"}
    if suffix in {".ts", ".tsx"}:
        quote_chars.add("`")

    while i < n:
        ch = content[i]

        if in_quote is not None:
            result.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_quote:
                in_quote = None
            elif ch == "\n" and in_quote != "`":
                in_quote = None
                escape = False
            i += 1
        else:
            if is_double_slash and ch == "/" and i + 1 < n and content[i + 1] == "/":
                i += 2
                while i < n and content[i] != "\n":
                    i += 1
            elif not is_double_slash and ch == comment_char:
                i += 1
                while i < n and content[i] != "\n":
                    i += 1
            elif ch in quote_chars:
                in_quote = ch
                result.append(ch)
                i += 1
            else:
                result.append(ch)
                i += 1

    return "".join(result)

def audit_test_theatre(repo_root: Path) -> Tuple[bool, List[str]]:
    """
    Audits test files across polyglot languages for test theatre anti-patterns:
    1. Mock verification dominance over concrete state assertions.
    2. Missing integration baselines when mock libraries are used.
    3. Tautological assertions (e.g. Assert.Equal(x, x), assert y == y).
    """
    issues: List[str] = []

    test_files: List[Path] = []
    all_code_files: List[Path] = []

    for path in repo_root.rglob("*"):
        if not path.is_file() or is_excluded(path):
            continue
        if path.suffix.lower() in TEST_FILE_EXTENSIONS:
            all_code_files.append(path)
            if is_test_file(path):
                test_files.append(path)

    if not test_files:
        return True, []

    mock_frameworks_detected: List[str] = []
    has_integration_harness = False

    # Check for integration harnesses across all test and code files
    for code_file in all_code_files:
        try:
            content = code_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        clean_content = strip_block_comments_and_docstrings(content, code_file.suffix.lower())
        clean_content = strip_single_line_comments(clean_content, code_file.suffix.lower())
        for harness_pattern in INTEGRATION_HARNESS_PATTERNS:
            if harness_pattern.search(clean_content):
                has_integration_harness = True
                break
        if has_integration_harness:
            break

    # Audit individual test files
    for test_file in test_files:
        try:
            content = test_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        rel_path = test_file.relative_to(repo_root)
        clean_content = strip_block_comments_and_docstrings(content, test_file.suffix.lower())
        clean_content = strip_single_line_comments(clean_content, test_file.suffix.lower())

        # Detect mock frameworks used
        for fw_name, fw_pattern in MOCK_FRAMEWORK_PATTERNS:
            if fw_pattern.search(clean_content):
                if fw_name not in mock_frameworks_detected:
                    mock_frameworks_detected.append(fw_name)

        # Count mock calls and state assertions
        mock_count = sum(len(pattern.findall(clean_content)) for pattern in MOCK_CALL_PATTERNS)
        state_count = sum(len(pattern.findall(clean_content)) for pattern in STATE_ASSERTION_PATTERNS)

        # Mock dominance check
        if mock_count > 0 and state_count == 0:
            issues.append(
                f"{rel_path}: Mock verification dominance: file has {mock_count} mock verification(s) "
                f"but 0 concrete state assertions (mock calls as sole assertions)."
            )
        elif mock_count > state_count:
            issues.append(
                f"{rel_path}: Mock-to-assertion ratio violation: mock verifications ({mock_count}) "
                f"exceed concrete state assertions ({state_count})."
            )

        # Tautological assertions check
        for line_no, line in enumerate(clean_content.splitlines(), start=1):
            line_str = line.strip()
            if not line_str or line_str.startswith(("#", "//", "/*", "*")):
                continue
            for tautology_pat in TAUTOLOGY_PATTERNS:
                match = tautology_pat.search(line)
                if match:
                    issues.append(
                        f"{rel_path}:{line_no}: Tautological assertion detected: '{match.group(0).strip()}'"
                    )
                    break

    # Missing integration baseline check across the project
    if mock_frameworks_detected and not has_integration_harness:
        fws = ", ".join(mock_frameworks_detected)
        issues.append(
            f"Missing integration baseline: Repository uses mock frameworks ({fws}) "
            f"but contains 0 integration harnesses (e.g. WebApplicationFactory, AsyncClient/TestClient, Playwright, or CLI execution harness)."
        )

    passed = len(issues) == 0
    return passed, issues

def check_test_theatre_audit(root_dir: Path) -> bool:
    print("🔍 Auditing test suites for test theatre anti-patterns...")
    passed, issues = audit_test_theatre(root_dir)
    if not passed:
        for issue in issues:
            print(f"❌ {issue}")
        return False
    print("✅ All test suites passed anti-theatre audit.")
    return True

def main() -> None:
    parser = argparse.ArgumentParser(description="Release Verification Engine")
    parser.add_argument("--root", type=Path, default=None, help="Root directory to audit")
    parser.add_argument("--version", type=str, default=None, help="Target release version to verify")
    parser.add_argument("--skip-tests", action="store_true", help="Skip test suite execution")
    parser.add_argument("--ci", action="store_true", help="CI execution mode")
    parser.add_argument("--audit-tests", action="store_true", help="Audit test suites for mock dominance and anti-patterns")
    args = parser.parse_args()

    root_dir = args.root.resolve() if args.root else Path.cwd().resolve()
    target_version = args.version or os.environ.get("RELEASE_VERSION")

    print("=" * 60)
    print("🚀 Git Flow Release Verification Engine")
    print(f"📂 Auditing root: {root_dir}")
    if target_version:
        print(f"🎯 Target version: {target_version}")
    print("=" * 60)

    checks: List[bool] = []

    if args.audit_tests and not args.skip_tests:
        checks.append(check_test_theatre_audit(root_dir))

    # Standard release verification checks
    if not args.audit_tests or args.ci or target_version:
        checks.append(check_semver_format(target_version))
        checks.append(check_changelog_headers(root_dir, target_version))
        checks.append(check_manifest_versions(root_dir, target_version))
        checks.append(check_markdown_links(root_dir))

    success = all(checks) if checks else True
    print("=" * 60)
    if success:
        print("✅ Release verification passed all quality gates.")
        sys.exit(0)
    else:
        print("❌ Release verification failed one or more quality gates.")
        sys.exit(1)

if __name__ == "__main__":
    main()
