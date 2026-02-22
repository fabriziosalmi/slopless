import * as ts from 'typescript';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';
import * as path from 'path';

export class TypeCheckerEngine {
    static check(file: string, rules: Rule[], program: ts.Program, checker: ts.TypeChecker): Violation[] {
        const violations: Violation[] = [];
        const sourceFile = program.getSourceFile(file);
        if (!sourceFile) return violations;

        const typeRules = rules.filter(r => r.match.type_check);
        if (typeRules.length === 0) return violations;

        const visit = (node: ts.Node) => {
            for (const rule of typeRules) {
                if (rule.match.type_check === 'floating-promise') {
                    this.checkFloatingPromise(node, checker, rule, sourceFile, file, violations);
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return violations;
    }

    private static checkFloatingPromise(node: ts.Node, checker: ts.TypeChecker, rule: Rule, sourceFile: ts.SourceFile, file: string, violations: Violation[]) {
        if (!ts.isCallExpression(node)) return;

        const type = checker.getTypeAtLocation(node);
        const typeStr = checker.typeToString(type);
        let isPromise = typeStr.includes('Promise') || typeStr.includes('Thenable');

        if (!isPromise) {
            const signature = checker.getResolvedSignature(node);
            const decl = signature?.declaration as any;
            if (decl?.modifiers) {
                isPromise = decl.modifiers.some((m: any) => m.kind === ts.SyntaxKind.AsyncKeyword);
            }
        }

        if (!isPromise) return;

        const parent = node.parent;
        if (!ts.isExpressionStatement(parent) || ts.isAwaitExpression(parent) || ts.isReturnStatement(parent.parent)) {
            return;
        }

        let hasCatch = false;
        let current: ts.Node = node;
        while (ts.isCallExpression(current.parent) || ts.isPropertyAccessExpression(current.parent)) {
            current = current.parent;
            if (ts.isPropertyAccessExpression(current) && current.name.text === 'catch') {
                hasCatch = true;
                break;
            }
        }

        if (!hasCatch) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push({
                ruleId: rule.id,
                name: rule.name,
                severity: rule.severity,
                message: rule.message.replace('{match}', typeStr),
                file,
                line: line + 1
            });
        }
    }
}
