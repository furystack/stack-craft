import type { FindOptions } from '@furystack/core'
import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import { Button, CollectionService, DataGrid, Icon, icons, Loader } from '@furystack/shades-common-components'
import { GitHubRepository } from 'common'

import { applyClientFindOptions } from '../utils/apply-client-find-options.js'
import { StackCraftNestedRouteLink } from './app-routes.js'

type RepositoryTableProps = {
  stackName: string
}

type RepositoryColumn = 'displayName' | 'url' | 'actions'

const columnFilters: { [K in RepositoryColumn]?: ColumnFilterConfig } = {
  displayName: { type: 'string' },
  url: { type: 'string' },
}

export const RepositoryTable = Shade<RepositoryTableProps>({
  customElementName: 'shade-repository-table',
  render: (options) => {
    const { props, useDisposable, useState } = options

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<GitHubRepository>({ searchField: 'displayName' }),
    )

    const [findOptions, setFindOptions] = useState<FindOptions<GitHubRepository, Array<keyof GitHubRepository>>>(
      'findOptionsObservable',
      { top: 25 },
    )

    const reposState = useCollectionSync(options, GitHubRepository, {
      filter: { stackName: { $eq: props.stackName } },
    })

    const isLoading = reposState.status === 'connecting'
    const allEntries = reposState.status === 'synced' || reposState.status === 'cached' ? reposState.data.entries : []

    const { entries, count } = applyClientFindOptions(allEntries, findOptions)
    collectionService.data.setValue({ entries, count })

    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <Loader />
        </div>
      )
    }

    return (
      <DataGrid<GitHubRepository, RepositoryColumn>
        columns={['displayName', 'url', 'actions']}
        findOptions={findOptions}
        onFindOptionsChange={setFindOptions}
        styles={undefined}
        collectionService={collectionService}
        columnFilters={columnFilters}
        headerComponents={{
          actions: () => <span style={{ paddingLeft: '1em' }}>Actions</span>,
        }}
        rowComponents={{
          displayName: (entry) => (
            <span>
              <strong>{entry.displayName}</strong>
              {entry.description ? (
                <div style={{ fontSize: '12px', opacity: '0.6', marginTop: '2px' }}>{entry.description}</div>
              ) : null}
            </span>
          ),
          url: (entry) => <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{entry.url}</span>,
          actions: (entry) => (
            <StackCraftNestedRouteLink href={`/repositories/:id`} params={{ id: entry.id }}>
              <Button variant="outlined" size="small" startIcon={<Icon icon={icons.edit} size="small" />}>
                Edit
              </Button>
            </StackCraftNestedRouteLink>
          ),
        }}
      />
    )
  },
})
