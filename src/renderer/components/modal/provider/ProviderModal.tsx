import { useState } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { Cog8ToothIcon } from '@heroicons/react/20/solid'
import { ProviderModalContent } from './ProviderModalContent'

export type ProviderModalProps = {
  midgardStatusRD: RD.RemoteData<Error, boolean>
  midgardStatusMayaRD: RD.RemoteData<Error, boolean>
}

export const ProviderModal = ({ midgardStatusRD, midgardStatusMayaRD }: ProviderModalProps) => {
  const [isModalOpen, setModalOpen] = useState(false)
  return (
    <div className="cursor-pointer" onClick={() => setModalOpen(true)}>
      <Cog8ToothIcon className="mr-2 h-4 w-4 text-text2 dark:text-text2d" />
      <ProviderModalContent
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        midgardStatusRD={midgardStatusRD}
        midgardStatusMayaRD={midgardStatusMayaRD}
      />
    </div>
  )
}
