import { MODULE_ID } from '../constants.mjs';

export async function prepareBiography(actor) {
  const system = actor.system;
  const flags = actor.flags?.[MODULE_ID] ?? {};

  return {
    biography:       system.details?.biography?.value ?? '',
    details:         system.details ?? {},
    appearance:      flags.appearance ?? {},
    campaignNotes:   flags.campaignNotes ?? '',
    moduleId:        MODULE_ID,
  };
}
