import { getMimirStatus } from './useMimirHalt'

describe('hooks/useMimirHalt', () => {
  describe('getMimirStatus', () => {
    it('should return true when mimir = 1 (halt enabled)', () => {
      expect(getMimirStatus(1)).toBeTruthy()
    })

    it('should return false when mimir = 0 (no halt)', () => {
      expect(getMimirStatus(0)).toBeFalsy()
    })

    it('should return true when mimir >= 1 regardless of block height', () => {
      expect(getMimirStatus(99, 100)).toBeTruthy()
      expect(getMimirStatus(100, 100)).toBeTruthy()
      expect(getMimirStatus(101, 100)).toBeTruthy()
    })

    it('should return true when mimir > 0 and lastHeight = 0', () => {
      expect(getMimirStatus(10, 0)).toBeTruthy()
    })

    it('should return false when mimir and lastHeight are undefined', () => {
      expect(getMimirStatus(undefined, undefined)).toBeFalsy()
    })

    it('should return false when mimir is undefined with valid lastHeight', () => {
      expect(getMimirStatus(undefined, 100)).toBeFalsy()
    })

    it('should return false when mimir = 0 with valid lastHeight', () => {
      expect(getMimirStatus(0, 100)).toBeFalsy()
    })
  })
})
