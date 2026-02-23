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

    static loadRules(rulesDirs: string[]): Rule[] {
        const rules: Rule[] = [];
        let files: string[] = [];
        for (const dir of rulesDirs) {
            files = files.concat(this.walkSync(dir));
        }

        for (const filePath of files) {
            const content = fs.readFileSync(filePath, 'utf8');
            try {
                const doc = yaml.load(content);
                // If the YAML is an array of rules
                if (Array.isArray(doc)) {
                    for (const ruleData of doc) {
                        const result = RuleSchema.safeParse(ruleData);
                        if (result.success) {
                            rules.push(result.data);
                        } else {
                            console.warn(`Invalid rule in ${filePath}:`, result.error.issues);
                        }
                    }
                } else if (doc) {
                    // If it's a single rule
                    const result = RuleSchema.safeParse(doc);
                    if (result.success) {
                        rules.push(result.data);
                    } else {
                        console.warn(`Invalid rule in ${filePath}:`, result.error.issues);
                    }
                }
            } catch (e) {
                console.error(`Error parsing ${filePath}:`, e);
            }
        }

        return rules;
    }
}
