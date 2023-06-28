import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import replace from '@rollup/plugin-replace'
import path from 'path'
const rep: any = replace({
  __DEV__: true,
  preventAssignment: true
})

const pkgPath = path.resolve(__dirname, '../../packages')
function resolvePkgPath(pkgName: any) {
  return `${pkgPath}/${pkgName}`
}
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    rep,
    react(), 
  ],
  resolve: {
    alias: [
      {
        find: 'react',
        replacement: resolvePkgPath('react')
      },
      {
        find: 'react-dom',
        replacement: resolvePkgPath('react-dom')
      },
      {
        find: 'hostConfig',
        replacement: path.resolve(resolvePkgPath('react-dom'), './src/hostConfig.ts')
      }
    ]
  }
})
