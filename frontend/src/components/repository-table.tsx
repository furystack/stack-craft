import type { FindOptions } from '@furystack/core'
import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, CollectionService, DataGrid } from '@furystack/shades-common-components'
import { ObservableValue } from '@furystack/utils'
import type { GitHubRepository } from 'common'

type RepositoryTableProps = {
  repositories: GitHubRepository[]
}

type RepositoryColumn = 'displayName' | 'url' | 'actions'

export const RepositoryTable = Shade<RepositoryTableProps>({
  shadowDomName: 'shade-repository-table',
  render: ({ props, useDisposable }) => {
    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<GitHubRepository>({ searchField: 'displayName' }),
    )

    const findOptions = useDisposable(
      'findOptions',
      () => new ObservableValue<FindOptions<GitHubRepository, Array<keyof GitHubRepository>>>({}),
    )

    collectionService.data.setValue({ entries: props.repositories, count: props.repositories.length })

    return (
      <DataGrid<GitHubRepository, RepositoryColumn>
        columns={['displayName', 'url', 'actions']}
        findOptions={findOptions}
        styles={undefined}
        collectionService={collectionService}
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
            <NestedRouteLink href={`/repositories/${entry.id}`}>
              <Button variant="outlined">Edit</Button>
            </NestedRouteLink>
          ),
        }}
      />
    )
  },
})
