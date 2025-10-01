
import { WPNEndpoint, WPNEndpointType } from '../../lib-shared/src/WPNEndpoint';
import { WPNAuthToken, WPNNetworkingBase, WPNRequestProcessor } from '../../lib-shared/src/WPNNetworkingBase';
import { PowerAuth, PowerAuthAuthentication } from 'react-native-powerauth-mobile-sdk';

export class WPNNetworking extends WPNNetworkingBase {
    
    private pa: PowerAuth;

    constructor(pa: PowerAuth, baseURL: string) {
        super(baseURL);
        this.pa = pa;
    }

    async call<T>(
        endpoint: WPNEndpoint<T>,
        requestData: any, 
        authentication: PowerAuthAuthentication,
        requestProcessor?: WPNRequestProcessor
    ) {
        const authHeaderProvider = async (body: string): Promise<WPNAuthToken> => {
            return await this.getAuthHeader(authentication, endpoint, body);
        };

        return await this.callInternal(
            requestData,
            endpoint,
            authHeaderProvider,
            requestProcessor
        );
    }

    private async getAuthHeader<T>(
        authentication: PowerAuthAuthentication,
        endpoint: WPNEndpoint<T>,
        body: string
    ): Promise<WPNAuthToken> {

        if (endpoint.type === WPNEndpointType.SIGNED) {
            // Signed request
            return this.pa.requestSignature(authentication, endpoint.method, endpoint.uriId!, body);
        } else if (endpoint.type === WPNEndpointType.SIGNED_WITH_TOKEN) {
            // Signed request with token
            let token = await this.pa.tokenStore.requestAccessToken(endpoint.tokenName!, authentication);
            return await this.pa.tokenStore.generateHeaderForToken(token.tokenName);
        } else {
            // No authentication required
            return undefined;
        }
    }
}