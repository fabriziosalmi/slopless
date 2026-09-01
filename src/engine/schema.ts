import { z } from 'zod';

/** A snippet: either bare source, or source plus the filename it must be judged as. */
const TestCaseSchema = z.union([
    z.string(),
    z.object({
        file: z.string().optional(),
        code: z.string(),
        /** Repeat `code` this many times, for thresholds measured in lines. */
        repeat: z.number().int().positive().optional(),
    }),
]);

export type RuleTestCase = z.infer<typeof TestCaseSchema>;

export const RuleSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    severity: z.enum(['error', 'warning']),
    tags: z.array(z.string()).optional(),
    match: z.object({
        regex: z.string().optional(),
        flags: z.string().optional(),
        file_types: z.array(z.string()).optional(),
        /**
         * Which lexical scope a regex match must live in. Only enforced for
         * TS/JS, where strings and comments can be located reliably; other
         * languages are always scanned as a whole.
         *   code     - the match must not start inside a string or a comment (default)
         *   strings  - the match must start inside a string or template literal
         *   comments - the match must start inside a comment
         *   all      - no scope filtering
         */
        scan: z.enum(['code', 'strings', 'comments', 'all']).optional(),
        /** Evaluate the regex against the whole file instead of line by line. */
        multiline: z.boolean().optional(),
        /** Glob patterns; a file whose path matches any of them is skipped. */
        exclude_files: z.array(z.string()).optional(),
        /** Substrings; a CSS match whose enclosing selector contains any of them is skipped. */
        exclude_selectors: z.array(z.string()).optional(),
        require_selectors: z.array(z.string()).optional(),
        git_check: z.enum([
            'committed_env',
            'binary_file',
            'node_modules',
            'commit_message_too_short',
            'missing_gitignore',
            'missing_license',
            'missing_readme',
            'spaces_in_filenames',
            'too_many_staged_files',
            'filename_too_long',
            'large_file_size',
            'committed_ide_settings',
            'missing_contributing',
            'missing_security',
            'missing_changelog'
        ]).optional(),
        ast_check: z.object({
            type: z.enum([
                'function-params-limit',
                'function-length-limit',
                'file-length-limit',
                'empty-catch',
                'nested-blocks-limit',
                'empty-block',
                'one-liner-limit',
                'redundant-if-true',
                'lying-function-names',
                'empty-interface',
                'async-without-await',
                'empty-file'
            ]),
            threshold: z.number().optional(),
        }).optional(),
        heuristic_check: z.enum([
            'link-checker',
            'circular-dependency',
            'stale-copyright-year'
        ]).optional(),
        semantic_check: z.enum([
            'boolean-naming',
            'boolean-redundancy',
            'collection-suffix',
            'semantic-shadowing'
        ]).optional(),
        type_check: z.enum([
            'floating-promise'
        ]).optional(),
        threshold: z.number().optional(),
    }),
    fix: z.object({
        regex_replace: z.object({
            pattern: z.string(),
            replacement: z.string()
        }).optional()
    }).optional(),
    /**
     * Rule ids this rule is a more specific case of. When both fire on the same
     * line, only this one is reported.
     */
    supersedes: z.array(z.string()).optional(),
    /**
     * Off unless the config asks for it by id. For rules that encode a house
     * style rather than a defect: a preference nobody agreed to should not be
     * two thirds of what the tool says.
     */
    opt_in: z.boolean().optional(),
    /**
     * Executable examples. Every rule carries at least one snippet it must flag
     * and one it must leave alone; `rule-fixtures.test.ts` runs them all.
     */
    tests: z.object({
        fire: z.array(TestCaseSchema).optional(),
        quiet: z.array(TestCaseSchema).optional(),
        /** Why this rule cannot be exercised from a text snippet. */
        external: z.string().optional(),
    }).optional(),
    message: z.string(),
    docs_url: z.string().optional(),
});

export type Rule = z.infer<typeof RuleSchema>;
