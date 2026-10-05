const { Project, SyntaxKind } = require('ts-morph');

const project = new Project();
project.addSourceFilesAtPaths('src/**/*.tsx');
project.addSourceFilesAtPaths('src/**/*.ts');

for (const sourceFile of project.getSourceFiles()) {
  let modified = false;

  // Find all catch clauses
  const catchClauses = sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause);
  for (const catchClause of catchClauses) {
    const block = catchClause.getBlock();
    let hasAlert = false;
    let hasConsoleError = false;

    block.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const text = node.getText();
        if (text.startsWith('alert(')) {
          hasAlert = true;
          // Replace alert(...) with toast.push('error', e.userMessage ?? 'Something went wrong')
          // Extract the error variable if possible, default to e
          const varDecl = catchClause.getVariableDeclaration();
          const errName = varDecl ? varDecl.getName() : 'e';
          node.replaceWithText(`toast.push('error', ${errName}.userMessage ?? 'Something went wrong')`);
          modified = true;
        } else if (text.startsWith('console.error(')) {
          hasConsoleError = true;
          const varDecl = catchClause.getVariableDeclaration();
          const errName = varDecl ? varDecl.getName() : 'e';
          node.replaceWithText(`toast.push('error', ${errName}.userMessage ?? 'Something went wrong')`);
          modified = true;
        }
      }
    });

    if (hasAlert || hasConsoleError) {
      // Need to inject hook
      // Walk up to find the closest FunctionDeclaration or ArrowFunction
      let parent = catchClause.getParent();
      let func = null;
      while (parent) {
        if (parent.getKind() === SyntaxKind.FunctionDeclaration || parent.getKind() === SyntaxKind.ArrowFunction || parent.getKind() === SyntaxKind.FunctionExpression) {
          func = parent;
          break;
        }
        parent = parent.getParent();
      }

      if (func) {
        const funcBlock = func.getBody();
        if (funcBlock && funcBlock.getKind() === SyntaxKind.Block) {
          const statements = funcBlock.getStatements();
          const hasToast = statements.some(s => s.getText().includes('useToast()'));
          if (!hasToast) {
            funcBlock.insertStatements(0, 'const toast = useToast();');
          }
        }
      }

      // Add import if missing
      const imports = sourceFile.getImportDeclarations();
      const hasImport = imports.some(i => i.getModuleSpecifierValue().includes('ToastProvider'));
      if (!hasImport) {
        sourceFile.addImportDeclaration({
          namedImports: ['useToast'],
          moduleSpecifier: '@/components/Toast/ToastProvider', // Will fix aliases later if needed, assuming relative or alias works. Wait, frontend aliases might not exist. Let's use relative paths.
        });
      }
    }
  }

  if (modified) {
    // Fix relative imports for ToastProvider
    const filePath = sourceFile.getFilePath();
    const isComponents = filePath.includes('/components/');
    let relativePath = '';
    if (filePath.includes('/pages/admin/')) relativePath = '../../components/Toast/ToastProvider';
    else if (filePath.includes('/pages/')) relativePath = '../components/Toast/ToastProvider';
    else if (filePath.includes('/components/Admin/') || filePath.includes('/components/Export/') || filePath.includes('/components/Video/') || filePath.includes('/components/LabelManager/') || filePath.includes('/components/canvas/')) relativePath = '../Toast/ToastProvider';
    else if (filePath.includes('/components/TaskSetup/')) relativePath = '../Toast/ToastProvider';
    else relativePath = './components/Toast/ToastProvider';

    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
      if (imp.getModuleSpecifierValue() === '@/components/Toast/ToastProvider') {
        imp.setModuleSpecifier(relativePath);
      }
    }
    
    sourceFile.saveSync();
    console.log(`Updated ${filePath}`);
  }
}
