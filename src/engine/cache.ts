import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Violation } from '../checkers/regex-checker';

interface CacheEntry {
    hash: string;
    violations: Violation[];
}

export class CacheManager {
    private cacheMap: Record<string, CacheEntry> = {};
    private cachePath: string;
    private isEnabled: boolean;

    constructor(enabled: boolean = true) {
        this.cachePath = path.join(process.cwd(), '.sloplesscache');
        this.isEnabled = enabled;
        if (this.isEnabled) {
            this.loadCache();
        }
    }

    private loadCache() {
        if (fs.existsSync(this.cachePath)) {
            try {
                const content = fs.readFileSync(this.cachePath, 'utf8');
                this.cacheMap = JSON.parse(content);
            } catch (e) {
                this.cacheMap = {};
            }
        }
    }

    public saveCache() {
        if (!this.isEnabled) return;
        try {
            fs.writeFileSync(this.cachePath, JSON.stringify(this.cacheMap, null, 2), 'utf8');
        } catch (e) {
            console.error('Failed to save Slopless cache:', e);
        }
    }

    public getHash(filePath: string): string | null {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return crypto.createHash('sha256').update(content).digest('hex');
        } catch (e) {
            return null;
        }
    }

    public getCachedViolations(filePath: string, currentHash: string): Violation[] | null {
        if (!this.isEnabled) return null;

        const entry = this.cacheMap[filePath];
        if (entry && entry.hash === currentHash) {
            return entry.violations;
        }
        return null; // Cache miss
    }

    public setCachedViolations(filePath: string, currentHash: string, violations: Violation[]) {
        if (!this.isEnabled) return;
        this.cacheMap[filePath] = {
            hash: currentHash,
            violations: violations
        };
    }
}
