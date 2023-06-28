
import { getPackagesJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'
import generatePackagesJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'
const { name, module, peerDependencies } = getPackagesJSON('react-dom')
// react-dom包路径
const pkgPath = resolvePkgPath(name)
// react-dom产物路径
const pkgDistPath = resolvePkgPath(name, true)
console.log(pkgPath, 'pkgPath', module, 'module')
export default [
  //react-dom
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactDOM',
        format: 'umd'
      },
      {
        file: `${pkgDistPath}/client.js`,
        name: 'client',
        format: 'umd'
      },
    ],
    external: [...Object.keys(peerDependencies)],
    plugins: [
      ...getBaseRollupPlugins(), 
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
  // react-test-utils
  {
    input: `${pkgPath}/test-utils.ts`,
    output: [
      {
        file: `${pkgDistPath}/test-utils.js`,
        name: 'testUtils',
        format: 'umd'
      },
      {
        file: `${pkgDistPath}/client.js`,
        name: 'client.js',
        format: 'umd'
      },
    ],
    external: ['react-dom', 'react'],
    plugins:getBaseRollupPlugins(), 
  },
]