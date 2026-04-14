import { useEffect, useState } from 'react'

type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g'

interface NetworkInformation extends EventTarget {
  effectiveType?: EffectiveType
  saveData?: boolean
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { connection?: NetworkInformation }
  return nav.connection ?? null
}

function computeIsSlow(conn: NetworkInformation | null): boolean {
  if (!conn) return false
  if (conn.saveData) return true
  const t = conn.effectiveType
  return t === 'slow-2g' || t === '2g' || t === '3g'
}

export function useSlowConnection() {
  const [state, setState] = useState(() => {
    const conn = getConnection()
    return {
      isSlow: computeIsSlow(conn),
      effectiveType: conn?.effectiveType ?? null,
    }
  })

  useEffect(() => {
    const conn = getConnection()
    if (!conn) return
    function update() {
      setState({
        isSlow: computeIsSlow(conn),
        effectiveType: conn?.effectiveType ?? null,
      })
    }
    conn.addEventListener('change', update)
    return () => conn.removeEventListener('change', update)
  }, [])

  return state
}
