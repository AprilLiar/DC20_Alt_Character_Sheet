export async function prepareBiography(actor) {
  const system = actor.system;

  return {
    biography:    system.details?.biography?.value ?? '',
    biographyRaw: system.details?.biography?.value ?? '',
    details:       system.details       ?? {},
    combatTraining: system.combatTraining ?? {},
    skillPoints:   system.skillPoints   ?? {},
    known:         system.known         ?? {},
  };
}
