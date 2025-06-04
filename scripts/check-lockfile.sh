#!/bin/bash

set -e

echo "🔍 Scanning yarn.lock for undeclared packages (compared to develop)..."

# Check dependencies
command -v jq >/dev/null 2>&1 || {
  echo "❌ jq is required but not installed."
  exit 1
}
command -v git >/dev/null 2>&1 || {
  echo "❌ git is required but not installed."
  exit 1
}

TARGET_BRANCH=${TARGET_BRANCH:-develop}

# Fetch latest target branch
echo "📥 Fetching $TARGET_BRANCH..."
git fetch origin "$TARGET_BRANCH" || {
  echo "❌ Failed to fetch $TARGET_BRANCH."
  exit 1
}

# Temp files
tmp_declared=$(mktemp)
tmp_lockfile=$(mktemp)
tmp_diff_report=$(mktemp)

trap 'rm -f "$tmp_declared" "$tmp_lockfile" "$tmp_diff_report"' EXIT

# Read declared deps from package.json in develop
if ! git show "origin/$TARGET_BRANCH:package.json" >/dev/null 2>&1; then
  echo "❌ package.json not found in $TARGET_BRANCH."
  exit 1
fi
git show "origin/$TARGET_BRANCH:package.json" | jq -r '.dependencies, .devDependencies | keys[]' | sort | uniq >"$tmp_declared"

# Read top-level packages from current yarn.lock
if ! [ -f yarn.lock ]; then
  echo "❌ yarn.lock not found in current branch."
  exit 1
fi
grep -E '^ {0,2}"?[^ "@]+@[^:]+":$' yarn.lock | sed 's/^ *//;s/":$//;s/"//g' | grep -vE '^(workspace|virtual|portal|patch|__metadata)' | cut -d'@' -f1 | sort | uniq >"$tmp_lockfile"

# Compare
undeclared_packages=$(comm -13 "$tmp_declared" "$tmp_lockfile")

# Was package.json changed?
package_json_changed=$(git diff "origin/$TARGET_BRANCH" HEAD -- package.json | wc -l)

# Diff summary
git diff "origin/$TARGET_BRANCH" HEAD -- yarn.lock | grep -E '^[+-] {0,2}"?[^ "@]+@[^:]+":$' | sed 's/^[+-] *//;s/":$//;s/"//g' | while read -r line; do
  pkg=$(echo "$line" | cut -d'@' -f1)
  version=$(echo "$line" | cut -d'@' -f2-)
  if [[ $line == +* ]]; then
    echo "+ $pkg@$version" >>"$tmp_diff_report"
  elif [[ $line == -* ]]; then
    echo "- $pkg@$version" >>"$tmp_diff_report"
  fi
done

if [ -n "$undeclared_packages" ]; then
  echo "🚨 Undeclared packages in yarn.lock (not in $TARGET_BRANCH/package.json):"
  echo "$undeclared_packages" | while read -r pkg; do
    version=$(grep -E "^\"?$pkg@[^:]+\":$" yarn.lock | sed 's/.*@//;s/":$//' | head -n 1)
    echo "- $pkg@$version"
  done
  if [ "$package_json_changed" -eq 0 ]; then
    echo "⚠️ yarn.lock changed, but package.json did not."
  else
    echo "ℹ️ package.json changed — verify additions are intentional."
  fi
  if [ -s "$tmp_diff_report" ]; then
    echo "📈 yarn.lock diff summary:"
    cat "$tmp_diff_report"
  fi
  exit 1
else
  echo "✅ yarn.lock is consistent with package.json."
  if [ "$package_json_changed" -eq 0 ] && git diff "origin/$TARGET_BRANCH" HEAD -- yarn.lock | grep -q .; then
    echo "⚠️ yarn.lock changed but package.json did not. Possibly due to dedupe or version bumps."
    if [ -s "$tmp_diff_report" ]; then
      echo "📈 yarn.lock diff summary:"
      cat "$tmp_diff_report"
    fi
  fi
fi

lock_diff_lines=$(git diff "origin/$TARGET_BRANCH" HEAD -- yarn.lock | wc -l)
if [ "$lock_diff_lines" -gt 100 ]; then
  echo "📝 Large lockfile diff ($lock_diff_lines lines). Suggestions:"
  echo "   - Run 'yarn why <package>'"
  echo "   - Use 'git diff origin/$TARGET_BRANCH HEAD -- yarn.lock'"
  echo "   - Consider 'yarn dedupe'"
fi
