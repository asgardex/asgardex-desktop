import { useState } from 'react'
import { Cog8ToothIcon } from '@heroicons/react/20/solid'
import { ProviderModalContent } from './ProviderModalContent'

export const ProviderModal = () => {
  const [isModalOpen, setModalOpen] = useState(false)
  return (
    <div className="cursor-pointer" onClick={() => setModalOpen(true)}>
      <Cog8ToothIcon className="mr-2 h-4 w-4 text-text2 dark:text-text2d" />
      <ProviderModalContent open={isModalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
