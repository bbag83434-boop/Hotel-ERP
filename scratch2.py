import os  
for r, _, fs in os.walk('C:/'):  
    if 'Hotel-ERP' in r and 'python.exe' in fs:  
        print(os.path.join(r, 'python.exe'))  
