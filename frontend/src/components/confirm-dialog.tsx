import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, Icon, icons, Paper } from '@furystack/shades-common-components'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = Shade<ConfirmDialogProps>({
  shadowDomName: 'shade-confirm-dialog',
  render: ({ props }) => {
    const confirmLabel = props.confirmLabel ?? 'Confirm'
    const cancelLabel = props.cancelLabel ?? 'Cancel'
    const isDanger = props.variant === 'danger'

    return (
      <div
        style={{
          position: 'fixed',
          inset: '0',
          zIndex: '10000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.6)',
        }}
        onclick={(ev) => {
          if (ev.target === ev.currentTarget) {
            props.onCancel()
          }
        }}
      >
        <Paper
          elevation={3}
          style={{
            padding: '24px',
            minWidth: '360px',
            maxWidth: '480px',
            borderRadius: '12px',
            background: cssVariableTheme.background.paper,
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>{props.title}</h3>
          <p style={{ margin: '0 0 24px 0', opacity: '0.8', fontSize: '14px', lineHeight: '1.5' }}>{props.message}</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="outlined" onclick={props.onCancel} startIcon={<Icon icon={icons.close} size="small" />}>
              {cancelLabel}
            </Button>
            <Button
              variant="contained"
              color={isDanger ? 'error' : 'primary'}
              onclick={props.onConfirm}
              startIcon={<Icon icon={isDanger ? icons.trash : icons.check} size="small" />}
            >
              {confirmLabel}
            </Button>
          </div>
        </Paper>
      </div>
    )
  },
})
