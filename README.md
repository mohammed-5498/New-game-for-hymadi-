# مدينة العصابات (Gang City)

لعبة استراتيجية في الوقت الحقيقي للجوال، بزاوية كاميرا مائلة. عصابات تتقاتل للسيطرة على أحياء مدينة قديمة.

- الوصف الكامل للعبة: [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md)
- قواعد العمل على المشروع: [`CLAUDE.md`](CLAUDE.md)
- النموذج المرجعي: [`docs/prototype.html`](docs/prototype.html)

## كيف تشغّلها

اللعبة HTML5 Canvas + JavaScript بوحدات ES، بدون أدوات بناء. تحتاج خادم ملفات بسيط (لا تفتح `index.html` من القرص مباشرة):

```bash
python3 -m http.server 8000
```
ثم افتح `http://localhost:8000` في المتصفح.

وتعمل مباشرة على GitHub Pages من فرع المشروع.
