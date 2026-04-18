import { useState, useEffect } from 'react'
import type { UpdateInfo } from 'electron-updater'

interface UpdateState {
  currentVersion: string
  newVersion: string | null
  updateAvailable: boolean
  isDownloading: boolean
  downloadProgress: number
  isDownloaded: boolean
  error: string | null
  releaseNotes: string | null
}

export function useAutoUpdate() {
  const [state, setState] = useState<UpdateState>({
    currentVersion: '',
    newVersion: null,
    updateAvailable: false,
    isDownloading: false,
    downloadProgress: 0,
    isDownloaded: false,
    error: null,
    releaseNotes: null,
  })

  useEffect(() => {
    // Get current version
    const getVersion = async () => {
      try {
        const version = await window.electronAPI?.app?.version?.()
        setState(s => ({ ...s, currentVersion: version || 'unknown' }))
      } catch (err) {
        console.error('Error getting version:', err)
      }
    }

    getVersion()

    // Listen for update events
    const unsubscribes: Array<() => void> = []

    // Update available
    const unsubUpdate = window.electronAPI?.on?.('update:available', (info) => {
      console.log('Update available:', info)
      setState(s => ({
        ...s,
        newVersion: info.version,
        updateAvailable: true,
        releaseNotes: info.releaseNotes,
      }))
    })
    if (unsubUpdate) unsubscribes.push(unsubUpdate)

    // Update downloaded
    const unsubDownloaded = window.electronAPI?.on?.('update:downloaded', () => {
      console.log('Update downloaded')
      setState(s => ({ ...s, isDownloaded: true, isDownloading: false }))
    })
    if (unsubDownloaded) unsubscribes.push(unsubDownloaded)

    // Download progress
    const unsubProgress = window.electronAPI?.on?.('update:progress', (progress) => {
      setState(s => ({
        ...s,
        isDownloading: true,
        downloadProgress: progress.percent || 0,
      }))
    })
    if (unsubProgress) unsubscribes.push(unsubProgress)

    // Error
    const unsubError = window.electronAPI?.on?.('update:error', (error) => {
      console.error('Update error:', error)
      setState(s => ({ ...s, error, isDownloading: false }))
    })
    if (unsubError) unsubscribes.push(unsubError)

    return () => {
      unsubscribes.forEach(unsub => {
        if (typeof unsub === 'function') unsub()
      })
    }
  }, [])

  const checkForUpdates = async () => {
    try {
      setState(s => ({ ...s, error: null }))
      await window.electronAPI?.update?.check?.()
    } catch (err: any) {
      setState(s => ({ ...s, error: err.message || 'Failed to check for updates' }))
    }
  }

  const downloadUpdate = async () => {
    try {
      setState(s => ({ ...s, error: null, isDownloading: true }))
      await window.electronAPI?.update?.download?.()
    } catch (err: any) {
      setState(s => ({ ...s, error: err.message || 'Failed to download update', isDownloading: false }))
    }
  }

  const installUpdate = async () => {
    try {
      await window.electronAPI?.update?.install?.()
    } catch (err: any) {
      setState(s => ({ ...s, error: err.message || 'Failed to install update' }))
    }
  }

  return {
    ...state,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  }
}
