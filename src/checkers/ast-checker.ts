import * as ts from 'typescript';
import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';

interface NodeCheckContext {
    rule: Rule;
    sourceFile: ts.SourceFile;
    file: string;
    violations: Violation[];
}

/** True if the body awaits anything itself, ignoring awaits inside nested functions. */
function containsAwait(body: ts.Node): boolean {
    let found = false;
    const walk = (n: ts.Node) => {
        if (found) return;
        if (ts.isAwaitExpression(n) || ts.isForOfStatement(n) && n.awaitModifier) {
            found = true;
            return;
        }
        // A nested function has its own async contract.
        if (n !== body && isFunctionLikeWithBody(n)) return;
        ts.forEachChild(n, walk);
    };
    walk(body);
    return found;
}

function functionBody(node: ts.Node): ts.Node | undefined {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
        || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
        || ts.isConstructorDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
        return node.body;
    }
    return undefined;
}

function isFunctionLikeWithBody(node: ts.Node): boolean {
    return functionBody(node) !== undefined;
}

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
            const ctx: NodeCheckContext = { rule, sourceFile, file, violations };

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
                    this.checkFunctionParams(node, threshold, ctx);
                }
                if (type === 'function-length-limit' && threshold) {
                    this.checkFunctionLength(node, threshold, ctx);
                }
                if (type === 'empty-catch') {
                    this.checkEmptyCatch(node, ctx);
                }
                if (type === 'nested-blocks-limit' && threshold) {
                    this.checkNestedBlocks(node, threshold, ctx);
                }
                if (type === 'empty-block') {
                    this.checkEmptyBlock(node, ctx);
                }
                if (type === 'one-liner-limit') {
                    this.checkOneLiner(node, ctx);
                }
                if (type === 'redundant-if-true') {
                    this.checkRedundantIfTrue(node, ctx);
                }
                if (type === 'lying-function-names') {
                    this.checkLyingFunctionName(node, ctx);
                }
                if (type === 'empty-interface') {
                    this.checkEmptyInterface(node, ctx);
                }
                if (type === 'async-without-await') {
                    this.checkAsyncWithoutAwait(node, ctx);
                }
            });
        }

        return violations;
    }

    private static checkFunctionParams(node: ts.Node, threshold: number, ctx: NodeCheckContext) {
        if (!ts.isFunctionDeclaration(node) && !ts.isMethodDeclaration(node) && !ts.isArrowFunction(node)) return;
        if (node.parameters.length <= threshold) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, {
                threshold, count: node.parameters.length, line: line + 1
            }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkFunctionLength(node: ts.Node, threshold: number, ctx: NodeCheckContext) {
        if (!ts.isFunctionDeclaration(node) && !ts.isMethodDeclaration(node) && !ts.isArrowFunction(node)) return;
        const start = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const end = ctx.sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        const length = end - start + 1;
        if (length <= threshold) return;
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { threshold, count: length, line: start + 1 }),
            file: ctx.file, line: start + 1,
        });
    }

    private static checkEmptyCatch(node: ts.Node, ctx: NodeCheckContext) {
        if (!ts.isCatchClause(node)) return;
        if (node.block.statements.length > 0) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkEmptyBlock(node: ts.Node, ctx: NodeCheckContext) {
        if (!ts.isBlock(node) || node.statements.length > 0) return;
        // Skip catch clauses — handled by checkEmptyCatch
        if (ts.isCatchClause(node.parent)) return;
        // `constructor(private readonly deps: Deps) {}` does its work in the signature.
        if (ts.isConstructorDeclaration(node.parent)) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkOneLiner(node: ts.Node, ctx: NodeCheckContext) {
        if (!ts.isBlock(node)) return;
        const linesWithStatements = new Set<number>();
        node.statements.forEach(s => {
            const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(s.getStart());
            linesWithStatements.add(line);
        });
        if (node.statements.length <= linesWithStatements.size) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkRedundantIfTrue(node: ts.Node, ctx: NodeCheckContext) {
        if (!ts.isIfStatement(node)) return;
        const cond = node.expression;
        const isTriviallyTrue = cond.kind === ts.SyntaxKind.TrueKeyword ||
            (ts.isBinaryExpression(cond) &&
                cond.left.kind === ts.SyntaxKind.TrueKeyword &&
                cond.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken);
        if (!isTriviallyTrue) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkLyingFunctionName(node: ts.Node, ctx: NodeCheckContext) {
        if (!ts.isFunctionDeclaration(node) && !ts.isMethodDeclaration(node)) return;
        const fnName = node.name?.getText();
        if (!fnName) return;
        // Getters that silently mutate state are deceptive
        const isReadNamePrefix = new RegExp('^(get|is|has|fetch|retrieve)', 'i').test(fnName);
        if (!isReadNamePrefix) return;
        const body = node.body?.getText();
        if (!body) return;
        // Match mutating *calls* and assignments, not substrings: plain word matching
        // treated `offset`, `dataset`, `asset` and `reset` as mutations.
        const mutatingCall = /\.(?:set|delete|remove|update|write|modify|pop|push|shift|unshift|splice|clear|add|sort|reverse)\s*\(/;
        const selfAssignment = /\bthis\.[A-Za-z_$][\w$]*\s*(?:=[^=]|\+\+|--|\+=|-=)/;
        const objectMutation = /\bObject\.assign\s*\(|\bdelete\s+[A-Za-z_$]/;
        if (!mutatingCall.test(body) && !selfAssignment.test(body) && !objectMutation.test(body)) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { name: fnName, line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkEmptyInterface(node: ts.Node, ctx: NodeCheckContext) {
        if (!ts.isInterfaceDeclaration(node) || node.members.length > 0) return;
        // `interface Props extends BaseProps {}` is the standard way to re-export or
        // merge a type, not an unfinished declaration.
        if (node.heritageClauses && node.heritageClauses.length > 0) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkAsyncWithoutAwait(node: ts.Node, ctx: NodeCheckContext) {
        const body = functionBody(node);
        if (!body) return;
        const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
        const isAsync = modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
        if (!isAsync) return;
        if (containsAwait(body)) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
    }

    private static checkNestedBlocks(node: ts.Node, threshold: number, ctx: NodeCheckContext) {
        if (!isFunctionLikeWithBody(node)) return;
        let maxDepth = 0;
        const calculateDepth = (n: ts.Node, depth: number) => {
            maxDepth = Math.max(maxDepth, depth);
            ts.forEachChild(n, (child) => {
                // A nested function starts its own budget rather than inheriting ours.
                if (isFunctionLikeWithBody(child)) {
                    calculateDepth(child, 0);
                    return;
                }
                // `else if` is an IfStatement in the else branch; counting it as nesting
                // reported a flat five-branch chain as five levels deep.
                const isElseIf = ts.isIfStatement(child) && ts.isIfStatement(n)
                    && n.elseStatement === child;
                const isControlFlow = !isElseIf && (ts.isIfStatement(child) || ts.isForStatement(child) ||
                    ts.isForOfStatement(child) || ts.isForInStatement(child) ||
                    ts.isWhileStatement(child) || ts.isDoStatement(child) ||
                    ts.isSwitchStatement(child) || ts.isTryStatement(child));
                calculateDepth(child, isControlFlow ? depth + 1 : depth);
            });
        };
        calculateDepth(node, 0);
        if (maxDepth <= threshold) return;
        const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        ctx.violations.push({
            ruleId: ctx.rule.id, name: ctx.rule.name, severity: ctx.rule.severity,
            message: this.formatMessage(ctx.rule.message, { threshold, count: maxDepth, line: line + 1 }),
            file: ctx.file, line: line + 1,
        });
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
}
