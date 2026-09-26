import { forwardRef } from 'react'
import QuickBitePanel from './quickbite/QuickBitePanel.jsx'
const CommerceSidebar = forwardRef(function CommerceSidebar(props, ref) {
  return <QuickBitePanel ref={ref} {...props} />
})
export default CommerceSidebar
