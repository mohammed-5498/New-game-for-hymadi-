#!/bin/bash
# نسخة لينكس من اللعبة للقياس (2.8.0): ./make.sh <مجلد> [نسخة git، مثلاً HEAD~1 للمقارنة]. تحتاج Flutter في PATH وأدوات
# البناء (README.md). المجلد خارج المستودع، ويُبنى بـ Impeller كما في الجوال
set -e
here=$(cd "$(dirname "$0")" && pwd); game=$(cd "$here/../../flutter_game" && pwd); dir=$1; rev=$2
mkdir -p "$dir"
[ -d "$dir/linux" ] || (cd "$dir" && flutter create --platforms=linux --project-name gangcity . >/dev/null)
rm -rf "$dir/lib" "$dir/test" "$dir/tool"
(cd "$game" && tar cf - --exclude=./build --exclude=./.dart_tool --exclude=./android --exclude=./linux .) | tar xf - -C "$dir"
if [ -n "$rev" ]; then rm -rf "$dir/lib"; (cd "$game/.." && git archive "$rev" flutter_game/lib) | tar xf - -C "$dir" --strip-components=1; fi
python3 "$here/patch.py" "$dir"
(cd "$dir" && flutter build linux --release 2>&1 | tail -1)
