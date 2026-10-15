import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Load the actual TypeScript API modules with an isolated HTTP transport.
async function loadTopics(respond) {
  const calls = []
  const context = vm.createContext({
    URLSearchParams,
    FormData,
    fetch: async (path, options) => {
      const query = new URL(path, 'http://test.local')
      calls.push({ query, options })
      const data = await respond(query, options)
      return { ok: true, status: 200, json: async () => ({ code: 0, ...data }) }
    },
  })
  const modules = new Map()
  async function load(url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const source = await readFile(url, 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    const module = new vm.SourceTextModule(compiled, { context, identifier: url.href })
    modules.set(url.href, module)
    await module.link((specifier, parent) => load(new URL(`${specifier}.ts`, parent.identifier)))
    return module
  }
  const entry = await load(new URL('../src/api/topics.ts', import.meta.url))
  await entry.evaluate()
  return { api: entry.namespace, calls }
}

function post(id, kind = 'article') {
  return { id, kind, slug: String(id), status: 'published', published_at: '2026-10-15T00:00:00Z', created_at: '2026-10-14T00:00:00Z' }
}

test('tags include essay-only topics and merge shared names', async () => {
  const { api, calls } = await loadTopics(async (url) => ({ data: url.searchParams.get('kind') === 'article'
    ? [{ id: 1, name: '共享' }, { id: 2, name: '文章' }]
    : [{ id: 1, name: '共享' }, { id: 3, name: '随笔' }] }))
  const tags = await api.fetchTopicTags(new AbortController().signal)
  assert.deepEqual(Array.from(tags, (tag) => tag.name).sort(), ['共享', '文章', '随笔'].sort())
  assert.equal(calls.length, 2)
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
})

test('a topic spanning more than 100 posts retrieves both kinds and encodes the tag', async () => {
  const tag = 'C++ / 中文 & #?'
  const { api, calls } = await loadTopics(async (url) => {
    assert.equal(url.searchParams.get('tag'), tag)
    const kind = url.searchParams.get('kind')
    const page = Number(url.searchParams.get('page'))
    return { data: kind === 'essay' ? [post(201, 'essay')] : page === 1
      ? Array.from({ length: 100 }, (_, index) => post(index + 1)) : [post(101)],
    meta: { page, per_page: 100, total: kind === 'essay' ? 1 : 101 } }
  })
  const result = await api.fetchTopicPosts(tag, false, new AbortController().signal)
  assert.equal(result.articles.length, 101)
  assert.equal(result.essays.length, 1)
  assert.equal(result.articles[0].id, 101)
  assert.equal(calls.length, 3)
  assert.ok(calls.every(({ query }) => query.searchParams.get('status') === 'published'))
})

test('owner requests include drafts; an empty kind finishes without extra requests', async () => {
  const { api, calls } = await loadTopics(async () => ({ data: [], meta: { per_page: 100, total: 0 } }))
  const result = await api.fetchTopicPosts('草稿专题', true, new AbortController().signal)
  assert.equal(result.articles.length + result.essays.length, 0)
  assert.equal(calls.length, 2)
  assert.ok(calls.every(({ query }) => query.searchParams.get('status') === 'all'))
})

test('cancelling a topic cancels its in-flight requests', async () => {
  const controller = new AbortController()
  const { api, calls } = await loadTopics((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
  }))
  const pending = api.fetchTopicPosts('shared', false, controller.signal)
  controller.abort()
  await assert.rejects(pending, /cancelled/)
  assert.ok(calls.every(({ options }) => options.signal.aborted))
})

test('a failed kind does not return misleading partial results', async () => {
  const { api } = await loadTopics(async (url) => {
    if (url.searchParams.get('kind') === 'essay') throw new Error('offline')
    return { data: [post(1)], meta: { per_page: 100, total: 1 } }
  })
  await assert.rejects(api.fetchTopicPosts('shared', false, new AbortController().signal), /offline/)
})
