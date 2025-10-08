/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNLogger } from "./WPNLogger"
import { WPNEnvironmentInfo, WPNPlatformUtils } from "./WPNPlatformDependencies"
import { WPN_SDK_VERSION } from "./WPNSDKVersion"

/** Automatic values that will be used for User-Agent HTTP header. */
export enum WPNUserAgent {
    /** 
     * Default value provided by the library. 
     * 
     * Example value (on an Apple device):
     * `PowerAuthNetworkingJS/1.0.0 com.yourcompany.yourappid/1.0.0 (Apple; iOS/18.2; iPhone16)`.
     */
    LIBRARY_DEFAULT = "LIBRARY_DEFAULT",

    /** 
     * System default.
     */
    SYSTEM_DEFAULT = "SYSTEM_DEFAULT"
}

export class WPNUserAgentUtils {
    
    private static cachedEnvironmentInfo: WPNEnvironmentInfo | undefined

    static async get(userAgent: WPNUserAgent | string): Promise<string | undefined> {

        // Set User-Agent header
        if (userAgent == WPNUserAgent.LIBRARY_DEFAULT) {
            
            // Construct default user agent string
            const product = "PowerAuthNetworkingJS"
            const sdkVer = WPN_SDK_VERSION
            const envInfo = await this.getEnvironmentInfo()
            const appVer = envInfo.applicationVersion || "0.0"
            const appId = envInfo.applicationIdentifier || "unknown"
            const maker = envInfo.deviceManufacturer
            const model = envInfo.deviceId
            const os = envInfo.systemName
            const osVer = envInfo.systemVersion
            return `${product}/${sdkVer} ${appId}/${appVer} (${maker}; ${os}/${osVer}; ${model})`

        } else if (userAgent == WPNUserAgent.SYSTEM_DEFAULT) {
            // leave empty to default to system value
            return undefined;
        } else {
            // Custom user agent string
            return userAgent;
        }
    }

    static async getEnvironmentInfo(): Promise<WPNEnvironmentInfo> {
        try {
            // If we have cached environment info, return it to avoid unnecessary calls.
            // This expects that the environment info does not change during the app lifetime.
            if (!this.cachedEnvironmentInfo) {
                this.cachedEnvironmentInfo = await WPNPlatformUtils.provider.getEnvironmentInfo();
            }
            return this.cachedEnvironmentInfo
        } catch (e) {
            WPNLogger.error(`Failed to get environment info: ${e}`)
            // In case of error, we return a default object with "unknown" values.
            return {
                systemName: "unknown",
                systemVersion: "0.0",
                applicationVersion: "0.0",
                applicationIdentifier: "unknown",
                deviceManufacturer: "unknown",
                deviceId: "unknown",
                sdkVersion: "0.0"
            }
        }
    }
}