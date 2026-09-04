import * as ts from 'typescript';
import * as vm from 'vm';

/**
 * `--fix` rewrites a line with a regex and writes the file back. A regex cannot
 * know what it is standing in, so a fix that is right about the line can still
 * be wrong about the program: turning `var a` into `let a` twice in one scope
 * is the standard example, and it leaves a file that no longer runs.
 *
 * So the file is parsed before it is written, and a fix that would break it is
 * dropped instead. Two passes, because they catch different things:
 *
 * - `createSourceFile` reports syntax — a bracket that stopped matching.
 * - V8 reports *early errors*, which syntax checking does not. `let a` twice is
 *   one: `parseDiagnostics` is empty for it, and `node --check` refuses it.
 *   Reaching those means handing V8 something it will parse, which is what the
 *   transpile is for — it is never executed.
 *
 * Nothing is refused unless the file was fine to begin with. A file that
 * already fails this pipeline is not one this can have an opinion about — a
 * module with top-level `await` fails it, for instance, because the transpile
 * to CommonJS puts that `await` somewhere it is not allowed.
 */

const CHECKABLE = /\.(?:m|c)?[jt]sx?$/;

/** What stops this text from being a program, or null if nothing does. */
export function problemWith(file: string, text: string): string | null {
    const kind = /\.(?:m|c)?ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
    const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    const syntax = (parsed as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
    if (syntax.length) return ts.flattenDiagnosticMessageText(syntax[0].messageText, ' ');

    try {
        const js = ts.transpileModule(text, {
            fileName: file,
            reportDiagnostics: false,
            compilerOptions: {
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.CommonJS,
                jsx: ts.JsxEmit.React,
            },
        }).outputText;
        new vm.Script(js, { filename: file });
    } catch (error) {
        return (error as Error).message;
    }
    return null;
}

/**
 * Whether applying the fixes would leave a file that no longer parses. Returns
 * the reason, so the caller can say what it declined to write and why.
 */
export function fixWouldBreak(file: string, before: string, after: string): string | null {
    if (!CHECKABLE.test(file)) return null;
    if (problemWith(file, before) !== null) return null;
    return problemWith(file, after);
}
