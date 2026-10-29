/** Turn / Confirm / Cancel while a building is being placed or moved. */
export function PlacementBar({ legal, pending, onTurn, onConfirm, onCancel }: {
  legal: boolean; pending?: boolean; onTurn: () => void; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="placement-bar" role="toolbar" aria-label="Placement">
      <button type="button" className="btn" onClick={onTurn}>Turn</button>
      <button type="button" className="btn btn--primary" disabled={!legal || pending} onClick={onConfirm}>Confirm</button>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      {!legal && <small>Can't build here</small>}
    </div>
  )
}
