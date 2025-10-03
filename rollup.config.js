import typescript from 'rollup-plugin-typescript2'
import { dts } from "rollup-plugin-dts"

// Configuration for building the React Native and Cordova library

const libCordovaDir = 'packages/lib-cordova'
const libCordovaInput = `${libCordovaDir}/src/index.ts`
const libCordovaOutput = `${libCordovaDir}/lib/index.js`
const libCordovaOutputDts = `${libCordovaDir}/lib/index.d.ts`

const libRNDir = 'packages/lib-rn'
const libRNInput = `${libRNDir}/src/index.ts`
const libRNOutput = `${libRNDir}/lib`

// Generate both the JavaScript bundle and the TypeScript declaration file

export default [
  //Cordova Library
  {
    input: libCordovaInput,
    output: {
      file: libCordovaOutput,
      format: 'cjs',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: `${libCordovaDir}/tsconfig.json`
      }),
      // A simple plugin to strip out import and require statements
      // since Cordova imports modules on its own.
      {
        name: "strip-imports",
        transform(code, id) {
          return {
            code: code.replace(/import\s+.*?;|require\s*\(.*?\);?/g, ""),
            map: null,
          };
        },
      }
    ]
  },
  // Cordova Library .d.ts
  {
    input: libCordovaInput,
    output: { 
      file: libCordovaOutputDts, 
      format: 'es'
    },
    plugins: [dts()],
  },

  // React Native Library
  {
    input: libRNInput,
    output: {
      dir: libRNOutput,
      format: 'es',
    },
    external: ['react-native-powerauth-mobile-sdk', 'react-native'],
    plugins: [
      typescript({
        tsconfig: `${libRNDir}/tsconfig.json`
      })
    ]
  },
  // React Native .d.ts
  {
    input: libRNInput,
    output: { 
      dir: libRNOutput,
      format: 'es'
    },
    plugins: [dts()],
  }
]