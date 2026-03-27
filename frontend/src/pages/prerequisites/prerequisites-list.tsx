import { createComponent, Shade } from '@furystack/shades'
import { Icon, icons, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'

import { PrerequisiteTable } from '../../components/prerequisite-table.js'

type PrerequisitesListProps = {
  stackName: string
}

export const PrerequisitesList = Shade<PrerequisitesListProps>({
  customElementName: 'shade-prerequisites-list',
  render: ({ props }) => {
    return (
      <PageContainer>
        <PageHeader icon={<Icon icon={icons.check} />} title="Prerequisites" />
        <Paper>
          <PrerequisiteTable stackName={props.stackName} />
        </Paper>
      </PageContainer>
    )
  },
})
