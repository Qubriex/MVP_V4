# scripts/course-code-check.py — npm run topics:code. Runs the code in the
# Python and Java courses: every practice task and module project solution
# must pass all its tests, and every starter must fail at least one (so the
# learner has real work to do). Java examples and solutions must compile, run
# and print their stored output (needs javac 21). Content only; no app code.
import glob, io, json, os, re, subprocess, sys, tempfile
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'courses')
def run(src, tests, stdin=''):
    out = io.StringIO()
    def _qbx_out(fn, *a, **k):
        buf = io.StringIO(); prev = sys.stdout; sys.stdout = buf
        try: fn(*a, **k)
        finally: sys.stdout = prev
        return buf.getvalue()
    feed = iter(stdin.split('\n')) if stdin else iter([])
    def _input(p=''):
        out.write(str(p))
        try: return next(feed)
        except StopIteration: return ''
    g = {'__name__': '__main__', 'input': _input, '_qbx_out': _qbx_out}
    prev = sys.stdout; sys.stdout = out
    try: exec(src, g)
    except Exception as e: sys.stdout = prev; return [(t['name'], False, f'{type(e).__name__}: {e}') for t in tests]
    finally: sys.stdout = prev
    res = []
    for t in tests:
        if 'call' in t:
            try: got = repr(eval(t['call'], g))
            except Exception as e: got = f'ERR {type(e).__name__}: {e}'
            res.append((t['name'], got == t['expected'], got))
        else:
            o = io.StringIO(); feed2 = iter((t.get('stdin') or '').split('\n'))
            def _in2(p=''):
                o.write(str(p))
                try: return next(feed2)
                except StopIteration: return ''
            g2 = {'__name__': '__main__', 'input': _in2, '_qbx_out': _qbx_out}
            prev = sys.stdout; sys.stdout = o
            try: exec(src, g2); err = None
            except Exception as e: err = str(e)
            finally: sys.stdout = prev
            res.append((t['name'], err is None and o.getvalue().strip() == str(t['output']).strip(), o.getvalue()))
    return res

def check_python():
    bad = 0
    for f in sorted(glob.glob(os.path.join(DATA, 'python', 'm*.json'))):
        m = json.load(open(f))
        items = [(l['id'], l['task']) for l in m['lessons'] if l.get('task')] + ([(m['id'] + '-project', m['project'])] if m.get('project') else [])
        for l in m['lessons']:
            src = l['code']['source']
            if 'input(' in src:
                continue  # examples that read input are shown with their stored output
            buf = io.StringIO(); prev = sys.stdout; sys.stdout = buf
            try: exec(src, {'__name__': '__main__'}); err = None
            except Exception as e: err = f'{type(e).__name__}: {e}'
            finally: sys.stdout = prev
            if err or buf.getvalue().strip() != str(l['code'].get('output', '')).strip():
                bad += 1; print('python: example', l['id'], err or repr(buf.getvalue()[:200]))
        for name, task in items:
            first_in = next((t['stdin'] for t in task['tests'] if 'stdin' in t), '')
            fails = [x for x in run(task['solution'], task['tests'], first_in) if not x[1]]
            if fails: bad += 1; print('python: solution fails', name, fails)
            if all(x[1] for x in run(task.get('starter', ''), task['tests'], first_in)): bad += 1; print('python: starter passes', name)
    return bad
def compile_run(src, stdin=''):
    m = re.search(r'public\s+class\s+(\w+)', src)
    name = m.group(1) if m else 'Main'
    d = tempfile.mkdtemp()
    open(os.path.join(d, name + '.java'), 'w').write(src)
    env = dict(os.environ); env.pop('JAVA_TOOL_OPTIONS', None)
    c = subprocess.run(['javac', '-d', d, os.path.join(d, name + '.java')], capture_output=True, text=True, env=env)
    if c.returncode: return None, c.stderr[:400]
    r = subprocess.run(['java', '-cp', d, name], input=stdin, capture_output=True, text=True, timeout=20, env=env)
    return r.stdout, r.stderr[:400]
def flags(t):
    f = 0
    for ch in t.get('flags', 'm'):
        f |= {'m': re.M, 's': re.S, 'i': re.I}.get(ch, 0)
    return f
def passes(src, t):
    hit = re.search(t.get('pattern') or t['absent'], src, flags(t))
    return (not hit) if 'absent' in t else bool(hit)

def check_java():
    bad = 0
    for f in sorted(glob.glob(os.path.join(DATA, 'java', 'm*.json'))):
        m = json.load(open(f))
        for l in m['lessons']:
            out, err = compile_run(l['code']['source'])
            if out is None or out.strip() != l['code'].get('output', '').strip():
                bad += 1; print('java: example', l['id'], repr(out), err)
        for name, task in [(l['id'], l['task']) for l in m['lessons']] + [(m['id'] + '-project', m['project'])]:
            fails = [t['name'] for t in task['tests'] if not passes(task['solution'], t)]
            if fails: bad += 1; print('java: solution fails', name, fails)
            if all(passes(task['starter'], t) for t in task['tests']): bad += 1; print('java: starter passes', name)
            out, err = compile_run(task['solution'], task.get('stdin', ''))
            if out is None: bad += 1; print('java: solution does not compile', name, err)
            elif task.get('output') is not None and out.strip() != task['output'].strip(): bad += 1; print('java: solution output', name, repr(out))
    return bad

if __name__ == '__main__':
    cwd = tempfile.mkdtemp()
    os.chdir(cwd)  # programs that write files write them here
    py, jv = check_python(), check_java()
    print(f'course code: python problems {py}, java problems {jv}')
    sys.exit(1 if py or jv else 0)
