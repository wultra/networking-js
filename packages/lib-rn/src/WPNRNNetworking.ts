
import { WPNEndpoint, WPNEndpointType } from '../../lib-shared/src/WPNEndpoint';
import { WPNException } from '../../lib-shared/src/WPNException';
import { WPNAuthToken, WPNNetworkingBase, WPNRequestProcessor } from '../../lib-shared/src/WPNNetworkingBase';
import { PowerAuth, PowerAuthAuthentication } from 'react-native-powerauth-mobile-sdk';

/** Networking service for dispatching PowerAuth signed requests. */
export class WPNNetworking extends WPNNetworkingBase {
    
    private pa: PowerAuth;

    /**
     * @param pa PowerAuth instance
     * @param baseURL Base URL for the networking service (usually https://<your-server>/enrollment-server/)
     * If not provided, the base URL is taken from PowerAuth configuration.
     * @throws WPNException when baseURL is not provided and it cannot be taken from PowerAuth configuration.
     */
    constructor(pa: PowerAuth, baseURL: string | undefined) {
        const url = baseURL || pa.configuration?.baseEndpointUrl;
        if (!url) {
            throw new WPNException("WPNNetworking: Base URL not provided.");
        }
        super(url);
        this.pa = pa;
    }

    /** Dispatches a request to the specified endpoint.
     * @param endpoint Endpoint definition
     * @param requestData Request data object, will be serialized to JSON
     * @param authentication PowerAuthAuthentication object defining authentication factors to be used, or undefined for unsigned requests
     * If the endpoint is signed and authentication is not provided, an exception is thrown.
     * @param requestProcessor Optional request processor, used for custom modification of the request before it is sent
     * @returns Response object deserialized from JSON
     * @throws WPNException when an internal error occurs
     * @throws WPNKnownRestApiError when a known REST API error is returned from the server
     */
    async call<T>(
        endpoint: WPNEndpoint<T>,
        requestData: any, 
        authentication: PowerAuthAuthentication | undefined,
        requestProcessor?: WPNRequestProcessor
    ) {
        return await this.callInternal(
            requestData,
            endpoint,
            body => this.getAuthHeader(authentication, endpoint, body),
            requestProcessor
        );
    }

    // Returns the authentication header for the request (or undefined for unsigned requests)
    private async getAuthHeader<T>(auth: PowerAuthAuthentication | undefined, endpoint: WPNEndpoint<T>, body: string): Promise<WPNAuthToken> {
        
        // Ensure that authentication object is provided for signed requests
        if (!auth && endpoint.type !== WPNEndpointType.UNSIGNED) {
            throw new WPNException("WPNNetworking: Authentication object not provided for signed request.");
        }

        if (endpoint.type === WPNEndpointType.SIGNED) {
            // Signed request
            return this.pa.requestSignature(auth!, endpoint.method, endpoint.uriId!, body);
        } else if (endpoint.type === WPNEndpointType.SIGNED_WITH_TOKEN) {
            // Signed request with token
            const token = await this.pa.tokenStore.requestAccessToken(endpoint.tokenName!, auth!);
            return await this.pa.tokenStore.generateHeaderForToken(token.tokenName);
        } else {
            // Unsigned request
            return;
        }
    }
}