import { createComponent, Shade } from '@furystack/shades'
import type { WizardStepProps } from '@furystack/shades-common-components'
import { Button, Icon, icons } from '@furystack/shades-common-components'

export const WizardStep = Shade<{ title: string } & WizardStepProps>({
  shadowDomName: 'shade-wizard-step',
  render: ({ props, children }) => {
    const isLastPage = props.currentPage === props.maxPages - 1

    return (
      <div
        style={{
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          height: '430px',
          width: '600px',
          maxWidth: 'calc(100vw - 64px)',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: '0 0 16px 0' }}>{props.title}</h1>
        <div style={{ flexGrow: '1', overflow: 'auto', padding: '0 2px' }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px' }}>
          <Button
            onclick={() => props.onPrev?.()}
            disabled={props.currentPage < 1}
            variant="outlined"
            startIcon={<Icon icon={icons.chevronLeft} size="small" />}
          >
            Previous
          </Button>
          <Button
            onclick={() => props.onNext?.()}
            disabled={props.currentPage > props.maxPages - 1}
            variant="contained"
            color={isLastPage ? 'success' : 'primary'}
            startIcon={isLastPage ? <Icon icon={icons.check} size="small" /> : undefined}
            endIcon={isLastPage ? undefined : <Icon icon={icons.chevronRight} size="small" />}
          >
            {isLastPage ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    )
  },
})
