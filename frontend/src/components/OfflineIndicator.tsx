import { CloudOff, Wifi } from 'lucide-react'

type OfflineIndicatorProps = {
  isOnline: boolean
}

export function OfflineIndicator({ isOnline }: OfflineIndicatorProps) {
  return (
    <div className={`connection-status ${isOnline ? 'is-online' : 'is-offline'}`}>
      {isOnline ? <Wifi size={16} /> : <CloudOff size={16} />}
      <span>{isOnline ? 'Saved on this device' : 'Offline - changes saved locally'}</span>
    </div>
  )
}