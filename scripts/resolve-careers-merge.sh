#!/usr/bin/env bash
# Complete the specific historical add/add careers merge without discarding
# local commits or adding uploaded media. Invoke with bash from the Web checkout.
set -euo pipefail
umask 077

fail() { printf '%s\n' "$*" >&2; exit 1; }
command -v git >/dev/null || fail 'Git est requis.'
command -v node >/dev/null || fail 'Node.js est requis.'
[ -z "${GIT_INDEX_FILE:-}" ] || fail 'Un index Git alternatif est actif : arrêt sans modification.'
root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail 'Exécutez ce script dans CashPay Web.'
cd "$root"
[ "$(git branch --show-current)" = main ] || fail 'La branche courante doit être main.'

# Read the configured URL before any URL rewrite. This also permits testing with
# a local synthetic remote through Git insteadOf, without any network access.
origin="$(git config --get remote.origin.url || true)"
case "$origin" in
  git@github.com:Finuseco/cashpay_web|git@github.com:Finuseco/cashpay_web.git|https://github.com/Finuseco/cashpay_web|https://github.com/Finuseco/cashpay_web.git|ssh://git@github.com/Finuseco/cashpay_web|ssh://git@github.com/Finuseco/cashpay_web.git) ;;
  *) fail 'Le dépôt origin doit être Finuseco/cashpay_web. Aucun fichier modifié.' ;;
esac

head_before="$(git rev-parse HEAD)"
merge_head="$(git rev-parse --verify MERGE_HEAD 2>/dev/null)" || fail 'Aucune fusion Git en cours.'
[[ "$merge_head" =~ ^[0-9a-f]{40}$ ]] || fail 'Fusion multiple inattendue : arrêt.'
paths=(src/lib/careers/handler.js src/lib/careers/mailer.js src/lib/careers/templates.js tests/careers.test.js)
expected="$(printf '%s\n' "${paths[@]}" | LC_ALL=C sort)"
actual="$(git diff --name-only --diff-filter=U | LC_ALL=C sort)"
[ "$actual" = "$expected" ] || fail 'Les conflits ne correspondent pas aux quatre fichiers Carrières attendus. Aucun fichier modifié.'

check_staged() {
  local path
  while IFS= read -r -d '' path; do
    case "$path" in
      src/lib/careers/assets.js|src/lib/careers/handler.js|src/lib/careers/mailer.js|src/lib/careers/templates.js|tests/careers.test.js) ;;
      *) fail "Un autre fichier est déjà indexé : $path. Arrêt pour éviter de le committer." ;;
    esac
  done < <(git diff --cached --name-only -z)
}
check_staged
for path in "${paths[@]}"; do
  [ -f "$path" ] && [ ! -L "$path" ] || fail "Fichier ordinaire attendu : $path"
  git cat-file -e ":2:$path" && git cat-file -e ":3:$path" || fail "Conflit add/add attendu : $path"
done

git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
target="$(git rev-parse refs/remotes/origin/main)"
git merge-base --is-ancestor "$merge_head" "$target" || fail 'La fusion en cours ne vient pas de cet historique origin/main. Aucun fichier modifié.'
for path in "${paths[@]}"; do
  git cat-file -e "$target:$path" || fail "Le fichier $path manque dans origin/main."
done

# The four source files refer to the CID assets already added by the pending
# merge. Refuse a mixed asset version rather than silently replacing a fifth file.
asset=src/lib/careers/assets.js
asset_target="$(git rev-parse "$target:$asset")" || fail 'Les logos Carrières manquent dans origin/main.'
[ -f "$asset" ] && [ ! -L "$asset" ] || fail 'Le fichier des logos Carrières manque dans la fusion.'
[ "$(git hash-object -- "$asset")" = "$asset_target" ] || fail 'Les logos locaux diffèrent de origin/main. Arrêt pour examen manuel.'
[ "$(git rev-parse ":$asset")" = "$asset_target" ] || fail 'Les logos indexés diffèrent de origin/main. Arrêt pour examen manuel.'

git_dir="$(git rev-parse --absolute-git-dir)"
index_file="$(git rev-parse --path-format=absolute --git-path index)"
mkdir -p "$git_dir/cashpay-merge-backups"
chmod 700 "$git_dir/cashpay-merge-backups"
backup="$(mktemp -d "$git_dir/cashpay-merge-backups/careers.XXXXXX")"
cp -p -- "$index_file" "$backup/index"
git ls-files --stage -z > "$backup/index.entries"
printf 'HEAD=%s\nMERGE_HEAD=%s\nTARGET=%s\n' "$head_before" "$merge_head" "$target" > "$backup/state.txt"
for path in "${paths[@]}"; do
  mkdir -p "$backup/worktree/$(dirname "$path")" "$backup/ours/$(dirname "$path")" "$backup/theirs/$(dirname "$path")"
  cp -p -- "$path" "$backup/worktree/$path"
  git show ":2:$path" > "$backup/ours/$path"
  git show ":3:$path" > "$backup/theirs/$path"
done
backup_branch="backup/careers-before-merge-$(date -u +%Y%m%dT%H%M%SZ)-$$"
git branch "$backup_branch" "$head_before"
printf 'Sauvegarde des fichiers et de l’index : %s\nBranche des commits locaux : %s\n' "$backup" "$backup_branch"

restore_on_failure=1
index_matches() { [ -f "$1" ] && cmp -s "$1" <(git ls-files --stage -z); }
rollback() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$restore_on_failure" = 1 ]; then
    if [ "$(git rev-parse HEAD)" = "$head_before" ] && [ "$(git rev-parse --verify MERGE_HEAD 2>/dev/null || true)" = "$merge_head" ] &&
       { index_matches "$backup/index.entries" || index_matches "$backup/script-staged.entries"; }; then
      for path in "${paths[@]}"; do cp -p -- "$backup/worktree/$path" "$path"; done
      cp -p -- "$backup/index" "$index_file"
      printf 'Échec avant commit : les quatre fichiers et l’index initial ont été restaurés. Sauvegarde : %s\n' "$backup" >&2
    else
      printf 'L’état Git a changé pendant la vérification : aucune restauration automatique. Sauvegarde : %s\n' "$backup" >&2
    fi
  fi
  exit "$status"
}
trap rollback EXIT

[ "$(git rev-parse HEAD)" = "$head_before" ] || fail 'HEAD a changé pendant la préparation.'
cmp -s "$index_file" "$backup/index" || fail 'L’index a changé pendant la préparation.'
git restore --source="$target" --worktree -- "${paths[@]}"
for path in "${paths[@]}"; do node --check "$path"; done
node --test tests/careers.test.js

check_staged
cmp -s "$index_file" "$backup/index" || fail 'L’index a changé pendant les tests.'
git add -- "${paths[@]}"
cp -p -- "$index_file" "$backup/script-staged-index"
git ls-files --stage -z > "$backup/script-staged.entries"
[ -z "$(git diff --name-only --diff-filter=U)" ] || fail 'Des conflits restent présents.'
git commit --no-edit
restore_on_failure=0

# Preserve all existing commits. A further conflict stops here for review;
# neither reset, clean, abort, stash nor automatic conflict preferences are used.
if ! git merge --no-edit "$target"; then
  printf 'La première fusion est conservée. La mise à jour suivante nécessite une résolution manuelle.\n' >&2
  git status --short --branch
  exit 1
fi
printf 'Fusion Carrières terminée et origin/main intégré. Aucun build ou redémarrage exécuté.\n'
git status --short --branch
