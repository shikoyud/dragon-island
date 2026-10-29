# Dragon Island base-building art list

For the art thread to generate with PixelLab. Style: 3/4 top-down pixel art, same palette and 1 px dark outline as the v1 set. Grid cell = 16 px, so a building is `footprint x 16` px wide at most; sizes below are the sprite canvas (bottom-centre sits on the footprint's bottom edge). Draw the **front view only**: facings 0 and 2 show it, 1 and 3 mirror it in code (spec section 2). Transparent background. Every entry is original; do not base designs on other games.

Manifest keys go in `apps/web/public/art/<version>/manifest.json`; until a key exists the game draws a coloured box of the footprint size. 42 distinct assets are listed; plan roughly 60 generations to allow for retries.


## Habitats (re-cut at 80x64, 5x5 cells, 9)

| Manifest key | File | Size (px) | Description |
|---|---|---|---|
| `habitat.fire` | `habitat-fire.png` | 80x64 | Fire habitat: stone platform with embers and a red-orange glow |
| `habitat.water` | `habitat-water.png` | 80x64 | Water habitat: stone platform with blue pool and wave-carved stone |
| `habitat.earth` | `habitat-earth.png` | 80x64 | Earth habitat: stone platform with packed clay terraces and boulders |
| `habitat.nature` | `habitat-nature.png` | 80x64 | Nature habitat: stone platform with leafy canopy and vine-wrapped posts |
| `habitat.electric` | `habitat-electric.png` | 80x64 | Electric habitat: stone platform with copper coils and yellow sparks |
| `habitat.ice` | `habitat-ice.png` | 80x64 | Ice habitat: stone platform with pale frosted stone and icicles |
| `habitat.metal` | `habitat-metal.png` | 80x64 | Metal habitat: stone platform with riveted steel plates and a forge vent |
| `habitat.dark` | `habitat-dark.png` | 80x64 | Dark habitat: stone platform with purple-black stone and violet runes |
| `habitat.light` | `habitat-light.png` | 80x64 | Light habitat: stone platform with white marble and a gold sunburst |

## Buildings (5)

| Manifest key | File | Size (px) | Description |
|---|---|---|---|
| `building.nexus` | `nexus.png` | 80x64 | Nexus habitat: platform ringed by nine small element pillars around a prismatic crystal |
| `building.hatchery` | `hatchery.png` | 64x64 | Hatchery: stone hall with a domed roof and four warm-lit egg niches |
| `building.hoard` | `hoard.png` | 64x64 | Hoard: heap of gold coins and gems spilling from an iron-banded chest |
| `building.nest` | `nest.png` | 32x32 | Nest: bowl of woven twigs lined with soft down |
| `building.farmPlot` | `farm-plot.png` | 32x32 | Farm plot: tilled soil bed with a wooden border and a stake marker |

## Decorations (15)

| Manifest key | File | Size (px) | Description |
|---|---|---|---|
| `decoration.stonePath` | `decoration-stonePath.png` | 16x16 | Short run of flat grey stepping stones with moss in the gaps |
| `decoration.picketFence` | `decoration-picketFence.png` | 16x16 | Two weathered wooden fence posts joined by a rail |
| `decoration.flowerPatch` | `decoration-flowerPatch.png` | 16x16 | Small tuft of mixed wildflowers in red, yellow and white |
| `decoration.emberLantern` | `decoration-emberLantern.png` | 16x16 | Iron post holding a glass lantern with a warm orange glow |
| `decoration.driftwoodBench` | `decoration-driftwoodBench.png` | 32x32 | Bleached driftwood plank bench on two stumps |
| `decoration.hayCart` | `decoration-hayCart.png` | 32x32 | Wooden two-wheel cart piled with golden hay |
| `decoration.shellFountain` | `decoration-shellFountain.png` | 32x32 | Stone basin topped with a large spiral shell spilling water |
| `decoration.crystalCluster` | `decoration-crystalCluster.png` | 32x32 | Cluster of tall blue-violet crystals with pale highlights |
| `decoration.eggTotem` | `decoration-eggTotem.png` | 32x32 | Carved wooden pole stacked with three painted eggs |
| `decoration.moonwell` | `decoration-moonwell.png` | 48x48 | Round stone well with a silver pool reflecting a crescent |
| `decoration.boneArch` | `decoration-boneArch.png` | 48x48 | Gateway arch made of two huge curved ivory ribs |
| `decoration.skyShrine` | `decoration-skyShrine.png` | 48x48 | Small open pavilion with cloud-pattern roof and hanging chimes |
| `decoration.dawnObelisk` | `decoration-dawnObelisk.png` | 32x32 | Slender gold-veined black stone obelisk with a sunrise glyph |
| `decoration.starPool` | `decoration-starPool.png` | 48x48 | Circular pool of dark water scattered with floating star lights |
| `decoration.dragonColossus` | `decoration-dragonColossus.png` | 48x48 | Giant weathered stone statue of a coiled dragon, wings half open |

## Obstacles (5)

| Manifest key | File | Size (px) | Description |
|---|---|---|---|
| `obstacle.bush` | `obstacle-bush.png` | 16x16 | Overgrown thorny bush blocking the cell |
| `obstacle.rock` | `obstacle-rock.png` | 16x16 | Rounded grey rock with a flat lichen patch |
| `obstacle.tree` | `obstacle-tree.png` | 32x32 | Gnarled dead-looking tree with tangled roots |
| `obstacle.boulder` | `obstacle-boulder.png` | 32x32 | Large cracked boulder with moss on top |
| `obstacle.ruin` | `obstacle-ruin.png` | 48x48 | Crumbled stone ruin with broken columns and creeping vines |

## Island tiles and sign (2)

| Manifest key | File | Size (px) | Description |
|---|---|---|---|
| `island.locked` | `island-locked.png` | 16x16 | One cell of locked land: dark fogged ground tile with a faint padlock mark |
| `island.sign` | `island-sign.png` | 32x32 | Expansion sign: wooden board on a post with a plus-shaped gold emblem |

## Island map icons (6)

| Manifest key | File | Size (px) | Description |
|---|---|---|---|
| `map.home` | `map-home.png` | 32x32 | Green island with a small hut |
| `map.isle2` | `map-isle2.png` | 32x32 | Small island with a single palm tree |
| `map.isle3` | `map-isle3.png` | 32x32 | Rocky island with a waterfall |
| `map.isle4` | `map-isle4.png` | 32x32 | Island with a tall stone spire |
| `map.isle5` | `map-isle5.png` | 32x32 | Island crowned with storm clouds |
| `map.dawnspire` | `map-dawnspire.png` | 32x32 | Floating island with a golden peak and rising sun |
