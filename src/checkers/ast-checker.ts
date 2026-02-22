import * as ts from 'typescript';
import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';

export class AstChecker {
    static check(file: string, rules: Rule[], content?: string): Violation[] {
        const violations: Violation[] = [];
        const ext = file.split('.').pop();
        if (!['js', 'ts', 'jsx', 'tsx'].includes(ext || '')) {
            return [];
        }

        const sourceCode = content !== undefined ? content : fs.readFileSync(file, 'utf8');
        const sourceFile = ts.createSourceFile(
            file,
            sourceCode,
            ts.ScriptTarget.Latest,
            true
        );

        for (const rule of rules) {
            if (!rule.match.ast_check) continue;

            const type = rule.match.ast_check.type;
            const threshold = rule.match.threshold ?? rule.match.ast_check.threshold;

            if (type === 'empty-file') {
                if (sourceCode.trim().length === 0) {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: this.formatMessage(rule.message, { file, line: 0 }),
                        file,
                        line: 0,
                    });
                }
                continue;
            }

            if (type === 'file-length-limit' && threshold) {
                const lineCount = sourceCode.split('\n').length;
                if (lineCount > threshold) {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: this.formatMessage(rule.message, { threshold, count: lineCount }),
                        file,
                        line: 0,
                    });
                }
                continue;
            }

            this.traverse(sourceFile, (node) => {
                if (type === 'function-params-limit' && threshold) {
                    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
                        if (node.parameters.length > threshold) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { threshold, count: node.parameters.length, line: line + 1 }),
                                file,
                                line: line + 1,
                            });
                        }
                    }
                }

                if (type === 'function-length-limit' && threshold) {
                    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
                        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
                        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
                        const length = end - start + 1;
                        if (length > threshold) {
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { threshold, count: length, line: start + 1 }),
                                file,
                                line: start + 1,
                            });
                        }
                    }
                }

                if (type === 'empty-catch') {
                    if (ts.isCatchClause(node)) {
                        if (node.block.statements.length === 0) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { line: line + 1 }),
                                file,
                                line: line + 1,
                            });
                        }
                    }
                }

                if (type === 'nested-blocks-limit' && threshold) {
                    let maxDepth = 0;
                    const calculateDepth = (n: ts.Node, depth: number) => {
                        maxDepth = Math.max(maxDepth, depth);
                        ts.forEachChild(n, (child) => {
                            if (ts.isIfStatement(child) || ts.isForStatement(child) || ts.isWhileStatement(child) || ts.isSwitchStatement(child)) {
                                calculateDepth(child, depth + 1);
                            } else {
                                calculateDepth(child, depth);
                            }
                        });
                    };

                    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                        calculateDepth(node, 0);
                        if (maxDepth > threshold) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { threshold, count: maxDepth, line: line + 1 }),
                                file,
                                line: line + 1,
                            });
                        }
                    }
                }

                if (type === 'empty-block') {
                    if (ts.isBlock(node) && node.statements.length === 0) {
                        // Skip if it's a catch clause (handled by empty-catch)
                        if (!ts.isCatchClause(node.parent)) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { line: line + 1 }),
                                file,
                                line: line + 1,
                            });
                        }
                    }
                }

                if (type === 'one-liner-limit' && threshold) {
                    if (ts.isBlock(node)) {
                        const linesWithStatements = new Set();
                        node.statements.forEach(s => {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(s.getStart());
                            linesWithStatements.add(line);
                        });

                        // This is a bit simplified, but checks if multiple statements are on same line
                        if (node.statements.length > linesWithStatements.size) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { line: line + 1 }),
                                file,
                                line: line + 1,
                            });
                        }
                    }
                }

                if (type === 'redundant-if-true') {
                    if (ts.isIfStatement(node)) {
                        const cond = node.expression;
                        if (cond.kind === ts.SyntaxKind.TrueKeyword ||
                            (ts.isBinaryExpression(cond) && cond.left.kind === ts.SyntaxKind.TrueKeyword && cond.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken)) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { line: line + 1 }),
                                file,
                                line: line + 1,
                            });
                        }
                    }
                }
                if (type === 'lying-function-names') {
                    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                        const name = node.name?.getText();
                        if (name) {
                            const isGetter = /^(get|is|has|fetch|retrieve)/i.test(name);
                            if (isGetter) {
                                const body = node.body?.getText();
                                if (body && /(delete|remove|set|update|write|modify|pop|push|shift|unshift|splice|assign)/i.test(body)) {
                                    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                                    violations.push({
                                        ruleId: rule.id,
                                        name: rule.name,
                                        severity: rule.severity,
                                        message: this.formatMessage(rule.message, { name, line: line + 1 }),
                                        file,
                                        line: line + 1,
                                    });
                                }
                            }
                        }
                    }
                }

                if (type === 'empty-interface') {
                    if (ts.isInterfaceDeclaration(node)) {
                        if (node.members.length === 0) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { line: line + 1 }),
                                file,
                                line: line + 1,
                            });
                        }
                    }
                }
            });
        }

        return violations;
    }

    private static traverse(node: ts.Node, callback: (node: ts.Node) => void) {
        callback(node);
        ts.forEachChild(node, (child) => this.traverse(child, callback));
    }

    private static formatMessage(message: string, context: { [key: string]: any }): string {
        let fmt = message;
        for (const [key, value] of Object.entries(context)) {
            fmt = fmt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        return fmt;
    }
}
