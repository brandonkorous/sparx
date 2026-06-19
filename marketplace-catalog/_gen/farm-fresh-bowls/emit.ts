// Farm Fresh generator — the MULTI-FILE payload emitter (docs/85). The shipped
// payload is a THIN entry (blueprint.ts) that imports each big section from ./parts/*
// and default-exports the assembled manifest. The ingest dynamic-imports the entry;
// ESM resolves the relative parts (proven), so the payload stays self-contained (pure
// data, no @sparx imports). Why multi-file: a human editing the shipped artifact opens
// a scoped file (e.g. parts/pages/home.ts), never one multi-thousand-line wall — and a
// re-run of the generator overwrites it cleanly.
//
// All node ids are already minted (the manifest passed in is fully built); this module
// only serializes — so it is order-independent and depth-agnostic (the caller supplies
// `bundleDir`).

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

import { type BuilderNode } from './_kit';

// Just the slice of the manifest the emitter walks — everything else rides through on
// the index signature and is serialized as-is.
interface ManifestLike {
  assets: unknown;
  content: unknown;
  commerce: unknown;
  layout: { tree: BuilderNode; [k: string]: unknown };
  pages: Array<{ name: string; slug?: string; tree: BuilderNode; [k: string]: unknown }>;
  emails: Array<{ name: string; tree: BuilderNode; [k: string]: unknown }>;
  [k: string]: unknown;
}

const kebab = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const partHeader = (what: string): string =>
  `// Farm Fresh — ${what} (GENERATED payload part, docs/85). Pure data, no imports.\n` +
  `// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The\n` +
  `// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.\n\n`;

/** Write the THIN entry + every ./parts/* module for `manifest` under `bundleDir`. */
export async function emitBundle(bundleDir: string, manifest: ManifestLike): Promise<void> {
  // `writeModule` writes one ./parts/<rel> data module: optional import lines at the
  // top (relative to THIS module's own folder), then `export default` the value with
  // every `__REF__<var>` sentinel unquoted into the bare import identifier.
  const writeModule = async (
    rel: string,
    what: string,
    importLines: string[],
    value: unknown
  ): Promise<void> => {
    const p = join(bundleDir, 'parts', rel);
    await fs.mkdir(dirname(p), { recursive: true });
    const json = JSON.stringify(value, null, 2).replace(/"__REF__(\w+)"/g, '$1');
    const head = importLines.length ? `${importLines.join('\n')}\n\n` : '';
    await fs.writeFile(p, partHeader(what) + head + `export default ${json};\n`);
  };

  // The entry's import lines, in emit order.
  const imports: string[] = [];

  // `topPart` writes a self-contained data/tree module at parts/<file>.ts and records
  // the entry's import. Returns the entry-side `__REF__` sentinel.
  const topPart = async (file: string, varName: string, what: string, value: unknown): Promise<string> => {
    await writeModule(`${file}.ts`, what, [], value);
    imports.push(`import ${varName} from './parts/${file}';`);
    return `__REF__${varName}`;
  };

  // `emitTree` writes a page/email tree at parts/<dir>/<base>.ts. With `splitChildren`,
  // each direct child section becomes its OWN file under parts/<dir>/<base>/NN-name.ts
  // and the tree module re-imports them — so even the home page is a FOLDER of small
  // section files, never one wall. The ingest resolves the import chain transitively.
  const emitTree = async (
    dir: string,
    base: string,
    varName: string,
    what: string,
    tree: BuilderNode,
    splitChildren = false
  ): Promise<string> => {
    const kids = tree.children;
    if (splitChildren && Array.isArray(kids) && kids.length > 1) {
      const childImports: string[] = [];
      const childRefs: string[] = [];
      for (let i = 0; i < kids.length; i += 1) {
        const child = kids[i];
        const cname = `${String(i + 1).padStart(2, '0')}-${kebab(child.name ?? `block-${i + 1}`)}`;
        const cvar = `${varName}_${i}`;
        await writeModule(`${dir}/${base}/${cname}.ts`, `${what} · ${child.name ?? 'block'}`, [], child);
        childImports.push(`import ${cvar} from './${base}/${cname}';`);
        childRefs.push(`__REF__${cvar}`);
      }
      await writeModule(`${dir}/${base}.ts`, what, childImports, { ...tree, children: childRefs });
    } else {
      await writeModule(`${dir}/${base}.ts`, what, [], tree);
    }
    imports.push(`import ${varName} from './parts/${dir}/${base}';`);
    return `__REF__${varName}`;
  };

  // Stale-part guard: a renamed page/section would otherwise orphan its old file.
  await fs.rm(join(bundleDir, 'parts'), { recursive: true, force: true });

  // Split the heavy sections out; keep catalog metadata + brand/theme inline (small,
  // and the natural "overview" of the manifest). Spreading preserves key order.
  const entry: Record<string, unknown> = {
    ...manifest,
    assets: await topPart('assets', 'assets', 'media asset references', manifest.assets),
    content: await topPart('content', 'content', 'CMS content (blog posts)', manifest.content),
    commerce: await topPart('commerce', 'commerce', 'commerce catalog', manifest.commerce),
    layout: {
      ...manifest.layout,
      tree: await topPart('layout', 'layoutTree', 'site layout (announcement · header · footer)', manifest.layout.tree),
    },
  };
  const pages = [];
  for (const pg of manifest.pages) {
    const base = kebab(pg.slug ?? pg.name);
    const varName = `page_${base.replace(/-/g, '_')}`;
    // The home page is the big one — split its sections into a folder.
    const tree = await emitTree('pages', base, varName, `${pg.name} page`, pg.tree, pg.name === 'Home');
    pages.push({ ...pg, tree });
  }
  entry.pages = pages;
  const emails = [];
  for (const em of manifest.emails) {
    const base = kebab(em.name);
    const varName = `email_${base.replace(/-/g, '_')}`;
    const tree = await emitTree('emails', base, varName, `${em.name} email`, em.tree, false);
    emails.push({ ...em, tree });
  }
  entry.emails = emails;

  const entryJson = JSON.stringify(entry, null, 2).replace(/"__REF__(\w+)"/g, '$1');
  const entryFile =
    `// Farm Fresh — blueprint payload ENTRY (GENERATED, docs/85). THIN: it imports\n` +
    `// each heavy section from ./parts/* and default-exports the assembled manifest. The\n` +
    `// ingest dynamic-imports this file; ESM resolves the parts. Edit a scoped file under\n` +
    `// ./parts/, or the gen source, then re-run the generator.\n\n` +
    `${imports.join('\n')}\n\nexport default ${entryJson};\n`;

  await fs.writeFile(join(bundleDir, 'blueprint.ts'), entryFile);
  console.log(
    `gen-farm-fresh-bowls: wrote multi-file payload — blueprint.ts entry + ${imports.length} parts`
  );
}
