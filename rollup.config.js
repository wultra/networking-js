import typescript from 'rollup-plugin-typescript2'
import { dts } from "rollup-plugin-dts"

// Cordova Library Configuration
const libCordovaDir = 'packages/lib-cordova'
const libCordovaInput = `${libCordovaDir}/src/index.ts`
const libCordovaOutput = `${libCordovaDir}/lib/index.js`
const libCordovaOutputDts = `${libCordovaDir}/lib/index.d.ts`
const expectedCordovaModules = ["cordova-powerauth-mobile-sdk", "cordova"]

// React Native Library Configuration
const libRNDir = 'packages/lib-rn'
const libRNInput = `${libRNDir}/src/index.ts`
const libRNOutput = `${libRNDir}/lib` 

// Generate both the JavaScript bundle and the TypeScript declaration file
export default [

  /**************
   * CORDOVA
   **************/

  // Cordova Library
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
      // We dont want to import modules that will be supplied by Cordova environment
      // Cordova plugins are injected at runtime, so we need to strip these imports from the final bundle to not cause errors.
      {
        name: "remove-cordova-modules",
        transform(code, id) {
          return {
            code: code.replace(new RegExp(`^import.*(?:${expectedCordovaModules.map(m => `"${m}"`).join("|")}).*$`, "gm"), ""),
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

  /**************
   * REACT NATIVE
   **************/

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