import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme, Icon, icons, PageContainer, PageHeader, Paper } from '@furystack/shades-common-components'

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
        <p
          style={{
            margin: '0 0 16px',
            color: cssVariableTheme.text.secondary,
            fontSize: cssVariableTheme.typography.fontSize.md,
          }}
        >
          Prerequisites define system requirements that must be satisfied before services can run. They check for tools,
          environment variables, and other dependencies.
        </p>
        <Paper>
          <PrerequisiteTable stackName={props.stackName} />
        </Paper>
      </PageContainer>
    )
  },
})
