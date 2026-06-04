import { createComponent, Shade } from '@furystack/shades'
import { Loader, PageContainer } from '@furystack/shades-common-components'

import { stackCraftReplace } from './app-routes.js'

type StackRedirectProps = {
  stackName: string
}

/**
 * Replaces the current location with the stack Services page. Used for legacy
 * `/stacks/:stackName` and `/stacks/:stackName/setup` routes.
 */
export const StackRedirect = Shade<StackRedirectProps>({
  customElementName: 'shade-stack-redirect',
  render: ({ props, injector, useDisposable }) => {
    useDisposable(
      'stack-redirect',
      () => {
        stackCraftReplace(injector, {
          path: '/stacks/:stackName/services',
          params: { stackName: props.stackName },
        })
        return { [Symbol.dispose]: () => {} }
      },
      [props.stackName],
    )

    return (
      <PageContainer>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <Loader />
        </div>
      </PageContainer>
    )
  },
})
