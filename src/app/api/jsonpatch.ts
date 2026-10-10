// Minimal RFC 6902 JSON Patch applier (mutates target). Used for the live feed's
// /diffPatch endpoint, which returns [{ diff: [ops...] }, ...].
// Throws on any op it can't apply so the caller can fall back to a full refetch.

type Op = { op: string; path: string; value?: unknown; from?: string };

function parse(path: string): string[] {
  if (path === '') return [];
  if (path[0] !== '/') throw new Error(`bad pointer ${path}`);
  return path.slice(1).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function parentOf(doc: any, keys: string[]): [any, string] {
  let cur = doc;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur?.[Array.isArray(cur) ? Number(keys[i]) : keys[i]];
    if (cur === undefined || cur === null) throw new Error(`missing path at ${keys.slice(0, i + 1).join('/')}`);
  }
  return [cur, keys[keys.length - 1]];
}

function get(doc: any, path: string): unknown {
  return parse(path).reduce((c, k) => (c == null ? c : c[Array.isArray(c) ? Number(k) : k]), doc);
}

function clone<T>(v: T): T { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

export function applyPatch(doc: any, ops: Op[]): void {
  for (const o of ops) {
    const keys = parse(o.path);
    if (!keys.length) throw new Error('root replace unsupported');
    const [parent, key] = parentOf(doc, keys);
    switch (o.op) {
      case 'add': {
        if (Array.isArray(parent)) {
          const i = key === '-' ? parent.length : Number(key);
          parent.splice(i, 0, o.value);
        } else parent[key] = o.value;
        break;
      }
      case 'replace': {
        if (Array.isArray(parent)) parent[Number(key)] = o.value; else parent[key] = o.value;
        break;
      }
      case 'remove': {
        if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key];
        break;
      }
      case 'move':
      case 'copy': {
        const v = clone(get(doc, o.from!));
        if (o.op === 'move') applyPatch(doc, [{ op: 'remove', path: o.from! }]);
        applyPatch(doc, [{ op: 'add', path: o.path, value: v }]);
        break;
      }
      case 'test': {
        if (JSON.stringify(get(doc, o.path)) !== JSON.stringify(o.value)) throw new Error('test failed');
        break;
      }
      default:
        throw new Error(`unknown op ${o.op}`);
    }
  }
}
