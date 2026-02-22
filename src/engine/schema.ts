import { z } from 'zod';

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
        exclude: z.array(z.string()).optional(),
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
            'large_file_size'
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
                'empty-file'
            ]),
            threshold: z.number().optional(),
        }).optional(),
        heuristic_check: z.enum([
            'link-checker',
            'circular-dependency'
        ]).optional(),
        semantic_check: z.enum([
            'boolean-naming',
            'boolean-redundancy',
            'collection-suffix',
            'semantic-shadowing'
        ]).optional(),
        threshold: z.number().optional(),
    }),
    fix: z.object({
        regex_replace: z.object({
            pattern: z.string(),
            replacement: z.string()
        }).optional()
    }).optional(),
    message: z.string(),
    docs_url: z.string().optional(),
});

export type Rule = z.infer<typeof RuleSchema>;
