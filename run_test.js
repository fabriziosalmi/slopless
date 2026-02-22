const ts = require('typescript');
const fs = require('fs');
const file = 'test_floating_promise.ts';
const program = ts.createProgram([file], { target: ts.ScriptTarget.ES2022 });
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile(file);

const visit = (node) => {
    if (ts.isCallExpression(node)) {
        const signature = checker.getResolvedSignature(node);
        if (signature) {
            const rt = checker.getReturnTypeOfSignature(signature);
            console.log("Found call:", node.getText(), "->", checker.typeToString(rt));
        }
    }
    ts.forEachChild(node, visit);
};
visit(sourceFile);
