import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/modules/editor/coverCrop.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

function load(document) {
  const exports = {}
  vm.runInNewContext(code, { exports, document, File, Error, Math, Promise })
  return exports
}

test('crop stays within wide, tall and tiny images for all positions and ratios', () => {
  const { cropRectangle } = load()
  for (const [width, height] of [[1200, 800], [800, 1800], [1, 1]]) {
    for (const ratio of [16 / 9, 4 / 3, 1, width / height]) {
      for (const zoom of [1, 1.5, 3]) {
        for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
          const crop = cropRectangle(width, height, ratio, zoom, { x, y })
          assert.ok(crop.x >= -1e-8 && crop.y >= -1e-8)
          assert.ok(crop.x + crop.width <= width + 1e-8)
          assert.ok(crop.y + crop.height <= height + 1e-8)
          assert.ok(Math.abs(crop.width / crop.height - ratio) < 1e-8)
        }
      }
    }
  }
})

test('position extremes select opposite edges instead of leaving blank borders', () => {
  const { cropRectangle } = load()
  const left = cropRectangle(1200, 800, 1, 1, { x: 1, y: 0 })
  const right = cropRectangle(1200, 800, 1, 1, { x: -1, y: 0 })
  assert.equal(left.x, 0)
  assert.equal(right.x, 400)
})

test('export caps resolution, preserves PNG alpha format and uses source crop coordinates', async () => {
  const draws = []
  const canvas = {
    getContext: () => ({ drawImage: (...args) => draws.push(args) }),
    toBlob: (callback, type) => callback(new Blob(['pixels'], { type })),
  }
  const { cropCover } = load({ createElement: () => canvas })
  const image = { naturalWidth: 6000, naturalHeight: 4000 }
  const file = await cropCover(image, new File(['original'], 'input.png', { type: 'image/png' }), 1, 1, { x: 1, y: 0 })
  assert.equal(canvas.width, 1920)
  assert.equal(canvas.height, 1920)
  assert.equal(file.type, 'image/png')
  assert.deepEqual(draws[0].slice(1), [0, 0, 4000, 4000, 0, 0, 1920, 1920])
})

test('export errors and oversized output fail before upload', async () => {
  const image = { naturalWidth: 800, naturalHeight: 600 }
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
  const { cropCover } = load({ createElement: () => ({
    getContext: () => ({ drawImage() {} }),
    toBlob: (callback) => callback(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)])),
  }) })
  await assert.rejects(cropCover(image, file, 1, 1, { x: 0, y: 0 }), /5MB/)
  const failing = load({ createElement: () => ({ getContext: () => null }) })
  await assert.rejects(failing.cropCover(image, file, 1, 1, { x: 0, y: 0 }), /无法创建/)
})
