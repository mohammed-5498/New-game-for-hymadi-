# قياس معالج اللعبة على لينكس بـ Impeller (2.8.0): كل خيط بنسبته من نواة، والإطارات في الثانية، وكلفة الإطار على خيط الرسم.
# llvmpipe (رسم برمجي) يحل محل كرت الشاشة هنا: خيوطه لا تُحسب، والمقارنة بين نسختين في المشهد نفسه هي المفيدة
# الاستعمال: APP=<نسخة make.sh>/build/linux/x64/release/bundle/gangcity [SCALE=1] [HIDE=city,...] [NOHUD=1] [BLANK=1] [PAUSE=1]
#   python3 bench.py <اسم> <ثواني الانتظار> <ثواني القياس> "<GC_Q>" [shot]   (GC_Q فارغ: القائمة الرئيسية)
import os, sys, time, subprocess, collections, signal
name, wait, span, q = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
shot = len(sys.argv) > 5
import tempfile
SP = tempfile.mkdtemp(prefix='cpu_bench_')      # السجل والصورة هنا (يُطبع مكانها)
app = os.environ['APP']
disp = ':%d' % (90 + os.getpid() % 50)
xv = subprocess.Popen(['Xvfb', disp, '-screen', '0', '1920x1080x24', '-nolisten', 'tcp'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
env = dict(os.environ, DISPLAY=disp, GC_Q=q, GC_METER='1', GC_HIDE=os.environ.get('HIDE', ''), **({'GC_NOHUD': '1'} if os.environ.get('NOHUD') else {}), GDK_SCALE=os.environ.get('SCALE', '2'), **({} if os.environ.get('GUARD') else {'GC_NOGUARD': '1'}), **({'GC_PAUSE': '1'} if os.environ.get('PAUSE') else {}), **({'GC_BLANK': '1'} if os.environ.get('BLANK') else {}), **({'GC_SKIPGROUND': '1'} if os.environ.get('SKIPGROUND') else {}), **({'GC_SKIPROWS': '1'} if os.environ.get('SKIPROWS') else {}), **({'GC_FREEZE': os.environ['FREEZE']} if os.environ.get('FREEZE') else {}), **({'GC_VIAMENU': '1'} if os.environ.get('VIAMENU') else {}), **({'GC_FPS': os.environ['FPS']} if os.environ.get('FPS') else {}), **({'GC_NOLAG': '1'} if os.environ.get('NOLAG') else {}), **({'GC_SCREEN': os.environ['SCREEN']} if os.environ.get('SCREEN') else {}), LIBGL_ALWAYS_SOFTWARE='1', HOME=f'{SP}/benchhome')
os.makedirs(env['HOME'], exist_ok=True)
p = subprocess.Popen([app], env=env, stdout=open(f'{SP}/bench_{name}.log', 'w'), stderr=subprocess.STDOUT)
def sample():
    out = {}
    for tid in os.listdir(f'/proc/{p.pid}/task'):
        try:
            st = open(f'/proc/{p.pid}/task/{tid}/stat').read()
            comm = st[st.index('(') + 1:st.rindex(')')]
            f = st[st.rindex(')') + 2:].split()
            out[tid] = (comm, int(f[11]) + int(f[12]))
        except Exception:
            pass
    return out
try:
    time.sleep(wait)
    a, t0 = sample(), time.time()
    time.sleep(span)
    b, t1 = sample(), time.time()
    if shot:
        subprocess.run(['import', '-display', disp, '-window', 'root', '-crop', '1736x824+0+0', f'{SP}/bench_{name}.png'], stderr=subprocess.DEVNULL)
    dt = t1 - t0
    groups = collections.Counter()
    for tid, (comm, ticks) in b.items():
        d = (ticks - a.get(tid, (comm, 0))[1]) / 100.0
        g = comm
        for pre in ('llvmpipe', 'DartWorker', 'gst', 'pool', 'gmain', 'dconf', 'gdbus'):
            if comm.startswith(pre): g = pre
        groups[g] += d / dt * 100
    total = sum(groups.values())
    print(f'{name}: total {total:.0f}% of one core  | ' + '  '.join(f'{g}={v:.0f}%' for g, v in groups.most_common(8) if v >= 0.5))
finally:
    p.send_signal(signal.SIGTERM); time.sleep(0.5); p.kill(); xv.kill()
lines = [l.strip() for l in open(f'{SP}/bench_{name}.log', encoding='utf-8', errors='replace') if l.startswith('METER')]
import re
fps = [int(m.group(1)) for l in lines[-3:] for m in [re.search(r'الإطارات (\d+)/ث', l)] if m]
if fps:
    f = sum(fps) / len(fps)
    r = next((v for g, v in groups.items() if g.startswith('io.flutter.ras')), 0)
    u = groups.get('gangcity', 0)
    print(f'    fps {f:.1f} -> raster CPU {r*10/f:.1f} ms/frame, main(ui) CPU {u*10/f:.1f} ms/frame')
for l in lines[-1:]: print('   ', l[:300])
print('    log:', f'{SP}/bench_{name}.log')
