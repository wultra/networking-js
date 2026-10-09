import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import vm from 'node:vm'

const encode = text => Buffer.from(text, 'utf8').toString('base64')
const decode = data => Buffer.from(data, 'base64').toString('utf8')
const payload = { message: 'Příliš žluťoučký 🐎 日本語', empty: '' }
const encryptedBody = Uint8Array.from([0, 255, 128, 42, 13, 10])
const responseBytes = Uint8Array.from([254, 0, 129, 10])
const ok = JSON.stringify({ status: 'OK', responseObject: payload })

// Exercise the built networking packages with fixed PowerAuth responses; no cryptography runs here.
async function load(platform, fetchImpl, contextOverrides = {}) {
    const context = vm.createContext({
        Headers, Response, Uint8Array, btoa, atob, console,
        fetch: fetchImpl,
        exports: {}, cordova: { platformId: 'ios' },
        PowerAuthUtils: { getEnvironmentInfo: async () => ({ systemName: 'iOS', systemVersion: '18', deviceManufacturer: 'Apple', deviceId: 'test', sdkVersion: '5.0.0' }) },
        ...contextOverrides
    })
    const code = await readFile(new URL(`../packages/lib-${platform}/lib/index.js`, import.meta.url), 'utf8')
    let sdk
    if (platform === 'rn') {
        const module = new vm.SourceTextModule(code, { context })
        await module.link(specifier => {
            const values = specifier === 'react-native'
                ? { Platform: { OS: 'ios' } }
                : { PowerAuthUtils: context.PowerAuthUtils }
            assert.ok(['react-native', 'react-native-powerauth-mobile-sdk'].includes(specifier))
            return new vm.SyntheticModule(Object.keys(values), function () {
                for (const [key, value] of Object.entries(values)) this.setExport(key, value)
            }, { context })
        })
        await module.evaluate()
        sdk = module.namespace
    } else {
        vm.runInContext(code, context)
        sdk = context.exports
    }
    sdk.WPNLoggerConfig.verbosity = sdk.WPNLoggerVerbosity.NONE
    return sdk
}

function powerAuthStub(overrides = {}) {
    const state = { events: [], encryptors: [], configurationReads: 0 }
    const pa = {
        get configuration() {
            state.configurationReads++
            return overrides.configuration?.() ?? Promise.resolve({ baseEndpointUrl: 'https://example.test/api/' })
        },
        async authenticationHeaderForRequestWithBody(...args) {
            state.events.push(['sign', ...args])
            if (overrides.signError) throw overrides.signError
            return { name: 'X-PowerAuth-Authorization', value: 'auth' }
        },
        tokenStore: {
            async requestAccessToken(name, auth) {
                state.events.push(['token', name, auth])
                return { tokenName: name }
            },
            async generateAuthenticationHeader(name) {
                state.events.push(['tokenHeader', name])
                return { name: 'X-PowerAuth-Token', value: 'token' }
            }
        },
        async getEncryptorForApplicationScope() { return acquire('application') },
        async getEncryptorForActivationScope() { return acquire('activation') }
    }
    function acquire(scope) {
        if (overrides.acquireError) throw overrides.acquireError
        state.events.push(['acquire', scope])
        const item = { scope, released: 0, encrypted: 0, decrypted: 0 }
        state.encryptors.push(item)
        return {
            async encryptRequest(body) {
                item.encrypted++
                state.events.push(['encrypt', body])
                if (overrides.encryptError) throw overrides.encryptError
                return {
                    requestBody: Buffer.from(encryptedBody).toString('base64'),
                    requestHeaders: [{ name: 'X-PowerAuth-Encryption', value: scope }]
                }
            },
            async decryptResponse(body) {
                item.decrypted++
                state.events.push(['decrypt', body])
                if (overrides.decryptError) throw overrides.decryptError
                return overrides.decrypted ?? encode(ok)
            },
            async release() { item.released++ }
        }
    }
    return { pa, state }
}

