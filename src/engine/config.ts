import * as fs from 'fs';
import * as path from 'path';

export interface SloplessConfig {
    rules?: Record<string, 'error' | 'warning' | 'off'>;
    ignore?: string[];
    customRulesPaths?: string[];
    typeCheck?: boolean;
    /**
     * Words that are this project's domain rather than slop. `blacklist` in a
     * firewall, `master` on an audio bus. Applies to every rule, and the run
     * reports how many findings it excused.
     */
    vocabulary?: string[];
}

/**
 * Where a config path resolves to, whether or not anything is there.
 *
 * Separate from `loadConfig` because a relative `customRulesPaths` entry means
 * "relative to the config that named it". Resolving those against
 * `process.cwd()` is right for the CLI and wrong everywhere else: an editor does
 * not run in the directory it is checking.
 */
export function configLocation(configPath?: string): string {
    return configPath
        ? path.resolve(configPath)
        : path.join(process.cwd(), 'slopless.config.json');
}

export function loadConfig(configPath?: string): SloplessConfig {
    const targetPath = configLocation(configPath);

    if (fs.existsSync(targetPath)) {
        try {
            const content = fs.readFileSync(targetPath, 'utf8');
            return JSON.parse(content) as SloplessConfig;
        } catch (e) {
            console.error(`Failed to parse config at ${targetPath}`, e);
        }
    }
    return {};
}
