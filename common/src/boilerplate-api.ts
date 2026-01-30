import type { RestApi } from '@furystack/rest'
import type { User } from './models/index.js'

export type TestQueryEndpoint = { query: { param1: string }; result: { param1Value: string } }
export type TestUrlParamsEndpoint = { url: { urlParam: string }; result: { urlParamValue: string } }
export type TestPostBodyEndpoint = { body: { value: string }; result: { bodyValue: string } }

export interface BoilerplateApi extends RestApi {
  GET: {
    '/isAuthenticated': { result: { isAuthenticated: boolean } }
    '/currentUser': { result: User }
    '/testQuery': TestQueryEndpoint
    '/testUrlParams/:urlParam': TestUrlParamsEndpoint
  }
  POST: {
    '/login': { result: User; body: { username: string; password: string } }
    '/logout': { result: unknown }
    '/testPostBody': TestPostBodyEndpoint
  }
}
