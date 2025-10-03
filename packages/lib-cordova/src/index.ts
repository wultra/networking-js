/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNPlatformUtils } from "../../lib-shared/src/WPNPlatformDependencies"
import { WPNCordovaPlatformUtilsProvider } from "./WPNCordovaPlatformUtilsProvider"

// SHARED EXPORTS

export * from "../../lib-shared/src/WPNEndpoint"
export * from "../../lib-shared/src/WPNException"
export * from "../../lib-shared/src/WPNKnownRestApiError"
export { WPNLoggerVerbosity, WPNLoggerConfig } from "../../lib-shared/src/WPNLogger"
export * from "../../lib-shared/src/WPNResponse"
export * from "../../lib-shared/src/WPNSDKVersion"
export { WPNUserAgent } from "../../lib-shared/src/WPNUserAgent"

// CORDOVA SPECIFIC EXPORTS

export { WPNNetworking } from "./WPNCordovaNetworking"
export { WPNRequestProcessor } from "../../lib-shared/src/WPNNetworkingBase"

// CORDOVA SPECIFIC IMPLEMENTATIONS

WPNPlatformUtils.provider = new WPNCordovaPlatformUtilsProvider()
