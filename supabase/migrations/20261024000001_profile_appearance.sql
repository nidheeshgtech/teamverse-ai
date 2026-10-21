-- =============================================================================
-- Profile appearance for the 3D office: which figure represents you at your desk.
-- NULL = a stable default chosen from your account id (never inferred from your
-- name). The list mirrors CHARACTERS in src/components/office/scene/assets.ts.
-- Profile photos already live in the private `avatars` bucket (profiles.avatar_url).
-- =============================================================================
alter table public.profiles
  add column avatar_character text
  check (avatar_character is null or avatar_character in (
    'character-female-a', 'character-male-a', 'character-female-b', 'character-male-b',
    'character-female-c', 'character-male-c', 'character-female-d', 'character-male-d',
    'character-female-e', 'character-male-e', 'character-female-f', 'character-male-f'
  ));

grant update (avatar_character) on public.profiles to authenticated;
