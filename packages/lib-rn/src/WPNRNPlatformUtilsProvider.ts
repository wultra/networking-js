/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNPlatformUtilsProvider } from "../../lib-shared/src/WPNPlatformDependencies"
import { Platform } from "react-native"
import { PowerAuthUtils } from "react-native-powerauth-mobile-sdk"

/** React Native platform utils provider */
export class WPNRNPlatformUtilsProvider implements WPNPlatformUtilsProvider {
    getPlatform() {
        return Platform.OS == "ios" ? "ios" : "android"
    }

    async getEnvironmentInfo() {
        return await PowerAuthUtils.getEnvironmentInfo()
    }
}