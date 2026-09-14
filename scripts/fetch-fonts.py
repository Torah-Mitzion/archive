import re, os, urllib.request, hashlib
os.chdir(r'C:\Users\rettig_h\TMZ_site')
URL = ("https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700"
       "&family=Heebo:wght@200;300;400;500;600&family=PT+Sans:wght@400;700&family=PT+Serif:wght@400;700&display=swap")
req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'})
css = urllib.request.urlopen(req).read().decode('utf-8')
os.makedirs('docs/fonts', exist_ok=True)
out = ["/* Self-hosted copies of the Google Fonts faces the site uses, fetched once\n   from fonts.gstatic.com and served from here. One vendor fewer on the\n   critical path, and the Hebrew subsets load from the same origin as the\n   page. Regenerate with scripts/fetch-fonts (see the commit that added it). */\n"]
blocks = re.findall(r'(/\* (\w[\w-]*) \*/\s*@font-face \{(.*?)\})', css, re.S)
n = 0
for whole, subset, body in blocks:
    fam = re.search(r"font-family: '([^']+)'", body).group(1)
    wt = re.search(r'font-weight: (\d+)', body).group(1)
    url = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)
    ur = re.search(r'unicode-range: ([^;]+);', body).group(1)
    name = f"{fam.replace(' ', '')}-{wt}-{subset}.woff2"
    path = f'docs/fonts/{name}'
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path); n += 1
    out.append(f"""@font-face {{ font-family: '{fam}'; font-style: normal; font-weight: {wt}; font-display: swap;
  src: url(fonts/{name}) format('woff2'); unicode-range: {ur}; }}""")
open('docs/fonts.css', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(len(blocks), 'faces,', n, 'downloaded,', sum(os.path.getsize('docs/fonts/'+f) for f in os.listdir('docs/fonts'))//1024, 'KB')
