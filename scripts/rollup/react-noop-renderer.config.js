
import { getPackagesJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'
import generatePackagesJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'
const { name, module, peerDependencies } = getPackagesJSON('react-noop-renderer')
// react-noop-renderer包路径
const pkgPath = resolvePkgPath(name)
// react-noop-renderer产物路径
const pkgDistPath = resolvePkgPath(name, true)
console.log(pkgPath, 'pkgPath', module, 'module')
export default [
  //react-noop-renderer
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactNoopRenderer',
        format: 'umd'
      },
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBaseRollupPlugins({
        typescript: {
          exclude: ['./packages/react-dom/**/*'],
          tsconfigOverride: {
            compilerOptions: {
              paths: {
                hostConfig: [`./${name}src/hostConfig.ts`]
              }
            }
          }
        }
      }), 
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackagesJson({
      inputFolder: pkgPath,
      outputFolder: pkgDistPath,
      baseContents: ({name, description, version}) => ({
        name,
        description,
        version,
        peerDependencies: {
          react: version
        },
        main: 'index.js'
      })
    })]
  },
]