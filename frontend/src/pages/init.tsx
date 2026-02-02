import { Shade, createComponent } from '@furystack/shades'
import { Loader } from '@furystack/shades-common-components'

export const Init = Shade({
  shadowDomName: 'shade-init',
  css: {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    '& .init-loader': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '& shades-loader': {
      width: '128px',
      height: '128px',
    },
  },
  render: () => (
    <div className="init-loader">
      <Loader />
      <h2>Initializing app...</h2>
    </div>
  ),
})
