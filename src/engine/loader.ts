import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Rule, RuleSchema } from './schema';


/**
 * The first key repeated at the same indentation inside the same block, or
 * undefined. Deliberately textual: the parser has already thrown the evidence
 * away by the time it returns a plain object.
 */
function duplicateTopLevelKey(text: string): string | undefined {
    const seen = new Map<string, Set<string>>();
    // A literal block holds text, not structure: a CSS fixture full of
    // `outline: none;` is not a YAML mapping and must not be read as one.
    let blockIndent: number | null = null;
    for (const raw of text.split('\n')) {
        const indentWidth = raw.length - raw.trimStart().length;
        if (blockIndent !== null) {
            if (raw.trim() === '' || indentWidth > blockIndent) continue;
            blockIndent = null;
        }
        const line = raw.replace(/#.*$/, '');
        // Each `-` opens a new mapping, so two list items may carry the same key.
        if (line.trimStart().startsWith('-')) {
            for (const depth of [...seen.keys()]) {
                if (depth.length >= indentWidth) seen.delete(depth);
            }
        }
        if (/[|>][-+]?\d*\s*$/.test(line) && line.trim() !== '') {
            blockIndent = indentWidth;
            continue;
        }
        const match = /^(\s*)([A-Za-z_][\w-]*):(?:\s|$)/.exec(line);
        if (!match) continue;
        const [, indent, key] = match;
        // A shallower key closes every block nested under it.
        for (const depth of [...seen.keys()]) {
            if (depth.length >= indent.length && depth !== indent) seen.delete(depth);
        }
        const keys = seen.get(indent) ?? new Set<string>();
        if (keys.has(key)) return key;
        keys.add(key);
        seen.set(indent, keys);
    }
    return undefined;
}

export class RuleLoader {
    private static walkSync(dir: string, fileList: string[] = []): string[] {
        if (!fs.existsSync(dir)) return fileList;

        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                this.walkSync(filePath, fileList);
            } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
                fileList.push(filePath);
            }
        }
        return fileList;
    }

    private static collectRule(ruleData: unknown, filePath: string, rules: Rule[]): void {
        const result = RuleSchema.safeParse(ruleData);
        if (result.success) {
            rules.push(result.data);
            return;
        }
        console.warn(`Invalid rule in ${filePath}:`, result.error.issues);
    }

    private static loadFile(filePath: string, rules: Rule[]): void {
        let doc: unknown;
        try {
            const text = fs.readFileSync(filePath, 'utf8');
            // A repeated key wins silently in YAML, so a rule file with two
            // `quiet:` blocks keeps the second and drops the first: half its
            // examples gone, and every test still green.
            const duplicate = duplicateTopLevelKey(text);
            if (duplicate) {
                throw new Error(`duplicate key '${duplicate}' — the later one silently wins`);
            }
            doc = yaml.load(text);
        } catch (e) {
            console.error(`Error parsing ${filePath}:`, e);
            return;
        }
        // A file holds either one rule or a list of them.
        if (Array.isArray(doc)) {
            doc.forEach(ruleData => this.collectRule(ruleData, filePath, rules));
        } else if (doc) {
            this.collectRule(doc, filePath, rules);
        }
    }

    static loadRules(rulesDirs: string[]): Rule[] {
        const rules: Rule[] = [];
        let files: string[] = [];
        for (const dir of rulesDirs) {
            files = files.concat(this.walkSync(dir));
        }

        for (const filePath of files) {
            this.loadFile(filePath, rules);
        }

        return rules;
    }
}
