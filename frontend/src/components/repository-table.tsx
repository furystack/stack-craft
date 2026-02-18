import { createComponent, Shade } from '@furystack/shades'
import { Button } from '@furystack/shades-common-components'
import type { GitHubRepository } from 'common'

type RepositoryTableProps = {
  repositories: GitHubRepository[]
  onEdit: (repositoryId: string) => void
}

export const RepositoryTable = Shade<RepositoryTableProps>({
  shadowDomName: 'shade-repository-table',
  css: {
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
    },
    '& th, & td': {
      textAlign: 'left',
      padding: '10px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    '& th': {
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      opacity: '0.7',
    },
    '& tr:hover td': {
      background: 'rgba(255,255,255,0.03)',
    },
  },
  render: ({ props }) => {
    return (
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th>URL</th>
            <th style={{ width: '100px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {props.repositories.map((repo) => (
            <tr>
              <td>
                <strong>{repo.displayName}</strong>
                {repo.description ? (
                  <div style={{ fontSize: '12px', opacity: '0.6', marginTop: '2px' }}>{repo.description}</div>
                ) : null}
              </td>
              <td>
                <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{repo.url}</span>
              </td>
              <td>
                <Button variant="outlined" onclick={() => props.onEdit(repo.id)}>
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  },
})
