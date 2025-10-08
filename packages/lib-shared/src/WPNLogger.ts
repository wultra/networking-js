/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNException } from "./WPNException"

/** How much should PowerAuthNetworking library log into the console.*/
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

/** Configuration of the PowerAuthNetworking logger. */
export class WPNLoggerConfig {
    /** Which level of logs (and lower) should be logged into the console. Default value is `WARN`. */
    public static verbosity: WPNLoggerVerbosity = WPNLoggerVerbosity.WARN

    /** Include time in the logs? */
    public static includeTime: boolean = true

    /** 
     * Optional listener that will receive log messages.
     * 
     * Note that listener will receive all log messages regardless the verbosity level.
     */
    public static listener?: WPNLoggerListener
}

/** Listener interface for receiving log messages. */
export interface WPNLoggerListener {
    /** 
     * Method called when a log message is generated. 
     * 
     * Note that this method is called regardless the verbosity level.
     */
    log(message: string, level: WPNLoggerVerbosity): void
}

/** PowerAuthNetworking logging utility.*/
export class WPNLogger {

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

    private static log(message: string, level: WPNLoggerVerbosity) {

        if (WPNLoggerConfig.verbosity >= level) {

            let lvl: string
            switch (level) {
                case WPNLoggerVerbosity.DEBUG:   lvl = "DBG"; break;
                case WPNLoggerVerbosity.INFO:    lvl = "INF"; break;
                case WPNLoggerVerbosity.WARN:    lvl = "WRN"; break;
                case WPNLoggerVerbosity.ERROR:   lvl = "ERR"; break;
                case WPNLoggerVerbosity.VERBOSE: lvl = "VBS"; break;
                default:                         lvl = "UKN"; break;
            }

            console.log(`[WPN:${lvl}${WPNLoggerConfig.includeTime ? " - " + new Date().toISOString() : ""}] ${message}`)
        }

        // Notify listener if available regardless of the verbosity level
        try {
            WPNLoggerConfig.listener?.log(message, level)
        } catch (e) {
            // Ignore errors from the listener
        }
    }
}
