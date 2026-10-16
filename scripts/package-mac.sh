#!/usr/bin/env bash
# 从 origin/main 打出 Apple Silicon 内测磁盘映像。不切换当前分支。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$HOME/.cargo/bin:$PATH"

NOTE="$ROOT/src-tauri/bundle/macos/首次打开.txt"
if [[ ! -f "$NOTE" ]]; then
  echo "缺少说明文件：$NOTE" >&2
  exit 1
fi

git fetch origin main

if git rev-parse --verify --quiet refs/heads/main >/dev/null; then
  ahead="$(git rev-list --count origin/main..main)"
  if [[ "$ahead" -gt 0 ]]; then
    echo "本地 main 有 ${ahead} 个尚未推送到 origin/main 的提交，已停止打包：" >&2
    git log --oneline origin/main..main >&2
    exit 1
  fi
fi

sha="$(git rev-parse --short=7 origin/main)"
wt="$ROOT/.packaging/main"

mkdir -p "$ROOT/.packaging"

if [[ -f "$wt/.git" || -d "$wt/.git" ]]; then
  git -C "$wt" checkout --detach origin/main
  git -C "$wt" reset --hard origin/main
  git -C "$wt" clean -fd -e node_modules -e src-tauri/target
else
  if [[ -e "$wt" ]]; then
    echo "目录已存在但不是 git 工作目录：$wt" >&2
    exit 1
  fi
  git worktree add --detach "$wt" origin/main
fi

if ! rustup target list --installed | grep -qx 'aarch64-apple-darwin'; then
  rustup target add aarch64-apple-darwin
fi

(
  cd "$wt"
  npm ci
  version="$(node -e "console.log(require('./src-tauri/tauri.conf.json').version)")"
  echo "$version" >"$ROOT/.packaging/version"
  export APPLE_SIGNING_IDENTITY="-"
  npm run tauri -- build --target aarch64-apple-darwin --bundles dmg
)

version="$(cat "$ROOT/.packaging/version")"
dmg_dir="$wt/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg"
src_dmg="$(find "$dmg_dir" -name '*.dmg' | head -n 1)"
if [[ -z "$src_dmg" ]]; then
  echo "没有找到磁盘映像：$dmg_dir" >&2
  exit 1
fi

stage="$(mktemp -d)"
mount="$stage/mount"
cleanup() {
  if [[ -d "$mount" ]] && mount | grep -F -q " on $mount "; then
    hdiutil detach "$mount" >/dev/null || true
  fi
  rm -rf "$stage"
}
trap cleanup EXIT

hdiutil convert "$src_dmg" -format UDRW -ov -o "$stage/rw" >/dev/null
rw="$stage/rw.dmg"
if [[ ! -f "$rw" ]]; then
  rw="$(find "$stage" -name 'rw*.dmg' | head -n 1)"
fi

mkdir -p "$mount"
hdiutil attach "$rw" -mountpoint "$mount" -nobrowse -noverify -noautoopen >/dev/null
cp "$NOTE" "$mount/首次打开.txt"
# Finder 会把 .VolumeIcon.icns 画在窗口里，隐藏标记也挡不住。去掉它，窗口里就只剩应用。
rm -f "$mount/.VolumeIcon.icns"
SetFile -a c "$mount"
# 窗口宽 760、高 260。三个图标的中心等距，并在窗口里水平居中；纵坐标抬高，避免上方空出一大块。
osascript <<EOF
tell application "Finder"
  set theFolder to POSIX file "$mount" as alias
  open theFolder
  set w to container window of theFolder
  set current view of w to icon view
  set toolbar visible of w to false
  set statusbar visible of w to false
  set bounds of w to {120, 80, 880, 340}
  set opts to icon view options of w
  set arrangement of opts to not arranged
  set icon size of opts to 128
  set position of item "CEOS.app" of theFolder to {158, 110}
  set position of item "首次打开.txt" of theFolder to {380, 110}
  set position of item "Applications" of theFolder to {602, 110}
  set selection to {}
  update theFolder without registering applications
  delay 1
  close w
end tell
EOF
sync
hdiutil detach "$mount" >/dev/null

mkdir -p "$ROOT/release"
out="$ROOT/release/CEOS_${version}_${sha}_aarch64.dmg"
rm -f "$out" "${out}.dmg"
hdiutil convert "$rw" -format UDZO -ov -o "$out" >/dev/null
if [[ ! -f "$out" && -f "${out}.dmg" ]]; then
  mv "${out}.dmg" "$out"
fi

echo "$out"
