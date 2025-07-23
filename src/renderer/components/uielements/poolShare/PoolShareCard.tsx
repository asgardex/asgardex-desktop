import { Label } from '../label'

export type Props = {
  title: string
  children: React.ReactNode
}

export const PoolShareCard = ({ title, children }: Props) => {
  return (
    <div className="bg-bg1 dark:bg-bg1d p-4">
      <Label className="text-[16px] px-4 pb-4" align="center" textTransform="uppercase" weight="bold">
        {title}
      </Label>
      <div className="rounded-lg border border-solid border-bg2 dark:border-bg2d">{children}</div>
    </div>
  )
}
