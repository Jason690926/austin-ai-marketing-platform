import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// 首次引入的測試基礎設施 — 只測純函式層（解析 / 序列化），node 環境即可。
// @ alias 對齊 tsconfig.json 的 "@/*": ["./*"]，讓測試能 import 專案模組。
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
