#!/usr/bin/env bash
# PreToolUse(Bash) hook: `gh pr create` の前に PR の品質を検査する。
# 違反があれば exit 2 で実行を止め、理由を stderr で Claude に返す。
set -u

input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")

# gh pr create 以外は何もしない
grep -Eq '(^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)' <<<"$cmd" || exit 0

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
template="$root/.github/PULL_REQUEST_TEMPLATE.md"
errors=()

# 本文: コマンド文字列に埋め込まれた本文 + --body-file/-F の中身
body="$cmd"
file=$(sed -nE 's/.*(--body-file|-F)[ =]+([^ ]+).*/\2/p' <<<"$cmd" | head -n1)
if [ -n "$file" ] && [ "$file" != "-" ] && [ -f "$file" ]; then
  body="$body"$'\n'"$(cat "$file")"
fi

# 1. main / master から直接 PR を作らない
branch=$(git -C "$root" branch --show-current)
case "$branch" in
  main|master) errors+=("現在のブランチが ${branch} です。作業ブランチを切ってから PR を作成してください。") ;;
esac

# 2. テンプレートの「## 見出し」がすべて本文にあること
if [ -f "$template" ]; then
  while IFS= read -r heading; do
    grep -Fq -- "$heading" <<<"$body" || errors+=("PR 本文に見出し「${heading}」がありません（.github/PULL_REQUEST_TEMPLATE.md に従ってください）。")
  done < <(grep -E '^## ' "$template")
fi

# 3. 見た目に関わるファイルを変更したら、スクリーンショットの画像が必要
base=$(git -C "$root" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)
ui=$(git -C "$root" diff --name-only "$base"...HEAD 2>/dev/null | grep -E '^(theme\.css|components/|docs/|public/)' || true)
if [ -n "$ui" ] && ! grep -Eq '!\[[^]]*\]\([^)]+\)' <<<"$body"; then
  errors+=("見た目に関わるファイルを変更していますが、スクリーンショット（![alt](url) 形式の画像）がありません。変更ファイル: $(tr '\n' ' ' <<<"$ui")")
fi

# 4. 認証情報らしき文字列を含めない
if grep -Eiq '(ntn_|secret_)[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|NOTION_(TOKEN|DATABASE_ID)[[:space:]]*[=:][[:space:]]*[A-Za-z0-9_-]{16,}' <<<"$body"; then
  errors+=("PR 本文に認証情報（トークンやデータベース ID）らしき文字列が含まれています。取り除いてください。")
fi

if [ "${#errors[@]}" -gt 0 ]; then
  {
    echo "gh pr create をブロックしました。次を直してから再実行してください:"
    printf ' - %s\n' "${errors[@]}"
  } >&2
  exit 2
fi
exit 0
