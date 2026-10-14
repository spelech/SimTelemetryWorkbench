#!/usr/bin/env bash
set -euo pipefail

# Change to the script's directory (repo root)
cd "$(dirname "$0")/.."

if [ -z "${1:-}" ]; then
    echo "Usage: ./commit.sh \"<commit_message>\""
    exit 1
fi

COMMIT_MSG="$1"

# Traditional Git Flow branch protection guard
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    if [ "${ALLOW_MAIN_COMMIT:-0}" != "1" ]; then
        echo "❌ Error: Direct commits to '$CURRENT_BRANCH' are forbidden in Git Flow." >&2
        echo "   Commits must occur on 'feature/*', 'develop', 'release/*', or 'hotfix/*' branches." >&2
        echo "   - To start a release branch: ./scripts/git-flow-release.sh start <version>" >&2
        echo "   - To start a hotfix branch:  ./scripts/git-flow-release.sh hotfix <version>" >&2
        echo "   (Set ALLOW_MAIN_COMMIT=1 to bypass for administrative actions)." >&2
        exit 1
    fi
fi

# Conventional Commit format audit
CONVENTIONAL_REGEX="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_.-]+\))?: .+"
if ! echo "$COMMIT_MSG" | grep -Eq "$CONVENTIONAL_REGEX"; then
    echo "⚠️ Warning: Commit message does not follow Conventional Commits format."
    echo "   Recommended format: <type>(<optional-scope>): <summary>"
    echo "   Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
fi

echo "🔍 Validating backend Release build..."
if compgen -G "*.sln" > /dev/null || compgen -G "*.slnx" > /dev/null; then
    dotnet build --configuration Release
fi

echo "🔄 Running automated version bump..."
if [ -f scripts/bump_version.py ]; then
    python3 scripts/bump_version.py "$COMMIT_MSG"
fi

echo "💾 Creating atomic commit: '$COMMIT_MSG'..."
git add -u
git commit -m "$COMMIT_MSG"
echo "✅ Commit created successfully."
