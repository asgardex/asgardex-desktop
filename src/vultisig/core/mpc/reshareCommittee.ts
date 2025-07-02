type CombineReshareCommitteeInput = {
  keygenCommittee: string[]
  oldKeygenCommittee: string[]
}
export const combineReshareCommittee = ({ keygenCommittee, oldKeygenCommittee }: CombineReshareCommitteeInput) => {
  const allCommittee = Array.from(new Set([...keygenCommittee, ...oldKeygenCommittee]))

  const newCommitteeIdx: number[] = []
  const oldCommitteeIdx: number[] = []

  for (const [idx, key] of allCommittee.entries()) {
    if (oldKeygenCommittee.includes(key)) {
      oldCommitteeIdx.push(idx)
    }
    if (keygenCommittee.includes(key)) {
      newCommitteeIdx.push(idx)
    }
  }
  return {
    allCommittee,
    newCommitteeIdx,
    oldCommitteeIdx
  }
}
