import os
from PIL import Image

root = r"C:\Users\thrillerpark\Desktop\Flagship Projects\Elekeza"

shots = {}
for d in ["artifacts/exhibition-qa", "e2e-evidence/02-user-journeys", "release-evidence/screenshots"]:
    full = os.path.join(root, d)
    if not os.path.isdir(full):
        continue
    for f in sorted(os.listdir(full)):
        if f.lower().endswith(('.png','.jpg','.webp')):
            p = os.path.join(full, f)
            try:
                im = Image.open(p)
                shots[f"{d}/{f}"] = dict(size=im.size, mode=im.mode, bytes=os.path.getsize(p))
            except Exception as e:
                shots[f"{d}/{f}"] = dict(error=str(e))

for k, v in shots.items():
    print(k, v)
