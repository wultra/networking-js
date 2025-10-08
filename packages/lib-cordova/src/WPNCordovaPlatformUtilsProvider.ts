/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNPlatformUtilsProvider } from "../../lib-shared/src/WPNPlatformDependencies"
import "cordova-powerauth-mobile-sdk"
import { cordova } from "cordova"

/** Cordova platform utils provider */
export class WPNCordovaPlatformUtilsProvider implements WPNPlatformUtilsProvider {
    getPlatform() {
        return cordova.platformId === "ios" ? "ios" : "android"
    }

    async getEnvironmentInfo() {
        return await PowerAuthUtils.getEnvironmentInfo()
    }
}