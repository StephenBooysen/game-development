/**
 * The games on the shelf.
 *
 * Only the launcher's worth of metadata lives here; the module itself is
 * fetched on demand, so opening the lobby doesn't parse a game you didn't pick.
 * Adding a third game is a directory and a line in this list.
 */
export const GAMES = [
  {
    id: 'harvest',
    slot: 'farm',
    legacyKeys: ['harvest-hollow:farm'],
    name: 'Harvest Hollow',
    icon: '🌾',
    theme: 'harvest',
    tagline: 'a little farm at the edge of the woods',
    blurb: 'Till the soil, sow the seeds, and watch four seasons turn over a valley plot.',
    bullets: [
      'Six crops and an orchard to plant',
      'Rain, storms and snow overhead',
      'A store that pays for better tools',
    ],
    load: () => import('./harvest/index.js').then((m) => m.HARVEST),
  },
  {
    id: 'lunar',
    slot: 'lunar',
    name: 'Mare Copernicus',
    icon: '🌘',
    theme: 'lunar',
    tagline: 'a one-operator mining claim on the near side',
    blurb: 'Survey the seams, sink your rigs, and keep them powered through a fortnight of night.',
    bullets: [
      'Six ores and two deep-core wells',
      'Dust storms, meteors and solar flares',
      'A depot that refits your suit',
    ],
    load: () => import('./lunar/index.js').then((m) => m.LUNAR),
  },
];
