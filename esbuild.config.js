import { build } from 'esbuild'

await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'lib/index.cjs',
    format: 'cjs',
    platform: 'node',
    external: [
        'koishi',
        '@pynickle/koishi-plugin-adapter-onebot',
        'ai',
        '@ai-sdk/openai',
        'zod',
        "axios",
        "cheerio",
        "turndown",
        "autocorrect-node"
    ],
})
