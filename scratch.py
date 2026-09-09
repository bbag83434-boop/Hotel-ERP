import os
for r, ds, fs in os.walk('C:/Users/Biswanath Bag'):
    if 'node_modules' in r or 'frontend' in r or 'AppData' in r or '.cache' in r:
        continue
    for f in fs:
        if f.lower() == 'python.exe':
            print(os.path.join(r, f))
