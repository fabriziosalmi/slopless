import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const RULES_DIR = path.join(__dirname, '../rules');

function main() {
    const yamlFiles = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of yamlFiles) {
        const category = file.split('.')[0];
        const filePath = path.join(RULES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');

        try {
            const rules = yaml.load(content);

            if (Array.isArray(rules)) {
                console.log(`Processing ${file} (${rules.length} rules)...`);

                for (const rule of rules) {
                    if (rule.id) {
                        // Add mandatory category if missing
                        if (!rule.category) {
                            rule.category = category;
                        }

                        const atomicFileName = `${rule.id}.yaml`;
                        const atomicFilePath = path.join(RULES_DIR, atomicFileName);

                        // Write individual rule file
                        fs.writeFileSync(atomicFilePath, yaml.dump(rule));
                    }
                }

                // Remove the old categorized file
                fs.unlinkSync(filePath);
                console.log(`Removed original file: ${file}`);
            } else {
                console.log(`Skipping ${file} - not an array (likely already atomic or other file).`);
                // If it's already a single rule, ensure it has the category field
                const rule = rules as any;
                if (rule && rule.id && !rule.category) {
                    rule.category = category;
                    fs.writeFileSync(filePath, yaml.dump(rule));
                    console.log(`Injected category into atomic file: ${file}`);
                }
            }
        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }
}

main();
