import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Rule, RuleSchema } from './schema';

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
            doc = yaml.load(fs.readFileSync(filePath, 'utf8'));
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
