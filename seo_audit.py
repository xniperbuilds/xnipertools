# -*- coding: utf-8 -*-
"""Xnipertools full-site SEO audit. Regex-based (files are well-formed, single-line meta tags)."""
import os, re, glob, json, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else "seo-audit-report.txt")

UTILITY_PAGES = {"404.html", "offline.html"}          # noindex utility pages: lighter rules
SITE_PAGES = {"about.html", "contact.html", "privacy.html", "terms.html"}  # info pages: no WebApplication; clean URLs (no .html) in canonical+sitemap
FORM_PAGES = {"report-bug/index.html", "request-a-tool/index.html"}  # WebPage schema is correct for these

sitemap = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
homepage = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

htmls = sorted(glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True))
htmls = [h for h in htmls if ".git" not in h]

report, totals = [], {"FAIL": 0, "WARN": 0}

def check(lines, ok, level, msg):
    if ok:
        return
    lines.append(("  [%s] " % level) + msg)
    totals[level] += 1

for path in htmls:
    rel = os.path.relpath(path, ROOT).replace("\\", "/")
    txt = open(path, encoding="utf-8").read()
    # split at the real head/body boundary (</head> followed by <body) —
    # pages ABOUT meta tags can contain a literal "</head>" inside head content
    mhb = re.search(r"</head>\s*<body", txt)
    if mhb:
        head, body = txt[:mhb.start()], txt[mhb.end():]
    else:
        head = txt.split("</head>")[0]
        body = txt.split("</head>")[1] if "</head>" in txt else txt
    is_util = rel in UTILITY_PAGES
    is_site = rel in SITE_PAGES
    is_home = rel == "index.html"
    is_games = rel == "games/index.html"
    is_ghub = rel == "guides/index.html"
    is_guide = rel.startswith("guides/") and not is_ghub
    is_noindex = re.search(r'name="robots" content="noindex', head) is not None
    slug = rel.replace("/index.html", "/").replace("index.html", "")
    lines = []

    # 1. title
    m = re.search(r"<title>(.*?)</title>", head, re.S)
    if not m:
        check(lines, False, "FAIL", "no <title>")
    else:
        t = re.sub(r"&amp;", "&", m.group(1).strip())
        t = re.sub(r"&[a-z]+;|&#\d+;", "x", t)
        if not is_util:
            check(lines, len(t) <= 65, "WARN", "title %d chars (>65): %s" % (len(t), t[:70]))
            check(lines, len(t) >= 25, "WARN", "title %d chars (<25): %s" % (len(t), t))

    # 2. description
    m = re.search(r'<meta name="description" content="(.*?)"', head, re.S)
    if not is_util:
        if not m:
            check(lines, False, "FAIL", "no meta description")
        else:
            d = re.sub(r"&amp;", "&", m.group(1))
            d = re.sub(r"&[a-z]+;|&#\d+;", "x", d)
            check(lines, len(d) <= 175, "WARN", "description %d chars (>175)" % len(d))
            check(lines, len(d) >= 90, "WARN", "description %d chars (<90)" % len(d))

    # 3. robots (deliberately-noindexed pages are fine)
    if is_util:
        check(lines, 'name="robots" content="noindex' in head, "WARN", "utility page should be noindex")
    else:
        check(lines, ('name="robots" content="index, follow' in head) or is_noindex, "FAIL", "robots meta missing/wrong")

    # 4. author
    if not is_util:
        check(lines, '<meta name="author" content="Xnipertools">' in head, "WARN", "author meta missing")

    # 5. canonical
    if not is_util:
        m = re.search(r'<link rel="canonical" href="([^"]+)"', head)
        if not m:
            check(lines, False, "FAIL", "canonical missing")
        else:
            want = "https://xnipertools.com/" + (slug if slug else "")
            if rel in SITE_PAGES:
                want = "https://xnipertools.com/" + rel[:-5]  # clean URL, no .html
            check(lines, m.group(1) == want, "FAIL", "canonical is %s (want %s)" % (m.group(1), want))

    # 6. OG (9 tags)
    if not is_util:
        for tag in ["og:type", "og:url", "og:title", "og:description", "og:image",
                    "og:image:width", "og:image:height", "og:site_name", "og:locale"]:
            check(lines, ('property="%s"' % tag) in head, "FAIL", "missing %s" % tag)

    # 7. Twitter (4 tags)
    if not is_util:
        for tag in ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]:
            check(lines, ('name="%s"' % tag) in head, "FAIL", "missing %s" % tag)

    # 8. JSON-LD valid + schemas
    blobs = re.findall(r'<script type="application/ld\+json">(.*?)</script>', txt, re.S)
    bad = 0
    types = []
    for b in blobs:
        try:
            data = json.loads(b)
            def collect(d):
                if isinstance(d, dict):
                    if "@type" in d:
                        v = d["@type"]
                        types.extend(v if isinstance(v, list) else [v])
                    for vv in d.values():
                        collect(vv)
                elif isinstance(d, list):
                    for vv in d:
                        collect(vv)
            collect(data)
        except Exception as e:
            bad += 1
    check(lines, bad == 0, "FAIL", "%d invalid JSON-LD block(s)" % bad)
    if is_guide:
        check(lines, "Article" in types, "FAIL", "guide missing Article schema (found: %s)" % (", ".join(sorted(set(types))) or "none"))
    elif not (is_util or is_site or is_home or is_ghub or rel in FORM_PAGES):
        check(lines, ("WebApplication" in types) or ("VideoGame" in types) or ("CollectionPage" in types),
              "FAIL", "no WebApplication schema (found: %s)" % (", ".join(sorted(set(types))) or "none"))
        check(lines, "BreadcrumbList" in types, "WARN", "no BreadcrumbList schema")
        # FAQ visible but no FAQPage schema?
        has_faq_visible = re.search(r">\s*FAQ\s*<|frequently asked", body, re.I)
        if has_faq_visible:
            check(lines, "FAQPage" in types, "WARN", "visible FAQ but no FAQPage schema")
    if is_home:
        check(lines, "WebSite" in types, "FAIL", "homepage missing WebSite schema")
        check(lines, "Organization" in types, "WARN", "homepage missing Organization schema")

    # 9. GA4 — present, and first script must be anti-flash then GA4
    if not is_util:
        check(lines, "G-2G2RG8P4CJ" in head, "FAIL", "GA4 snippet missing")
        check(lines, "xt_theme" in head, "WARN", "anti-flash theme script missing from head")
        # GA4 is deliberately deferred to first interaction (perf pass 2026-07-22), so it is
        # no longer the first external script. That old rule now fires on every page and
        # buries real issues — check for render-blocking head scripts instead, which is
        # what actually matters for speed.
        blocking = [s for s in re.findall(r"<script[^>]*src=[^>]*?>", head)
                    if " async" not in s and " defer" not in s]
        check(lines, not blocking, "WARN",
              "render-blocking script in head: " + (blocking[0][:70] if blocking else ""))

    # 10/11. favicons
    check(lines, '/favicon.ico' in head, "FAIL", "favicon.ico link missing")
    if not is_util:
        check(lines, 'sizes="96x96" href="/favicon-96.png"' in head, "WARN", "favicon-96.png link missing")
    check(lines, 'href="data:' not in head, "FAIL", "data-URI favicon found")

    # 12. exactly one h1
    h1s = len(re.findall(r"<h1[\s>]", body))
    if not is_util:
        check(lines, h1s == 1, "FAIL", "%d <h1> tags (want exactly 1)" % h1s)

    # 13. breadcrumb
    if not (is_util or is_home or is_games):
        check(lines, ('class="breadcrumb' in body) or ('aria-label="Breadcrumb"' in body),
              "WARN", "no breadcrumb nav")

    # 14. more tools block (guides hub is a listing page — exempt)
    if not (is_util or is_home or is_games or is_ghub or rel == "privacy.html" or rel == "terms.html"):
        check(lines, re.search(r"More tools|More Free Tools|more-tools", body, re.I) is not None,
              "WARN", "no 'More tools' block")

    # 15. sitemap entry (noindexed pages are deliberately absent)
    if not is_util and rel != "404.html" and not is_noindex:
        url = "https://xnipertools.com/" + (slug if not is_home else "")
        if rel in SITE_PAGES:
            url = "https://xnipertools.com/" + rel[:-5]  # clean URL, no .html
        check(lines, url in sitemap, "FAIL", "missing from sitemap.xml: %s" % url)

    # 16. homepage card — tools render from the JS TOOLS array ("url":"slug/"),
    #     guides appear via the guides row / hub, noindexed pages are exempt
    if not (is_util or is_site or is_home or is_guide or is_ghub or is_noindex):
        s = slug.rstrip("/")
        check(lines, ('href="%s/"' % s) in homepage or ('href="/%s/"' % s) in homepage or ('"%s/"' % s) in homepage,
              "WARN", "no homepage card/link for %s" % s)

    status = "CLEAN" if not lines else ("%d issue(s)" % len(lines))
    report.append("%-50s %s" % (rel, status))
    report.extend(lines)

# sitemap orphans: URLs in sitemap with no file (clean URLs like /about map to about.html)
for loc in re.findall(r"<loc>(.*?)</loc>", sitemap):
    pathpart = loc.replace("https://xnipertools.com/", "")
    f = os.path.join(ROOT, pathpart.replace("/", os.sep) + ("index.html" if loc.endswith("/") and pathpart else ""))
    if pathpart == "":
        f = os.path.join(ROOT, "index.html")
    if not os.path.exists(f) and not loc.endswith("/") and os.path.exists(f + ".html"):
        continue  # clean URL served from <name>.html
    if not os.path.exists(f):
        report.append("SITEMAP ORPHAN: %s" % loc)
        totals["FAIL"] += 1

report.append("")
report.append("TOTAL: %d FAIL, %d WARN across %d files" % (totals["FAIL"], totals["WARN"], len(htmls)))
open(OUT, "w", encoding="utf-8").write("\n".join(report))
print("\n".join(report[-40:]))
print("\nReport saved:", OUT)
