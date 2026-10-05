import os
import glob
import re

def refactor():
    files = glob.glob('src/**/*.tsx', recursive=True)
    for file in files:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()

        if 'alert(' not in content:
            continue

        lines = content.split('\n')
        new_lines = []
        has_import = False
        has_hook = False
        
        for line in lines:
            if 'import { useToast }' in line:
                has_import = True
            if 'const toast = useToast();' in line:
                has_hook = True
                
        # very basic hook injection heuristic
        import_injected = has_import
        hook_injected = has_hook
        
        for i, line in enumerate(lines):
            if not import_injected and line.startswith('import '):
                new_lines.append("import { useToast } from '@/components/Toast/ToastProvider';") # We'll just use a relative or alias. Wait, better to use the exact relative path, or just assume standard aliasing. Let's assume standard relative paths might be hard, so let's use the exact alias if available. If not we will have to use relative paths. Actually we can just do a hacky global hook if we can't figure it out.
                # Actually, wait, doing this programmatically in python without AST is going to break React hook rules if we inject `const toast = useToast()` in the wrong place.
                pass
            
        print(f"File {file} needs manual refactor")

refactor()
