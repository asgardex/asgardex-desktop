import { Label } from '../label'

export type Props = {
  title: string
  children: React.ReactNode
}

export const PoolShareCard = ({ title, children }: Props) => {
  return (
    <div className="border border-solid border-gray0 dark:border-gray0d rounded-lg bg-bg1 dark:bg-bg1d p-4">
      <Label className="text-[16px] px-4 pb-4" align="center" textTransform="uppercase" weight="bold">
        {title}
      </Label>
      <div>{children}</div>
    </div>
  )
}
