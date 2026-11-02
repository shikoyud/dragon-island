import { ELEMENTS, RARITIES } from '@wyrmhaven/game-core'
import { useEffect, useMemo, useState } from 'react'
import { FALLBACK_ART, loadActiveArt } from '../art/slots'
import type { GameArtSet } from '../art/types'
import { Stars } from '../hud/ArtMark'
import { HudArtContext, hudArtOf, Icon } from '../hud/Icon'
import { hudSkin } from '../hud/skin'
import { BackButton, CloseButton, HelpButton, PillButton, PriceTag, type PillColor } from '../ui/kit/buttons'
import { DialogFrame } from '../ui/kit/frames'
import { Bubble, ElementRibbon, KitCard, ProgressBar, RarityShield, ResourcePill, RoundAction, Tooltip } from '../ui/kit/pieces'

const COLORS: PillColor[] = ['blue', 'yellow', 'green', 'purple', 'grey', 'red']
const noop = () => {}

/** Every kit piece in every state (ruling P5): `#/kit`, for screenshots, the font check and review. */
export function KitGallery({ art: given }: { art?: GameArtSet }) {
  const [art, setArt] = useState<GameArtSet>(given ?? FALLBACK_ART)
  useEffect(() => { if (!given) void loadActiveArt().then(setArt) }, [given])
  const skin = useMemo(() => hudSkin(art.hud), [art])
  const hudArt = useMemo(() => hudArtOf(art), [art])
  return (
    <HudArtContext.Provider value={hudArt}>
      <div className={`kit-gallery ${skin.className}`} style={skin.style}>
        <section className="kit-gallery__row" aria-label="Pills">
          {COLORS.map(c => <PillButton key={c} color={c}>{c}</PillButton>)}
          <PillButton color="blue"><PriceTag amount={1_200} currency="gold" /></PillButton>
          <PillButton color="blue"><PriceTag amount={25_000} currency="gold" affordable={false} /></PillButton>
          <PillButton color="purple"><PriceTag amount={2_000_000} currency="usd" /></PillButton>
          <PillButton id="kit-up" color="yellow" disabled reason="Requires level 8">Upgrade</PillButton>
          <PillButton color="green" small>Claim</PillButton>
        </section>
        <section className="kit-gallery__row" aria-label="Square buttons">
          <CloseButton onClick={noop} /><BackButton onClick={noop} /><HelpButton onClick={noop} />
          <ResourcePill icon={<Icon name="dris" />} value="8" onPlus={noop} plusLabel="Deposit" />
          <ResourcePill icon={<Icon name="gold" />} value="1,800" onPlus={noop} plusLabel="Buy gold" />
          <ResourcePill icon={<Icon name="food" />} value="235" onPlus={noop} plusLabel="Buy food" />
        </section>
        <section className="kit-gallery__row kit-gallery__row--dark" aria-label="Round actions and bubbles">
          <RoundAction icon={<Icon name="food" size={32} />} label="Speed up" timer="6s" />
          <RoundAction icon={<Icon name="build" size={32} />} label="Upgrade" locked />
          <RoundAction icon={<Icon name="breed" size={32} />} label="Hatch" badge="New" />
          <RoundAction icon={<Icon name="map" size={32} />} label="Move" disabled />
          <Bubble icon={<Icon name="gold" size={28} />} label="Collect gold" onClick={noop} />
          <Bubble icon={<Icon name="xp" size={28} />} label="XP" />
          <span style={{ width: 160 }}><ProgressBar value={40} max={60} label="20s" name="Growing" /></span>
        </section>
        <section className="kit-gallery__row" aria-label="Ribbons, shields, stars, tooltip, toast">
          {ELEMENTS.map(e => <ElementRibbon key={e} element={e} />)}
          {RARITIES.map(r => <RarityShield key={r} rarity={r} />)}
          <Stars filled={3} total={5} />
          <Tooltip text="Gold from your habitats"><PillButton small>Hover me</PillButton></Tooltip>
          <div className="kit-toast kit-toast--info" role="status">Saved.</div>
          <div className="kit-toast kit-toast--error" role="alert">Not enough gold.</div>
        </section>
        <section className="kit-gallery__row" aria-label="Cards">
          <KitCard title="Terra Basic" elements={['terra']} rarity="common" art={<Icon name="dragons" size={48} />}
            footer={<PillButton><PriceTag amount={500} currency="gold" /></PillButton>} />
          <KitCard title="Lava Wyrm" elements={['flame', 'terra']} rarity="rare" art={<Icon name="dragons" size={48} />}
            footer={<PillButton><PriceTag amount={50_000} currency="gold" affordable={false} /></PillButton>} />
          <KitCard title="Sea Basic" elements={['sea']} rarity="uncommon" lockedLevel={12} art={<Icon name="dragons" size={48} />} />
        </section>
        <section className="kit-gallery__row kit-gallery__frames" aria-label="Frames">
          <div className="hud-dialog"><DialogFrame title="Flame Habitat level 1" badge="2/4" onClose={noop}><p>Max. dragons 2. Max. gold 5,000.</p></DialogFrame></div>
          <div className="hud-dialog kit-gallery__short">
            <DialogFrame title="A very long title that must truncate on the plank" onClose={noop}>
              {Array.from({ length: 30 }, (_, i) => <p key={i}>Row {i + 1}</p>)}
            </DialogFrame>
          </div>
        </section>
      </div>
    </HudArtContext.Provider>
  )
}
