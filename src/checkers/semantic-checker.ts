import * as ts from 'typescript';
import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { PARSED_LANGUAGES, extensionOf } from '../engine/coverage';
import { isExcludedFile } from '../engine/file-scope';
import { Violation } from './regex-checker';

export class SemanticChecker {
    static check(file: string, rules: Rule[], content?: string): Violation[] {
        const violations: Violation[] = [];
        // Same source as the coverage report: a rule counted as covering this
        // file has to be a rule that can actually run on it.
        if (!PARSED_LANGUAGES.has(extensionOf(file))) {
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
            if (isExcludedFile(file, rule)) continue;

            const type = rule.match.semantic_check;

            this.traverse(sourceFile, (node) => {
                if (type === 'boolean-naming') {
                    if (ts.isVariableDeclaration(node) && node.initializer) {
                        const name = node.name.getText();
                        const isBool = this.isBooleanType(node);
                        if (isBool && !new RegExp('^(is|has|can|should|was|did|do|will)', 'i').test(name)) {
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
                        const lacksCollectionSuffix = !name.endsWith('s') &&
                            !new RegExp('(List|Map|Set|Collection|Array)$', 'i').test(name);
                        if (isArray && lacksCollectionSuffix) {
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
                        // Removed 'data', 'config', 'app', 'db' as too generic to be shadowing concerns
                        // Module names only. `req` and `res` were here for Express,
                        // but they are the ordinary words for a request and a result
                        // in every other codebase, and this check cannot tell which
                        // it is looking at.
                        const commonShadows = [
                            'fs', 'path', 'crypto', 'http', 'https',
                            'express', 'os', 'child_process', 'cluster', 'dns',
                        ];
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

    private static formatMessage(message: string, context: Record<string, unknown>): string {
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
