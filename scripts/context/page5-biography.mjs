export async function prepareBiography(actor) {
  const system = actor.system;

  const biography = await TextEditor.enrichHTML(
    system.details?.biography?.value ?? '',
    { relativeTo: actor, secrets: actor.isOwner },
  );

  return {
    biography,
    biographyRaw:  system.details?.biography?.value ?? '',
    details:       system.details       ?? {},
    combatTraining: system.combatTraining ?? {},
    skillPoints:   system.skillPoints   ?? {},
    known:         system.known         ?? {},
  };
}
