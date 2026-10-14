#!/usr/bin/env bash
# Git Flow Release Helper
# Automates branch creation for release stabilization and urgent hotfixes.

set -euo pipefail

# Find repository root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

SEMVER_REGEX="^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$"

show_help() {
    cat << 'EOF'
Git Flow Release Helper

Usage:
  ./git-flow-release.sh start <version>   Start a release branch from develop
  ./git-flow-release.sh hotfix <version>  Start a hotfix branch from main
  ./git-flow-release.sh help              Display this usage guide

Arguments:
  <version>  Semantic version string (e.g., 1.2.0 or v1.2.0)

Examples:
  ./git-flow-release.sh start 1.2.0
  ./git-flow-release.sh hotfix 1.2.1
EOF
}

verify_clean_worktree() {
    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo "❌ Error: Working tree contains uncommitted modifications." >&2
        echo "   Commit or stash all changes before starting a release branch." >&2
        exit 1
    fi
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ Error: Working tree contains untracked files." >&2
        echo "   Clean, commit, or stash untracked files before proceeding." >&2
        exit 1
    fi
}

normalize_version() {
    local ver="$1"
    ver="${ver#v}"
    if [[ ! "$ver" =~ $SEMVER_REGEX ]]; then
        echo "❌ Error: Invalid SemVer version '$1'." >&2
        echo "   Expected format: X.Y.Z or X.Y.Z-prerelease (e.g. 1.2.0, 2.0.0-rc.1)" >&2
        exit 1
    fi
    echo "$ver"
}

cmd_start() {
    if [ -z "${1:-}" ]; then
        echo "❌ Error: Missing version argument for 'start' command." >&2
        echo "   Usage: ./git-flow-release.sh start <version>" >&2
        exit 1
    fi

    local version
    version="$(normalize_version "$1")"
    local branch_name="release/v${version}"

    verify_clean_worktree

    echo "🔍 Checking for existing branch '$branch_name'..."
    if git rev-parse --verify "$branch_name" >/dev/null 2>&1; then
        echo "❌ Error: Local branch '$branch_name' already exists." >&2
        exit 1
    fi

    echo "🔄 Checking out integration branch 'develop'..."
    git checkout develop

    if git remote | grep -q "^origin$"; then
        echo "📥 Pulling latest commits from origin/develop..."
        git pull --ff-only origin develop || echo "⚠️ Warning: Failed to pull origin/develop (network error or diverged branch)."
    fi

    echo "🌱 Creating release branch '$branch_name'..."
    git checkout -b "$branch_name"

    echo ""
    echo "✅ Successfully created release branch '$branch_name'."
    echo ""
    echo "Next steps:"
    echo "  1. Bump version numbers across project manifests."
    echo "  2. Update release notes in CHANGELOG.md."
    echo "  3. Run verification: python scripts/verify_release.py"
    echo "  4. Commit changes:   ./scripts/commit.sh \"chore(release): prepare v${version}\""
    echo "  5. Push to remote:   git push -u origin $branch_name"
}

cmd_hotfix() {
    if [ -z "${1:-}" ]; then
        echo "❌ Error: Missing version argument for 'hotfix' command." >&2
        echo "   Usage: ./git-flow-release.sh hotfix <version>" >&2
        exit 1
    fi

    local version
    version="$(normalize_version "$1")"
    local branch_name="hotfix/v${version}"

    verify_clean_worktree

    echo "🔍 Checking for existing branch '$branch_name'..."
    if git rev-parse --verify "$branch_name" >/dev/null 2>&1; then
        echo "❌ Error: Local branch '$branch_name' already exists." >&2
        exit 1
    fi

    echo "🔄 Checking out production branch 'main'..."
    git checkout main

    if git remote | grep -q "^origin$"; then
        echo "📥 Pulling latest commits from origin/main..."
        git pull --ff-only origin main || echo "⚠️ Warning: Failed to pull origin/main (network error or diverged branch)."
    fi

    echo "🚨 Creating hotfix branch '$branch_name'..."
    git checkout -b "$branch_name"

    echo ""
    echo "✅ Successfully created hotfix branch '$branch_name'."
    echo ""
    echo "Next steps:"
    echo "  1. Apply fix and write regression tests."
    echo "  2. Bump patch version in manifests and CHANGELOG.md."
    echo "  3. Run verification: python scripts/verify_release.py"
    echo "  4. Commit changes:   ./scripts/commit.sh \"fix: describe critical bug resolution\""
    echo "  5. Push to remote:   git push -u origin $branch_name"
}

# Command dispatcher
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
    start)
        cmd_start "${1:-}"
        ;;
    hotfix)
        cmd_hotfix "${1:-}"
        ;;
    help|--help|-h)
        show_help
        exit 0
        ;;
    *)
        echo "❌ Error: Unknown command '$COMMAND'." >&2
        echo ""
        show_help
        exit 1
        ;;
esac
