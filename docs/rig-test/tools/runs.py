# runs.py <img> <x0> <x1> <y...> : لكل صف، مقاطع الألوان المتتالية بإحداثياتها (بكسل كامل)
import sys, subprocess
img, x0, x1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
def cls(r, g, b, a):
    if a < 40: return '.'
    if r < 60 and g < 60 and b < 70: return 'K'
    if b > 150 and r < 80: return 'B'
    if r > 200 and g > 200 and b > 200: return 'W'
    if r > 180 and g < 80 and b < 80: return 'R'
    if r > 100 and g > 50 and b < 60 and r > g: return 'N'
    if abs(r - g) < 20 and abs(g - b) < 20: return 'G'
    if b > 100 and r < 60: return 'b'
    return '?'
for y in map(int, sys.argv[4:]):
    raw = subprocess.run(['convert', img, '-crop', f'{x1-x0}x1+{x0}+{y}', '+repage', '-depth', '8', 'rgba:-'], capture_output=True).stdout
    row = [cls(*raw[i:i+4]) for i in range(0, len(raw), 4)]
    out, start = [], 0
    for i in range(1, len(row) + 1):
        if i == len(row) or row[i] != row[start]:
            if i - start >= 2 or row[start] != '?': out.append(f'{row[start]}{x0+start}-{x0+i-1}')
            start = i
    print(y, ' '.join(out))
