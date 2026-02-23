import { createComponent, NestedRouteLink, Shade } from '@furystack/shades'
import { Button, Form, Icon, icons, Input, MarkdownInput } from '@furystack/shades-common-components'
import type { GitHubRepository } from 'common'

type GitHubRepoFormPayload = {
  url: string
  displayName: string
  description: string
}

const isGitHubRepoFormPayload = (data: unknown): data is GitHubRepoFormPayload => {
  const d = data as GitHubRepoFormPayload
  return d.url?.length > 0 && d.displayName?.length > 0
}

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
      <Form<GitHubRepoFormPayload>
        validate={isGitHubRepoFormPayload}
        onSubmit={(data) =>
          props.onSubmit({
            stackName: props.stackName,
            url: data.url,
            displayName: data.displayName,
            description: data.description,
          })
        }
        disableOnSubmit
        style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}
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
        <MarkdownInput
          name="description"
          labelTitle="Description"
          value={props.initial?.description ?? ''}
          rows={4}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {props.cancelHref ? (
            <NestedRouteLink href={props.cancelHref}>
              <Button variant="outlined" startIcon={<Icon icon={icons.close} size="small" />}>
                Cancel
              </Button>
            </NestedRouteLink>
          ) : (
            <Button variant="outlined" onclick={props.onCancel} startIcon={<Icon icon={icons.close} size="small" />}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            startIcon={<Icon icon={props.mode === 'create' ? icons.plus : icons.save} size="small" />}
          >
            {props.mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </div>
      </Form>
    )
  },
})
