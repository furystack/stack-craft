import { createComponent, Shade } from '@furystack/shades'
import { Button, Icon, icons, PageContainer, PageHeader } from '@furystack/shades-common-components'

import { StackCraftNestedRouteLink } from '../../components/app-routes.js'
import { RepositoryTable } from '../../components/repository-table.js'

type RepositoriesListProps = {
  stackName: string
}

export const RepositoriesList = Shade<RepositoriesListProps>({
  customElementName: 'shade-repositories-list',
  render: ({ props }) => {
    return (
      <PageContainer>
        <PageHeader
          icon={<Icon icon={icons.link} />}
          title="Repositories"
          actions={
            <StackCraftNestedRouteLink
              href="/stacks/:stackName/repositories/create"
              params={{ stackName: props.stackName }}
            >
              <Button variant="contained" size="small" startIcon={<Icon icon={icons.plus} size="small" />}>
                Add Repository
              </Button>
            </StackCraftNestedRouteLink>
          }
        />
        <RepositoryTable stackName={props.stackName} />
      </PageContainer>
    )
  },
})
