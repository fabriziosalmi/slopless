import * as fs from 'fs';
import * as path from 'path';

export interface SloplessConfig {
    rules?: Record<string, 'error' | 'warning' | 'off'>;
    ignore?: string[];
}

export function loadConfig(configPath?: string): SloplessConfig {
    const defaultPath = path.join(process.cwd(), 'slopless.config.json');
    const targetPath = configPath ? path.resolve(configPath) : defaultPath;

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
