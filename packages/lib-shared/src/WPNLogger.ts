//
// Copyright 2024 Wultra s.r.o.
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

import { WPNException } from "./WPNException"

/**
 * How much should PowerAuthNetworking library log into the console.
 */
export enum WPNLoggerVerbosity {
    /** No logs will be printed. */
    NONE    = 0,
    /** Only errors will be printed into the console. */
    ERROR   = 1,
    /** Warnings and errors will be printed into the console. */
    WARN    = 2,
    /** Info logs, warnings and errors will be printed into the console. */
    INFO    = 3,
    /** All but debug messages will be printed into the console. */
    VERBOSE = 4,
    /** All logs are on. */
    DEBUG   = 5
}

/**
 * PowerAuthNetworking logging utility.
 */
export class WPNLogger {

    /** Which level of logs (and lower) should be logged into the console. Default value is `WARN`. */
    public static verbosity: WPNLoggerVerbosity = WPNLoggerVerbosity.WARN

    /** Include time in the logs? */
    public static includeTime: boolean = true

    static debug(message: string | any) {
        this.log(message, WPNLoggerVerbosity.DEBUG)
    }

    static info(message: string | any) {
        this.log(message, WPNLoggerVerbosity.INFO)
    }

    static warn(message: string | any) {
        this.log(message, WPNLoggerVerbosity.WARN)
    }

    static verbose(message: string | any) {
        this.log(message, WPNLoggerVerbosity.VERBOSE)
    }

    static error(message: string | any) {
        this.log(message, WPNLoggerVerbosity.ERROR)
    }

    static errorAndException(message: string): WPNException {
        this.log(message, WPNLoggerVerbosity.ERROR)
        return new WPNException(message)
    }

    private static log(message: string | any, level: WPNLoggerVerbosity) {

        if (this.verbosity >= level) {

            let lvl: string

            switch (level) {
                case WPNLoggerVerbosity.DEBUG:
                    lvl = "DBG"
                    break
                case WPNLoggerVerbosity.INFO:
                    lvl = "INF"
                    break
                case WPNLoggerVerbosity.WARN:
                    lvl = "WRN"
                    break
                case WPNLoggerVerbosity.ERROR:
                    lvl = "ERR"
                    break
                case WPNLoggerVerbosity.VERBOSE:
                    lvl = "VBS"
                    break
                default:
                    lvl = "UKN"
                    break
            }

            console.log(`[WPN:${lvl}${this.includeTime ? " - " + new Date().toISOString() : ""}] ${message}`)
        }
    }
}
