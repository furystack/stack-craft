declare const __APP_SERVICE_PORT__: string

export const environmentOptions = {
  repository: 'http://github.com/furystack/stack-craft',
  serviceUrl: `http://localhost:${__APP_SERVICE_PORT__}/api`,
}
