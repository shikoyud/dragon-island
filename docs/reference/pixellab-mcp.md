# PixelLab MCP — quick reference for Dragon Island art

Source: https://api.pixellab.ai/mcp/docs (read 2026-10-29). Items marked [summary] were summarised, so check the exact parameter names in the docs before calling. Setup: MCP server url `https://api.pixellab.ai/mcp`, transport `http`, header `Authorization: Bearer <token>` (shiko's token lives outside the repo; never commit it). Jobs are async: create_* returns an id, poll with the matching get_* (30 s to 5 min). Check `get_balance` first; keep ~25 generations of headroom.

## Which tool for what we need

| Need | Tool | Notes |
|---|---|---|
| Isometric ground tiles: grass, cliff edges, water, fog | `create_tiles_pro` with `tile_type="isometric"`, `tile_feature="tileset"` (transitions) [summary]; or `create_isometric_tile` for single blocks (`size` 16–64, `tile_shape` thin tile / thick tile / block) | No isometric Wang tool. Our cells are 16×8 diamonds: generate 32-px tiles and downscale, or request 16. Keep `outline`, `shading`, `detail`, palette identical across tiles. |
| Seamless top-down Wang terrain (if we ever need flat) | `create_topdown_tileset` (`lower_description`, `upper_description`, `transition_size` 0 / 0.25 / 0.5 / 1.0, `tile_size` 16/32) | Chain with `lower_base_tile_id` / `upper_base_tile_id` so edges match. |
| HUD: buttons, panels, resource pills, avatar frame, icon buttons | `create_ui_asset` (`elements`: button, icon_button, toolbar, tab, panel, window, health_bar, avatar; `width`/`height` 192–688; `no_background`; `palette_name`, `max_colors`) [summary] | 10 generations up to 256×256. Generate one sheet per element family with one palette. |
| Small icons (food, gold, $DRIS, XP, timer, build hammer, map) | `create_image_pro_flash` (`width`/`height` default 64, `no_background`, `style_image`, `seed`) or `create_image_pixflux` (16–400 px, `isometric`, `view`) | Pro Flash costs 5 up to 96 px. Pass a `style_image` of an existing asset for consistency. |
| Isometric buildings (habitats, shops, kits) | `create_8_direction_object` (`view="low top-down"`, 24–168 px, `style_object_id` for consistency) or `create_building_kit` (`wall_description`, `floor_description`, `tile_type="isometric"`, 32–96 px) [summary] | Existing habitats were made with create_map_object style prompts; reuse the same palette. |
| Island map icons and the world map | `create_map_object` (32–400 px, transparent, `view` high top-down) then `place_map_object` onto a map | Good for the six island icons and a sea/sky backdrop. |
| Dragons with rotations and animations | `create_character` (v3, `size` 16–256, `n_directions` 4/8, `view`, `reference_image_url` to rotate an existing sprite) then `animate_character` (`template_animation_id` e.g. breathing-idle, walking; `frame_count`) | No seed on create_character. Costs 2–9 per character (v3). |
| Fix a detail in an existing PNG | `inpaint_image` (32–512 px, mask rect or image; white = regenerate) | 10 generations up to 256². |

## Consistency rules
- Same `palette_name`/`max_colors`, `outline`, `shading`, `detail` and `view` on every call in a family.
- Prefer a reference over prompt words: `style_image`, `style_images`, `style_object_id`, `style_character_id`, `reference_image_url`, `use_color_palette_from_reference`.
- Use `image_url` rather than base64 above ~32 px (clients truncate base64).
- Seeds exist on most tools except `create_character`; record them in the art list.
- Downloads need no auth: `GET /mcp/tilesets/{id}/image` (`?inline=true`), 423 + Retry-After while generating.
- Results in "review" status: `select_object_frames` or `dismiss_review`.
