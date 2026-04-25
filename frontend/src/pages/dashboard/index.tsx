import { useCollectionSync } from '../../services/entity-sync.js'
import { createComponent, Shade } from '@furystack/shades'

import { Loader, PageContainer } from '@furystack/shades-common-components'
import { StackDefinition } from 'common'

import { StackDashboard } from './stack-dashboard.js'
import { StackListDashboard } from './stack-list-dashboard.js'

type DashboardProps = {
  stackName?: string
}

export const Dashboard = Shade<DashboardProps>({
  customElementName: 'shade-dashboard',
  render: (options) => {
    const { props } = options

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

    if (!props.stackName) {
      return <StackListDashboard stacks={stacks} />
    }

    return <StackDashboard stackName={props.stackName} stacks={stacks} />
  },
})
