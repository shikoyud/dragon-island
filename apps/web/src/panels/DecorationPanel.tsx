import { InfoDialog } from './InfoDialog'

/** A placed decoration's Info: Store, Sell (remove for a quarter of its price, two steps) and Turn; Move is on the row. */
export function DecorationPanel({ decorationId, onClose }: { decorationId: string; onClose?: () => void }) {
  return <InfoDialog target={{ type: 'decoration', id: decorationId }} onClose={onClose} />
}
