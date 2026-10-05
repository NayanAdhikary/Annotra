const { Project, SyntaxKind } = require('ts-morph');
const project = new Project();
project.addSourceFilesAtPaths('src/**/*.tsx');

for (const sourceFile of project.getSourceFiles()) {
  let modified = false;

  const hookCalls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter(d => d.getInitializer()?.getText() === 'useToast()');

  if (hookCalls.length === 0) continue;

  for (const hookCall of hookCalls) {
    const parentBlock = hookCall.getFirstAncestorByKind(SyntaxKind.Block);
    if (!parentBlock) continue;

    // Find the topmost function that returns JSX
    let current = hookCall.getParent();
    let topmostComponent = null;

    while (current) {
      if (current.getKind() === SyntaxKind.FunctionDeclaration || current.getKind() === SyntaxKind.ArrowFunction) {
        // basic heuristic: components usually have PascalCase names or are default exports
        const parentVar = current.getParentIfKind(SyntaxKind.VariableDeclaration);
        if (parentVar) {
          const name = parentVar.getName();
          if (name[0] === name[0].toUpperCase()) {
            topmostComponent = current;
          }
        } else if (current.getKind() === SyntaxKind.FunctionDeclaration) {
          const name = current.getName();
          if (name && name[0] === name[0].toUpperCase()) {
            topmostComponent = current;
          }
        }
      }
      current = current.getParent();
    }

    if (topmostComponent && topmostComponent.getBody() !== parentBlock) {
      // It's in a nested function, move it up
      const statement = hookCall.getFirstAncestorByKind(SyntaxKind.VariableStatement);
      if (statement && !statement.wasForgotten()) {
        statement.remove();
        const body = topmostComponent.getBody();
        if (body.getKind() === SyntaxKind.Block) {
          // Add it only if it doesn't already exist in the topmost component
          const statements = body.getStatements();
          if (!statements.some(s => s.getText().includes('useToast()'))) {
            body.insertStatements(0, 'const toast = useToast();');
            modified = true;
          }
        }
      }
    }
  }
  
  if (modified) {
    sourceFile.saveSync();
    console.log("Fixed hooks in " + sourceFile.getFilePath());
  }
}
