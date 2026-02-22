import * as ts from 'typescript';
import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';

export class SemanticChecker {
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
            if (!rule.match.semantic_check) continue;

            const type = rule.match.semantic_check;

            this.traverse(sourceFile, (node) => {
                if (type === 'boolean-naming') {
                    if (ts.isVariableDeclaration(node) && node.initializer) {
                        const name = node.name.getText();
                        const isBool = this.isBooleanType(node);
                        if (isBool && !/^(is|has|can|should|was|did|do|will)/i.test(name)) {
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

                if (type === 'boolean-redundancy') {
                    if (ts.isIfStatement(node)) {
                        const thenBranch = node.thenStatement;
                        const elseBranch = node.elseStatement;
                        if (thenBranch && elseBranch) {
                            if (this.isReturnBoolean(thenBranch) && this.isReturnBoolean(elseBranch)) {
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
                }

                if (type === 'collection-suffix') {
                    if (ts.isVariableDeclaration(node) && node.initializer) {
                        const name = node.name.getText();
                        const isArray = this.isArrayType(node);
                        if (isArray && !name.endsWith('s') && !/(List|Map|Set|Collection|Array)$/i.test(name)) {
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
                if (type === 'semantic-shadowing') {
                    if (ts.isVariableDeclaration(node)) {
                        const name = node.name.getText();
                        // Removed 'data', 'config', 'app', 'db' as they are often too generic to be shadowing concerns
                        const commonShadows = ['fs', 'path', 'crypto', 'http', 'https', 'express', 'req', 'res', 'os', 'child_process', 'cluster', 'dns'];
                        if (commonShadows.includes(name)) {
                            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { name, line: line + 1, match: name }),
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

    private static isBooleanType(node: ts.VariableDeclaration): boolean {
        if (node.type?.kind === ts.SyntaxKind.BooleanKeyword) return true;
        if (node.initializer?.kind === ts.SyntaxKind.TrueKeyword || node.initializer?.kind === ts.SyntaxKind.FalseKeyword) return true;
        return false;
    }

    private static isArrayType(node: ts.VariableDeclaration): boolean {
        if (node.type?.kind === ts.SyntaxKind.ArrayType) return true;
        if (node.initializer?.kind === ts.SyntaxKind.ArrayLiteralExpression) return true;
        return false;
    }

    private static isReturnBoolean(node: ts.Statement): boolean {
        let n = node;
        if (ts.isBlock(n) && n.statements.length === 1) {
            n = n.statements[0];
        }
        if (ts.isReturnStatement(n) && n.expression) {
            return n.expression.kind === ts.SyntaxKind.TrueKeyword || n.expression.kind === ts.SyntaxKind.FalseKeyword;
        }
        return false;
    }
}
