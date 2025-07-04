import { useState } from 'react'
import { FlatButton } from '../../../components/uielements/button'
import { Input } from '../../../components/uielements/input/Input'
import { Label } from '../../../components/uielements/label'

type DecryptVaultViewProps = {
  isPending: boolean
  error: Error | null
  onSubmit: (password: string) => void
}

export const DecryptVaultView = ({ isPending, error, onSubmit }: DecryptVaultViewProps) => {
  const [password, setPassword] = useState('')

  return (
    <form onSubmit={() => onSubmit(password)}>
      <Label size="large">Password</Label>

      <Input
        className="mt-4"
        placeholder="Enter Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="mt-4">
        <FlatButton loading={isPending} type="submit">
          Continue
        </FlatButton>
        {error?.message && <Label color="error">{error.message}</Label>}
      </div>
    </form>
  )
}
