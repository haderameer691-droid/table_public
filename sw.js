// ارفعي رقم النسخة كلما عدّلتِ أي ملف ليتحدّث عند المستخدمين
const VERSION = "v3";
const CACHE = "school-portal-" + VERSION;

// الملفات تُخزَّن كل واحد على حدة: لو غاب ملف لا يفشل التخزين كله
const FILES = [
  "./", "index.html", "index4.html", "examlists.html", "indexLists.html",
  "indexexam.html", "seats.html", "absences.html",
  "manifest.json", "icon-192.png", "icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(FILES.map((f) => c.add(new Request(f, { cache: "reload" }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// من الذاكرة أولاً (يعمل بدون نت)، وتحديث النسخة المخزّنة في الخلفية عند وجود نت
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // access.json يتحكم بتسجيل الخروج عن بُعد، فيجب أن يصل دائمًا من الشبكة مباشرة بدون أي تخزين مؤقت
  if (url.pathname.endsWith("access.json")) {
    e.respondWith(fetch(req, { cache: "no-store" }).catch(() => new Response("{}", { headers: { "Content-Type": "application/json" } })));
    return;
  }

  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const refresh = fetch(req, isFont ? undefined : { cache: "no-cache" })
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) { e.waitUntil(refresh); return cached; }
      const res = await refresh;
      if (res) return res;
      if (req.mode === "navigate") {
        return (await cache.match("index.html")) || (await cache.match("index4.html")) || (await cache.match("./")) ||
          new Response("لا يوجد اتصال", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      return new Response("", { status: 504 });
    })
  );
});
