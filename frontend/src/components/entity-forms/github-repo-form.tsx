import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Input } from '@furystack/shades-common-components'
import type { GitHubRepository } from 'common'

type GitHubRepoFormProps = {
  initial?: Partial<GitHubRepository>
  stackName: string
  onSubmit: (data: Partial<GitHubRepository>) => void | Promise<void>
  onCancel?: () => void
  cancelHref?: string
  mode: 'create' | 'edit'
}

export const GitHubRepoForm = Shade<GitHubRepoFormProps>({
  shadowDomName: 'shade-github-repo-form',
  render: ({ props }) => {
    return (
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
        onsubmit={async (ev) => {
          ev.preventDefault()
          const formData = new FormData(ev.target as HTMLFormElement)
          const data = Object.fromEntries(formData.entries()) as Record<string, string>
          await props.onSubmit({
            stackName: props.stackName,
            url: data.url,
            displayName: data.displayName,
            description: data.description,
          })
        }}
      >
        <h2 style={{ margin: '0' }}>{props.mode === 'create' ? 'Add GitHub Repository' : 'Edit Repository'}</h2>
        <Input
          name="url"
          labelTitle="Repository URL"
          variant="outlined"
          required
          value={props.initial?.url ?? ''}
          getHelperText={() => 'Full GitHub URL, e.g. https://github.com/org/repo'}
        />
        <Input
          name="displayName"
          labelTitle="Display Name"
          variant="outlined"
          required
          value={props.initial?.displayName ?? ''}
        />
        <Input
          name="description"
          labelTitle="Description"
          variant="outlined"
          value={props.initial?.description ?? ''}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {props.cancelHref ? (
            <NestedRouteLink href={props.cancelHref}>
              <Button variant="outlined">Cancel</Button>
            </NestedRouteLink>
          ) : (
            <Button variant="outlined" onclick={props.onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="contained">
            {props.mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </div>
      </form>
    )
  },
})
