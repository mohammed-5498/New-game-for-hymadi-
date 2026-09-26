#!/usr/bin/env bash
# ينسخ ملفات اللعبة كما هي إلى www/ ليأخذها Capacitor.
# ليست أداة بناء: لا تحويل ولا تجميع، نسخ حرفي فقط.
# نفس الملفات التي يقدّمها GitHub Pages، فالكود واحد للمتصفح والتطبيق.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf www
mkdir -p www

cp index.html www/
cp -r css www/
cp -r js www/

# مراجع يستوردها كود اللعبة وقت التشغيل (إن وُجدت)
# ملاحظة: js/render/unitsArt.js وjs/audio/audio.js نسختان داخل js/ أصلاً،
# فلا يحتاج التطبيق مجلد docs، وهو مرجع للتطوير فقط.

echo "www/ جاهز:"
find www -type f | wc -l | xargs echo "  عدد الملفات:"
du -sh www | cut -f1 | xargs echo "  الحجم:"
