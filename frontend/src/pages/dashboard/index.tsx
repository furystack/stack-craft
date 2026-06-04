import { useCollectionSync } from '../../services/entity-sync.js'
import { createComponent, Shade } from '@furystack/shades'

import { Loader, PageContainer } from '@furystack/shades-common-components'
import { StackDefinition } from 'common'

import { StackListDashboard } from './stack-list-dashboard.js'

export const Dashboard = Shade({
  customElementName: 'shade-dashboard',
  render: (options) => {
    const stacksState = useCollectionSync(options, StackDefinition, {})
    const stacks = stacksState.status === 'synced' || stacksState.status === 'cached' ? stacksState.data.entries : []

    const isLoading = stacksState.status === 'connecting'

    if (isLoading) {
      return (
        <PageContainer>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader />
          </div>
        </PageContainer>
      )
    }

    return <StackListDashboard stacks={stacks} />
  },
})
