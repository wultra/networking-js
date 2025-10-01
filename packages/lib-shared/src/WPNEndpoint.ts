
export class WPNEndpoint<T> {

    static signed<U>(path: string, uriId: string, returnsData: boolean, dateFields?: string[]): WPNEndpoint<U> {
        return new WPNEndpoint<U>(path, returnsData, dateFields, uriId, undefined)
    }

    static signedWithToken<U>(path: string, tokenName: string, returnsData: boolean, dateFields?: string[]): WPNEndpoint<U> {
        return new WPNEndpoint<U>(path, returnsData, dateFields, undefined, tokenName)
    }

    static unsigned<U>(path: string, returnsData: boolean, dateFields?: string[]): WPNEndpoint<U> {
        return new WPNEndpoint<U>(path, returnsData, dateFields, undefined, undefined)
    }

    // HTTP method for the request. We currently support only POST method.
    readonly method = "POST"
    readonly path: string
    readonly returnsData: boolean
    readonly dateFields?: string[]
    readonly uriId?: string
    readonly tokenName?: string

    get type(): WPNEndpointType {
        if (this.uriId) {
            return WPNEndpointType.SIGNED
        } else if (this.tokenName) {
            return WPNEndpointType.SIGNED_WITH_TOKEN
        } else {
            return WPNEndpointType.UNSIGNED
        }
    }

    private constructor(path: string, returnsData: boolean, dateFields?: string[], uriId?: string, tokenName?: string) {
        // Ensure that path starts with a slash
        this.path = (path.startsWith("/") ? path : ("/" + path))
        this.returnsData = returnsData
        this.dateFields = dateFields
        this.uriId = uriId
        this.tokenName = tokenName
    }
}

export enum WPNEndpointType {
    SIGNED,
    SIGNED_WITH_TOKEN,
    UNSIGNED
}