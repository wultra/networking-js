//
// Copyright 2025 Wultra s.r.o.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions
// and limitations under the License.
//

import { WPNPlatformUtils } from "../../lib-shared/src/WPNPlatformDependencies"
import { WPNRNPlatformUtilsProvider } from "./WPNRNPlatformUtilsProvider"

// SHARED EXPORTS

export * from "../../lib-shared/src/WPNEndpoint"
export * from "../../lib-shared/src/WPNException"
export * from "../../lib-shared/src/WPNKnownRestApiError"
export { WPNLoggerVerbosity, WPNLoggerConfig } from "../../lib-shared/src/WPNLogger"
export * from "../../lib-shared/src/WPNResponse"
export * from "../../lib-shared/src/WPNSDKVersion"
export { WPNUserAgent } from "../../lib-shared/src/WPNUserAgent"

// REACT NATIVE SPECIFIC EXPORTS

export { WPNNetworking } from "./WPNRNNetworking"
export { WPNRequestProcessor } from "../../lib-shared/src/WPNNetworkingBase"

// REACT NATIVE SPECIFIC IMPLEMENTATIONS

WPNPlatformUtils.provider = new WPNRNPlatformUtilsProvider()
