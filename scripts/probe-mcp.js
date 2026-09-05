#!/usr/bin/env node
/**
 * Speaks to the MCP server the way a client does, over stdio, and checks it
 * answers. Building it proves it compiles; this proves it runs — the two are
 * not the same thing, and the extension next door is the reminder of that.
 *
 * Run from packages/mcp-slopless.
 */
const { spawn } = require('child_process');
const path = require('path');

const server = path.resolve(process.cwd(), 'out', 'server.js');
const child = spawn('node', [server], { stdio: ['pipe', 'pipe', 'inherit'] });

const send = message => child.stdin.write(JSON.stringify(message) + '\n');
const fail = why => { console.error(`mcp probe failed: ${why}`); child.kill(); process.exit(1); };

const timer = setTimeout(() => fail('no answer within 30 seconds'), 30_000);

let pending = '';
child.stdout.on('data', chunk => {
    pending += chunk.toString();
    let cut;
    while ((cut = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, cut);
        pending = pending.slice(cut + 1);
        if (!line.trim()) continue;

        let message;
        try {
            message = JSON.parse(line);
        } catch {
            fail(`stdout carried something that is not JSON-RPC: ${line.slice(0, 120)}`);
            return;
        }
        handle(message);
    }
});

function handle(message) {
    if (message.id === 1) {
        if (message.result?.serverInfo?.name !== 'slopless') fail('the handshake did not name slopless');
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
        return;
    }

    if (message.id === 2) {
        const named = (message.result?.tools ?? []).map(tool => tool.name).sort();
        for (const wanted of ['describe_rule', 'lint_files', 'lint_text']) {
            if (!named.includes(wanted)) fail(`${wanted} is not among the tools: ${named.join(', ')}`);
        }
        send({
            jsonrpc: '2.0', id: 3, method: 'tools/call',
            params: { name: 'lint_text', arguments: { content: 'var x = 1;\n', file_path: 'probe.ts' } },
        });
        return;
    }

    if (message.id === 3) {
        const text = message.result?.content?.[0]?.text ?? '';
        // A rule this obvious answering nothing means the engine is not wired in,
        // which is the failure worth catching here.
        if (!text.includes('VBC-005')) fail(`lint_text did not report use-var on \`var x = 1\`: ${text}`);
        clearTimeout(timer);
        console.log('mcp probe: handshake, three tools, and a finding on a buffer');
        child.kill();
        process.exit(0);
    }
}

send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '0' } },
});
