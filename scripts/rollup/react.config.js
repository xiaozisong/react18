
import { getPackagesJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'
import generatePackagesJson from 'rollup-plugin-generate-package-json'
const { name, module } = getPackagesJSON('react')
// react包路径
const pkgPath = resolvePkgPath(name)
// react产物路径
const pkgDistPath = resolvePkgPath(name, true)
console.log(pkgPath, 'pkgPath', module, 'module')
export default [
  //react
  {
    input: `${pkgPath}/index.ts`,
    output: {
      file: `${pkgDistPath}/index.js`,
      name: 'index.js',
      format: 'umd'
    },
    plugins: [...getBaseRollupPlugins(), generatePackagesJson({
      inputFolder: pkgPath,
      outputFolder: pkgDistPath,
      baseContents: ({name, description, version}) => ({
        name,
        description,
        version,
        main: 'index.js'
      })
    })]
  },
  // jsx-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      // jsx-runtime
      { 
        file: `${pkgDistPath}/jsx-runtime.js`,
        name: 'jsx-runtime.js',
        formate: 'und'
      },
      // jsx-dev-runtime
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`,
        name: 'jsx-dev-runtime.js',
        formate: 'umd'
      }
    ],
    plugins: getBaseRollupPlugins()
  }
]