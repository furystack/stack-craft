import type { ThemeProviderService } from '@furystack/shades-common-components'
import { describe, expect, it, vi } from 'vitest'

import { applyTheme, DEFAULT_THEME_KEY, THEME_STORAGE_KEY, themeEntries } from './theme-registry.js'

describe('theme-registry', () => {
  describe('constants', () => {
    it('should export THEME_STORAGE_KEY', () => {
      expect(THEME_STORAGE_KEY).toBe('stackcraft-theme')
    })

    it('should export DEFAULT_THEME_KEY', () => {
      expect(DEFAULT_THEME_KEY).toBe('dark')
    })
  })

  describe('themeEntries', () => {
    it('should include default dark and light themes', () => {
      const keys = themeEntries.map((e) => e.key)
      expect(keys).toContain('dark')
      expect(keys).toContain('light')
    })

    it('should have unique keys', () => {
      const keys = themeEntries.map((e) => e.key)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('should have a label and loader for every entry', () => {
      for (const entry of themeEntries) {
        expect(entry.label).toBeTruthy()
        expect(typeof entry.loader).toBe('function')
      }
    })

    it('should have dark and light as the first two entries', () => {
      expect(themeEntries[0].key).toBe('dark')
      expect(themeEntries[1].key).toBe('light')
    })

    it('should have quotes for special themes but not default themes', () => {
      const dark = themeEntries.find((e) => e.key === 'dark')
      const light = themeEntries.find((e) => e.key === 'light')
      expect(dark?.quote).toBeUndefined()
      expect(light?.quote).toBeUndefined()

      const special = themeEntries.filter((e) => e.key !== 'dark' && e.key !== 'light')
      for (const entry of special) {
        expect(entry.quote).toBeTruthy()
      }
    })
  })

  describe('applyTheme', () => {
    it('should call setAssignedTheme with the loaded theme for a valid key', async () => {
      const mockProvider = { setAssignedTheme: vi.fn() } as unknown as ThemeProviderService

      await applyTheme('dark', mockProvider)

      expect(mockProvider.setAssignedTheme).toHaveBeenCalledOnce()
      expect(mockProvider.setAssignedTheme).toHaveBeenCalledWith(expect.objectContaining({}))
    })

    it('should not call setAssignedTheme for an unknown key', async () => {
      const mockProvider = { setAssignedTheme: vi.fn() } as unknown as ThemeProviderService

      await applyTheme('nonexistent-theme', mockProvider)

      expect(mockProvider.setAssignedTheme).not.toHaveBeenCalled()
    })

    it('should load the light theme correctly', async () => {
      const mockProvider = { setAssignedTheme: vi.fn() } as unknown as ThemeProviderService

      await applyTheme('light', mockProvider)

      expect(mockProvider.setAssignedTheme).toHaveBeenCalledOnce()
    })
  })
})