for (const platform of ['rn', 'cordova']) {
    for (const [baseURL, path] of [['https://example.test/api', 'data'], ['https://example.test/api/', '/data']]) {
        test(`${platform}: constructs a JSON POST from ${baseURL} and ${path}`, async () => {
            const sdk = await load(platform, async (url, request) => {
                assert.equal(url, 'https://example.test/api/data')
                assert.equal(request.method, 'POST')
                assert.equal(request.body, JSON.stringify(payload))
                assert.equal(request.headers.get('Content-Type'), 'application/json')
                assert.equal(request.headers.get('Accept'), 'application/json')
                assert.equal(request.headers.get('Accept-Language'), 'en')
                assert.equal(request.headers.get('User-Agent'), null)
                return new Response(ok)
            })
            const service = new sdk.WPNNetworking({}, { baseURL, userAgent: sdk.WPNUserAgent.SYSTEM_DEFAULT })
            assert.equal(JSON.stringify((await service.call(sdk.WPNEndpoint.unsigned(path), payload)).responseObject), JSON.stringify(payload))
        })
    }

    test(`${platform}: applies request interceptors in declaration order to the previous result`, async () => {
        const calls = []
        const replacement = { url: 'https://other.test/y', method: 'POST', headers: new Headers({ 'X-Custom': 'yes' }), body: '{"modified":true}' }
        const sdk = await load(platform, async (url, request) => {
            assert.equal(url, replacement.url)
            assert.equal(request, replacement)
            assert.deepEqual([...request.headers], [['x-custom', 'yes'], ['x-first', '1'], ['x-order', 'second']])
            return new Response(ok)
        })
        const requestInterceptors = [
            request => {
                calls.push('first')
                assert.equal(request.url, 'https://example.test/x')
                assert.equal(request.body, JSON.stringify(payload))
                assert.equal(request.headers.get('Content-Type'), 'application/json')
                request.headers.set('X-First', '1')
                request.headers.set('X-Order', 'first')
                return request
            },
            request => {
                calls.push('second')
                assert.equal(request.headers.get('X-First'), '1')
                request.headers.set('X-Order', 'second')
                return request
            },
            request => {
                calls.push('replace')
                for (const [key, value] of request.headers) if (key.startsWith('x-')) replacement.headers.set(key, value)
                return replacement
            }
        ]
        const service = new sdk.WPNNetworking({}, { baseURL: 'https://example.test', userAgent: 'test', requestInterceptors })
        await service.call(sdk.WPNEndpoint.unsigned('/x'), payload)
        assert.deepEqual(calls, ['first', 'second', 'replace'])
    })

    test(`${platform}: sends the unmodified request without interceptors`, async () => {
        for (const requestInterceptors of [undefined, []]) {
            const sdk = await load(platform, async (url, request) => {
                assert.equal(url, 'https://example.test/x')
                assert.deepEqual(Object.keys(request), ['url', 'method', 'headers', 'body'])
                assert.deepEqual([...request.headers], [['accept', 'application/json'], ['accept-language', 'en'], ['content-type', 'application/json'], ['user-agent', 'test']])
                assert.equal(request.body, JSON.stringify(payload))
                return new Response(ok)
            })
            await new sdk.WPNNetworking({}, { baseURL: 'https://example.test', userAgent: 'test', requestInterceptors }).call(sdk.WPNEndpoint.unsigned('/x'), payload)
        }
    })

    test(`${platform}: configuration cannot be changed after construction`, async () => {
        const calls = []
        const sdk = await load(platform, async (url, request) => {
            assert.equal(url, 'https://example.test/x')
            assert.equal(request.headers.get('Accept-Language'), 'en')
            return new Response(ok)
        })
        const config = { baseURL: 'https://example.test', requestInterceptors: [request => { calls.push('configured'); return request }] }
        const service = new sdk.WPNNetworking({}, config)
        config.requestInterceptors.push(() => assert.fail('added interceptor must not run'))
        config.requestInterceptors = [() => assert.fail('replaced interceptors must not run')]
        config.baseURL = 'https://changed.test'
        config.acceptLanguage = 'de'
        await service.call(sdk.WPNEndpoint.unsigned('/x'), payload)
        assert.deepEqual(calls, ['configured'])
    })

    test(`${platform}: rejects a non-object configuration`, async () => {
        const sdk = await load(platform, async () => assert.fail('request must not be sent'))
        for (const config of ['https://example.test', null]) {
            assert.throws(() => new sdk.WPNNetworking({}, config), error => error instanceof sdk.WPNException && /WPNConfig object/.test(error.description))
        }
    })

    test(`${platform}: formats the default user-agent from environment data`, async () => {
        const sdk = await load(platform, async (_url, request) => {
            assert.match(request.headers.get('User-Agent'), /^PowerAuthNetworkingJS\/\S+ unknown\/0\.0 \(Apple; iOS\/18; test\)$/)
            return new Response(ok)
        })
        await new sdk.WPNNetworking({}, { baseURL: 'https://example.test' }).call(sdk.WPNEndpoint.unsigned('/x'), payload)
    })

    for (const [name, body, error] of [
        ['success data', ok],
        ['empty success', '{"status":"OK"}'],
        ['REST error', '{"status":"ERROR","responseObject":{"code":"DENIED","message":"Denied"}}'],
        ['missing error details', '{"status":"ERROR"}', /no error data/],
        ['unknown status', '{"status":"OTHER"}', /Unknown response status/],
        ['missing status', '{}', /Unknown response status/],
        ['malformed JSON', 'invalid JSON', /JSON/]
    ]) {
        test(`${platform}: parses ${name}`, async () => {
            const sdk = await load(platform, async () => new Response(body))
            const call = new sdk.WPNNetworking({}, { baseURL: 'https://example.test', userAgent: 'test' }).call(sdk.WPNEndpoint.unsigned('/x'), payload)
            if (error) {
                await assert.rejects(call, actual => error.test(actual.description ?? actual.message))
            } else {
                const result = await call
                const expected = JSON.parse(body)
                assert.equal(result.status, expected.status)
                assert.equal(JSON.stringify(result.responseObject), JSON.stringify(expected.status === 'OK' ? expected.responseObject : undefined))
                assert.equal(JSON.stringify(result.responseError), JSON.stringify(expected.status === 'ERROR' ? expected.responseObject : undefined))
            }
        })
    }

    for (const kind of ['signed', 'signedWithToken']) {
        test(`${platform}: rejects missing authentication for ${kind} before dispatch`, async () => {
            const sdk = await load(platform, async () => assert.fail('request must not be sent'))
            const service = new sdk.WPNNetworking({}, { baseURL: 'https://example.test' })
            assert.throws(() => service.call(sdk.WPNEndpoint[kind]('/x', 'identifier'), payload), error => /Authentication object/.test(error.description))
        })
    }

    for (const kind of ['unsigned', 'signed', 'token']) {
        for (const scope of ['none', 'application', 'activation']) {
            test(`${platform}: forwards ${kind}/${scope} request data and dependency headers to HTTP`, async () => {
                let sent
                const sdk = await load(platform, async (url, request) => {
                    sent = { url, request }
                    return new Response(scope === 'none' ? ok : responseBytes)
                })
                const { pa, state } = powerAuthStub()
                const e2ee = { none: sdk.WPNE2EEConfiguration.NOT_ENCRYPTED, application: sdk.WPNE2EEConfiguration.APPLICATION_SCOPE, activation: sdk.WPNE2EEConfiguration.ACTIVATION_SCOPE }[scope]
                const endpoint = kind === 'signed' ? sdk.WPNEndpoint.signed('/data', '/uri-id', undefined, e2ee)
                    : kind === 'token' ? sdk.WPNEndpoint.signedWithToken('/data', 'token-name', undefined, e2ee)
                    : sdk.WPNEndpoint.unsigned('/data', undefined, e2ee)
                const auth = kind === 'unsigned' ? undefined : { factor: 'password' }
                let intercepted
                const service = new sdk.WPNNetworking(pa, { acceptLanguage: 'cs', userAgent: 'test-agent', requestInterceptors: [request => {
                    intercepted = { headers: [...request.headers], body: request.body, events: state.events.map(event => event[0]) }
                    request.headers.set('X-Interceptor', 'yes')
                    return request
                }] })
                const result = await service.call(endpoint, payload, auth)
                assert.equal(JSON.stringify(result.responseObject), JSON.stringify(payload))
                // Interceptor sees the final authenticated and encrypted request.
                assert.deepEqual([...sent.request.headers].filter(([key]) => key !== 'x-interceptor'), intercepted.headers)
                assert.equal(intercepted.body, sent.request.body)
                assert.deepEqual(intercepted.events, state.events.map(event => event[0]).filter(event => event !== 'decrypt'))
                assert.equal(state.configurationReads, 1)
                assert.equal(sent.url, 'https://example.test/api/data')
                assert.equal(sent.request.method, 'POST')
                for (const [key, value] of Object.entries({ 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': 'cs', 'User-Agent': 'test-agent', 'X-Interceptor': 'yes' })) assert.equal(sent.request.headers.get(key), value)
                assert.equal(sent.request.headers.get('X-PowerAuth-Authorization'), kind === 'signed' ? 'auth' : null)
                assert.equal(sent.request.headers.get('X-PowerAuth-Token'), kind === 'token' ? 'token' : null)
                if (kind === 'signed') {
                    assert.deepEqual(state.events.find(event => event[0] === 'sign'), ['sign', auth, 'POST', '/uri-id', JSON.stringify(payload)])
                    if (scope !== 'none') assert.ok(state.events.findIndex(event => event[0] === 'sign') < state.events.findIndex(event => event[0] === 'acquire'))
                }
                if (kind === 'token') assert.deepEqual(state.events.slice(0, 2), [['token', 'token-name', auth], ['tokenHeader', 'token-name']])
                if (scope === 'none') {
                    assert.equal(sent.request.body, JSON.stringify(payload))
                    assert.equal(state.encryptors.length, 0)
                } else {
                    assert.deepEqual(Array.from(sent.request.body), Array.from(encryptedBody))
                    assert.equal(decode(state.events.find(event => event[0] === 'encrypt')[1]), JSON.stringify(payload))
                    assert.equal(state.events.find(event => event[0] === 'decrypt')[1], Buffer.from(responseBytes).toString('base64'))
                    assert.deepEqual(state.encryptors, [{ scope, released: 1, encrypted: 1, decrypted: 1 }])
                }
                assert.equal(sent.request.headers.get('X-PowerAuth-Encryption'), scope !== 'none' && kind !== 'signed' ? scope : null)
            })
        }
    }

    test(`${platform}: waits for authentication before allocating request resources`, async () => {
        const { pa, state } = powerAuthStub()
        let finishAuthentication
        pa.authenticationHeaderForRequestWithBody = () => new Promise(resolve => { finishAuthentication = resolve })
        const sdk = await load(platform, async () => new Response(responseBytes))
        const service = new sdk.WPNNetworking(pa, { baseURL: 'https://example.test', userAgent: 'test' })
        const call = service.call(sdk.WPNEndpoint.signed('/x', '/uri', undefined, sdk.WPNE2EEConfiguration.ACTIVATION_SCOPE), payload, {})
        await new Promise(setImmediate)
        assert.equal(state.encryptors.length, 0)
        finishAuthentication({ name: 'Authorization', value: 'auth' })
        await call
        assert.equal(state.encryptors[0].released, 1)
    })

    for (const failure of ['acquire', 'sign', 'encrypt', 'interceptor', 'fetch', 'read', 'decrypt']) {
        test(`${platform}: propagates ${failure} failures and releases request resources`, async () => {
            const error = new Error(failure)
            const overrides = { [`${failure}Error`]: error }
            const { pa, state } = powerAuthStub(overrides)
            const sdk = await load(platform, async () => {
                if (failure === 'fetch') throw error
                if (failure === 'interceptor') assert.fail('request must not be sent')
                if (failure === 'read') return { ok: true, arrayBuffer: async () => { throw error } }
                return new Response(responseBytes)
            })
            const requestInterceptors = failure === 'interceptor' ? [() => { throw error }] : []
            const service = new sdk.WPNNetworking(pa, { baseURL: 'https://example.test', userAgent: 'test', requestInterceptors })
            const endpoint = sdk.WPNEndpoint.signed('/x', '/uri', undefined, sdk.WPNE2EEConfiguration.ACTIVATION_SCOPE)
            const call = service.call(endpoint, payload, {})
            await assert.rejects(call, actual => actual === error)
            assert.equal(state.encryptors.length, ['acquire', 'sign'].includes(failure) ? 0 : 1)
            for (const encryptor of state.encryptors) assert.equal(encryptor.released, 1)
        })
    }

    for (const [name, interceptor] of [['Promise', async request => request], ['rejected Promise', async () => { throw new Error('async') }], ['missing', () => undefined], ['URL-less', ({ url, ...rest }) => rest], ['URL-bearing rejected Promise', request => Object.assign(Promise.reject(new Error('async')), { url: request.url })]]) {
        test(`${platform}: rejects a ${name} interceptor result before dispatch and releases request resources`, async () => {
            const { pa, state } = powerAuthStub()
            const sdk = await load(platform, async () => assert.fail('request must not be sent'))
            const requestInterceptors = [interceptor, () => assert.fail('next interceptor must not run')]
            const service = new sdk.WPNNetworking(pa, { baseURL: 'https://example.test', userAgent: 'test', requestInterceptors })
            const call = service.call(sdk.WPNEndpoint.signed('/x', '/uri', undefined, sdk.WPNE2EEConfiguration.ACTIVATION_SCOPE), payload, {})
            await assert.rejects(call, actual => actual instanceof sdk.WPNException && /synchronously return a request with a URL/.test(actual.description))
            assert.equal(state.encryptors[0].released, 1)
        })
    }

    for (const body of [JSON.stringify({ status: 'ERROR', responseObject: { code: 'ERR', message: 'Zamítnuto' } }), ok, 'garbage', JSON.stringify({ status: 'ERROR' })]) {
        test(`${platform}: plaintext fallback accepts only an ERROR envelope (${body.slice(0, 30)})`, async () => {
            const originalError = new Error('decrypt')
            const { pa, state } = powerAuthStub({ decryptError: originalError })
            const sdk = await load(platform, async () => new Response(body))
            const service = new sdk.WPNNetworking(pa, { baseURL: 'https://example.test', userAgent: 'test' })
            const endpoint = sdk.WPNEndpoint.unsigned('/x', undefined, sdk.WPNE2EEConfiguration.APPLICATION_SCOPE)
            const call = service.call(endpoint, payload, undefined)
            if (body.includes('Zamítnuto')) {
                const result = await call
                assert.equal(result.status, 'ERROR')
                assert.equal(result.responseError.code, 'ERR')
                assert.equal(result.responseObject, undefined)
            } else await assert.rejects(call, actual => actual === originalError)
            assert.equal(state.encryptors[0].released, 1)
        })
    }

    for (const [body, error] of [
        [JSON.stringify({ status: 'ERROR', responseObject: { code: 'HTTP_ERROR' } })],
        [ok, /Expected an error response/],
        ['<html>502 Bad Gateway</html>', /Failed to parse the response/],
        [JSON.stringify({ status: 'ERROR' }), /no error data/]
    ]) {
        test(`${platform}: unsuccessful encrypted HTTP response never reaches decryptor (${body.slice(0, 20)})`, async () => {
            const { pa, state } = powerAuthStub()
            const sdk = await load(platform, async () => new Response(body, { status: 400 }))
            const service = new sdk.WPNNetworking(pa, { baseURL: 'https://example.test', userAgent: 'test' })
            const call = service.call(sdk.WPNEndpoint.unsigned('/x', undefined, sdk.WPNE2EEConfiguration.APPLICATION_SCOPE), payload, undefined)
            if (error) {
                await assert.rejects(call, actual => actual instanceof sdk.WPNException && error.test(actual.description))
                if (!body.includes('ERROR')) await call.catch(actual => assert.equal(actual.additionalData.status, 400))
            } else assert.equal((await call).responseError.code, 'HTTP_ERROR')
            assert.equal(state.encryptors[0].decrypted, 0)
            assert.equal(state.encryptors[0].released, 1)
        })
    }

    test(`${platform}: logs encrypted bodies as Base64 and unsuccessful encrypted responses`, async () => {
        const messages = []
        const silentConsole = { log() {} }
        const { pa } = powerAuthStub()
        let status = 200
        const sdk = await load(platform, async () => new Response(status === 200 ? responseBytes : '{"status":"ERROR","responseObject":{"code":"E"}}', { status }), { console: silentConsole })
        sdk.WPNLoggerConfig.verbosity = sdk.WPNLoggerVerbosity.VERBOSE
        sdk.WPNLoggerConfig.listener = { log: message => messages.push(message) }
        const service = new sdk.WPNNetworking(pa, { baseURL: 'https://example.test', userAgent: 'test' })
        const endpoint = sdk.WPNEndpoint.unsigned('/x', undefined, sdk.WPNE2EEConfiguration.APPLICATION_SCOPE)
        await service.call(endpoint, payload, undefined)
        assert.ok(messages.includes('ENCRYPTED BODY: ' + Buffer.from(encryptedBody).toString('base64')))
        assert.ok(messages.includes('ENCRYPTED RESPONSE: ' + Buffer.from(responseBytes).toString('base64')))
        status = 400
        messages.length = 0
        await service.call(endpoint, payload, undefined)
        assert.ok(messages.includes(' <- POST https://example.test/x - 400'))
        assert.ok(messages.includes('{"status":"ERROR","responseObject":{"code":"E"}}'))
        sdk.WPNLoggerConfig.listener = undefined
    })

    test(`${platform}: logs the request returned by interceptors`, async () => {
        const messages = []
        const sdk = await load(platform, async () => new Response(ok), { console: { log() {} } })
        sdk.WPNLoggerConfig.verbosity = sdk.WPNLoggerVerbosity.VERBOSE
        sdk.WPNLoggerConfig.listener = { log: message => messages.push(message) }
        const requestInterceptors = [request => ({ ...request, url: 'https://other.test/y', headers: { 'X-Correlation-ID': 'abc' }, body: '{"intercepted":true}' })]
        await new sdk.WPNNetworking({}, { baseURL: 'https://example.test', userAgent: 'test', requestInterceptors }).call(sdk.WPNEndpoint.unsigned('/x'), payload)
        sdk.WPNLoggerConfig.listener = undefined
        assert.deepEqual(messages.slice(0, 3), [' -> POST https://other.test/y', 'Headers: { "x-correlation-id:" "abc",}', '{"intercepted":true}'])
        assert.ok(messages.includes(' <- POST https://other.test/y - 200'))
    })

    test(`${platform}: explicit URL bypasses async configuration; missing implicit URL rejects the call`, async () => {
        const sdk = await load(platform, async () => new Response(ok))
        const { pa, state } = powerAuthStub({ configuration: () => Promise.resolve({}) })
        const endpoint = sdk.WPNEndpoint.unsigned('/x')
        await new sdk.WPNNetworking(pa, { baseURL: 'https://explicit.test/', userAgent: 'test' }).call(endpoint, payload, undefined)
        assert.equal(state.configurationReads, 0)
        const service = new sdk.WPNNetworking(pa, { userAgent: 'test' })
        await assert.rejects(service.call(endpoint, payload, undefined), error => /Base URL not provided/.test(error.description))
        assert.equal(state.configurationReads, 1)
    })

    test(`${platform}: configuration rejects only when call is awaited`, async () => {
        const error = new Error('configuration unavailable')
        const { pa, state } = powerAuthStub({ configuration: () => Promise.reject(error) })
        const sdk = await load(platform, async () => assert.fail('fetch should not run'))
        const service = new sdk.WPNNetworking(pa, { userAgent: 'test' })
        assert.equal(state.configurationReads, 0)
        await assert.rejects(service.call(sdk.WPNEndpoint.unsigned('/x'), payload, undefined), actual => actual === error)
    })

    test(`${platform}: converts configured date fields and leaves other strings unchanged`, async () => {
        const date = '2026-09-18T10:00:00Z'
        const sdk = await load(platform, async () => new Response(JSON.stringify({ status: 'OK', responseObject: { date, text: date } })))
        const service = new sdk.WPNNetworking({}, { baseURL: 'https://example.test', userAgent: 'test' })
        const result = await service.call(sdk.WPNEndpoint.unsigned('/x', new sdk.WPNResponseConfig(['date'])), payload)
        assert.equal(result.responseObject.date.toISOString(), date.replace('Z', '.000Z'))
        assert.equal(result.responseObject.text, date)
    })

    test(`${platform}: concurrent calls keep separate request resources`, async () => {
        const { pa, state } = powerAuthStub()
        const sdk = await load(platform, async () => new Response(responseBytes))
        const service = new sdk.WPNNetworking(pa, { baseURL: 'https://example.test', userAgent: 'test' })
        const endpoint = sdk.WPNEndpoint.signed('/x', '/uri', undefined, sdk.WPNE2EEConfiguration.ACTIVATION_SCOPE)
        await Promise.all([service.call(endpoint, payload, {}), service.call(endpoint, payload, {})])
        assert.equal(state.encryptors.length, 2)
        for (const encryptor of state.encryptors) assert.deepEqual(encryptor, { scope: 'activation', released: 1, encrypted: 1, decrypted: 1 })
    })

    test(`${platform}: sends JSON and binary HTTP bodies and maps server responses`, async () => {
        let received
        const server = createServer(async (req, res) => {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            received = { body: Buffer.concat(chunks), headers: req.headers, url: req.url, method: req.method }
            res.statusCode = req.url === '/error' ? 400 : 200
            res.end(req.url === '/bytes' ? responseBytes : req.url === '/error'
                ? '{"status":"ERROR","responseObject":{"code":"HTTP_ERROR","message":"Denied"}}' : ok)
        })
        server.listen(0, '127.0.0.1')
        await once(server, 'listening')
        try {
            const sdk = await load(platform, fetch)
            const { pa, state } = powerAuthStub()
            const requestInterceptors = [request => { request.headers.set('X-Correlation-ID', 'correlation'); return request }]
            const service = new sdk.WPNNetworking(pa, { baseURL: `http://127.0.0.1:${server.address().port}`, userAgent: 'test', requestInterceptors })
            const plain = await service.call(sdk.WPNEndpoint.unsigned('/json'), payload)
            assert.deepEqual(received.body, Buffer.from(JSON.stringify(payload)))
            assert.equal(received.method, 'POST')
            assert.equal(received.headers['content-type'], 'application/json')
            assert.equal(received.headers['accept-language'], 'en')
            assert.equal(received.headers['x-correlation-id'], 'correlation')
            assert.equal(JSON.stringify(plain.responseObject), JSON.stringify(payload))
            const error = await service.call(sdk.WPNEndpoint.unsigned('/error'), payload)
            assert.equal(error.status, 'ERROR')
            assert.equal(error.responseError.code, 'HTTP_ERROR')
            assert.equal(error.responseObject, undefined)
            const result = await service.call(sdk.WPNEndpoint.unsigned('/bytes', undefined, sdk.WPNE2EEConfiguration.APPLICATION_SCOPE), payload, undefined)
            assert.deepEqual(received.body, Buffer.from(encryptedBody))
            assert.equal(received.headers['x-powerauth-encryption'], 'application')
            assert.equal(received.headers['x-correlation-id'], 'correlation')
            assert.equal(received.url, '/bytes')
            assert.equal(JSON.stringify(result.responseObject), JSON.stringify(payload))
            assert.equal(state.encryptors[0].released, 1)
        } finally {
            server.closeAllConnections()
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        }
    })
}
