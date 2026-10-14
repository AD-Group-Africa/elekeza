import assemble_film as a
from collections import Counter

tl = a.build_timeline()
seq = a.expand(tl)
print("len(seq):", len(seq))
c = Counter(name for name,_ in seq)
print("actual total:", sum(c.values()))
print("per-scene actual:")
for k in sorted(c):
    print(f"  {k}: {c[k]}")
print("per-scene intended:")
tot=0
for name,frames,dur in tl:
    target=int(round(dur*30))
    tot+=target
    src_n=len(frames)
    print(f"  {name}: dur={dur} src_frames={src_n} target={target} actual={c.get(name,0)} diff={c.get(name,0)-target}")
print("sum targets:", tot)
