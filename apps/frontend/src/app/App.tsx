import { Button } from '@/components/ui/button'
import type { FC, ReactNode } from 'react'

type AppProps = {
  children?: ReactNode
}

export const App: FC<AppProps> = () => {
  return (
    <div className='bg-background'>
      <Button>asdfasdf</Button>
    </div>
  )
}
