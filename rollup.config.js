import typescript from 'rollup-plugin-typescript2'
import { dts } from "rollup-plugin-dts"

// Configuration for building the React Native and Cordova library

const libCordovaDir = 'packages/lib-cordova'
const libCordovaInput = `${libCordovaDir}/src/index.ts`
const libCordovaOutput = `${libCordovaDir}/www/app.js`
const libCordovaOutputDts = `${libCordovaDir}/www/app.d.ts`

const libRNDir = 'packages/lib-rn'
const libRNInput = `${libRNDir}/src/index.ts`
const libRNOutput = `${libRNDir}/lib`

// Generate both the JavaScript bundle and the TypeScript declaration file

export default [
  // Cordova Library
  // {
  //   input: libCordovaInput,
  //   output: {
  //     file: libCordovaOutput,
  //     format: 'cjs',
  //     sourcemap: true
  //   },
  //   plugins: [
  //     typescript({
  //       tsconfig: `${libCordovaDir}/tsconfig.json`
  //     })
  //   ]
  // },
  // // Cordova Library .d.ts
  // {
  //   input: libCordovaInput,
  //   output: { 
  //     file: libCordovaOutputDts, 
  //     format: 'es'
  //   },
  //   plugins: [dts()],
  // },

  // React Native Library
  {
    input: libRNInput,
    output: {
      dir: libRNOutput,
      format: 'es',
    },
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