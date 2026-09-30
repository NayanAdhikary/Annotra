import os, re
d = 'app/models'
files = [os.path.join(d, f) for f in os.listdir(d) if f.endswith('.py')]
for fp in files:
    with open(fp, 'r') as f:
        c = f.read()
    
    lines = c.split('\n')
    new_lines = []
    changed = False
    for line in lines:
        if line.startswith('from sqlalchemy import') and 'BigInteger' in line and 'Integer' not in line:
            line = line.replace('BigInteger', 'BigInteger, Integer')
            changed = True
        elif 'from sqlalchemy import' in line and 'BigInteger' in line and 'Integer' not in line:
            line = line.replace('BigInteger', 'BigInteger, Integer')
            changed = True
        new_lines.append(line)
        
    if changed:
        with open(fp, 'w') as f:
            f.write('\n'.join(new_lines))
