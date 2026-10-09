import type { CareProfile } from './types';

/**
 * Built-in care profiles for common garden plants. Months fit a temperate northern
 * garden (roughly Scandinavia to the UK); the rules shift them for the south. Plants
 * that aren't here get a profile from Gemma, which you review before saving.
 */
const PROFILES: CareProfile[] = [
  // Fruit trees
  {
    id: 'apple', name: 'Apple', kind: 'tree', waterEveryDays: 14, frostHardyTo: -35,
    months: { prune: [1, 2, 3], feed: [4], mulch: [4], harvest: [8, 9, 10] },
    tips: { prune: 'Prune while dormant: open up the middle and take out crossing branches.' },
  },
  {
    id: 'pear', name: 'Pear', kind: 'tree', waterEveryDays: 14, frostHardyTo: -30,
    months: { prune: [1, 2, 3], feed: [4], mulch: [4], harvest: [8, 9, 10] },
    tips: { harvest: 'Pick pears while firm and let them ripen indoors.' },
  },
  {
    id: 'plum', name: 'Plum', kind: 'tree', waterEveryDays: 14, frostHardyTo: -30,
    months: { prune: [6, 7], feed: [4], harvest: [8, 9] },
    tips: { prune: 'Prune plums in summer, never in winter, to avoid silver leaf.' },
  },
  {
    id: 'cherry', name: 'Cherry', kind: 'tree', waterEveryDays: 14, frostHardyTo: -30,
    months: { prune: [7, 8], feed: [4], harvest: [6, 7, 8] },
    tips: { prune: 'Prune cherries after harvest, while it is dry and warm.' },
  },
  {
    id: 'fig', name: 'Fig', kind: 'tree', waterEveryDays: 7, frostHardyTo: -10,
    months: { prune: [4], feed: [5, 6, 7], harvest: [8, 9] },
  },
  {
    id: 'grape', name: 'Grape vine', kind: 'bush', waterEveryDays: 14, frostHardyTo: -20,
    months: { prune: [12, 1], feed: [4], harvest: [9, 10] },
    tips: { prune: 'Prune vines in deep winter; later cuts bleed sap.' },
  },

  // Berries
  {
    id: 'highbush-blueberry', name: 'Highbush blueberry', kind: 'bush', waterEveryDays: 3, frostHardyTo: -30,
    months: { prune: [2, 3], feed: [4, 5], mulch: [5], harvest: [7, 8, 9] },
    tips: {
      feed: 'Use an ericaceous (acid) feed, and rainwater if you can.',
      mulch: 'Mulch with pine needles or bark to keep the soil acid and moist.',
    },
  },
  {
    id: 'blackcurrant', name: 'Blackcurrant', kind: 'bush', waterEveryDays: 7, frostHardyTo: -35,
    months: { prune: [11, 12, 1, 2], feed: [3], mulch: [3], harvest: [7] },
    tips: { prune: 'Cut a third of the oldest stems to the ground.' },
  },
  {
    id: 'redcurrant', name: 'Redcurrant', kind: 'bush', waterEveryDays: 7, frostHardyTo: -35,
    months: { prune: [11, 12, 1, 2], feed: [3], mulch: [3], harvest: [7, 8] },
    tips: { prune: 'Shorten side shoots to a couple of buds and keep an open goblet shape.' },
  },
  {
    id: 'gooseberry', name: 'Gooseberry', kind: 'bush', waterEveryDays: 7, frostHardyTo: -35,
    months: { prune: [11, 12, 1, 2], feed: [3], mulch: [3], harvest: [6, 7] },
  },
  {
    id: 'raspberry', name: 'Raspberry', kind: 'bush', waterEveryDays: 5, frostHardyTo: -30,
    months: { prune: [8], feed: [3], mulch: [4], harvest: [7, 8, 9] },
    tips: { prune: 'Cut the canes that fruited this year down to the ground.' },
  },
  {
    id: 'strawberry', name: 'Strawberry', kind: 'perennial', waterEveryDays: 3, frostHardyTo: -15,
    months: { feed: [3], mulch: [5], harvest: [6, 7] },
    tips: { mulch: 'Tuck straw under the plants so the berries stay clean.' },
  },
  {
    id: 'rhubarb', name: 'Rhubarb', kind: 'perennial', waterEveryDays: 7, frostHardyTo: -30,
    months: { feed: [3], mulch: [11], harvest: [4, 5, 6] },
    tips: { harvest: 'Pull stalks rather than cutting them, and stop by midsummer.' },
  },

  // Ornamentals
  {
    id: 'rose', name: 'Rose', kind: 'bush', waterEveryDays: 7, frostHardyTo: -20,
    months: { prune: [3, 4], feed: [4, 6], mulch: [4] },
  },
  {
    id: 'hydrangea', name: 'Hydrangea', kind: 'bush', waterEveryDays: 3, frostHardyTo: -20,
    months: { prune: [3], mulch: [4] },
  },
  {
    id: 'lavender', name: 'Lavender', kind: 'bush', waterEveryDays: 21, frostHardyTo: -15,
    months: { prune: [8] },
    tips: { prune: 'Trim after flowering, but never back into bare wood.' },
  },

  // Greenhouse and warm-season crops
  {
    id: 'tomato', name: 'Tomato', kind: 'vegetable', waterEveryDays: 2, frostHardyTo: 3,
    months: { sow: [3], feed: [6, 7, 8], harvest: [7, 8, 9] },
    tips: { feed: 'Give tomato feed weekly once the first fruits set.' },
  },
  {
    id: 'cucumber', name: 'Cucumber', kind: 'vegetable', waterEveryDays: 1, frostHardyTo: 5,
    months: { sow: [4], feed: [6, 7, 8], harvest: [7, 8, 9] },
  },
  {
    id: 'chili', name: 'Chili', kind: 'vegetable', waterEveryDays: 3, frostHardyTo: 5,
    months: { sow: [2], feed: [6, 7, 8], harvest: [8, 9] },
    tips: { sow: 'Chilies are slow; sow them early, somewhere warm.' },
  },
  {
    id: 'squash', name: 'Squash', kind: 'vegetable', waterEveryDays: 3, frostHardyTo: 3,
    months: { sow: [4, 5], feed: [7, 8], harvest: [8, 9, 10] },
  },
  {
    id: 'bean', name: 'Runner bean', kind: 'vegetable', waterEveryDays: 4, frostHardyTo: 3,
    months: { sow: [5, 6], harvest: [7, 8, 9] },
  },
  {
    id: 'basil', name: 'Basil', kind: 'herb', waterEveryDays: 2, frostHardyTo: 5,
    months: { sow: [4, 5], harvest: [6, 7, 8, 9] },
  },

  // Vegetables
  {
    id: 'potato', name: 'Potato', kind: 'vegetable', waterEveryDays: 5, frostHardyTo: 0,
    months: { sow: [4, 5], harvest: [7, 8, 9] },
    tips: { sow: 'Plant seed potatoes once the soil has warmed up.' },
  },
  {
    id: 'pea', name: 'Pea', kind: 'vegetable', waterEveryDays: 4, frostHardyTo: -4,
    months: { sow: [4, 5, 6], harvest: [6, 7, 8] },
  },
  {
    id: 'cabbage', name: 'Cabbage', kind: 'vegetable', waterEveryDays: 4, frostHardyTo: -8,
    months: { sow: [3, 4], feed: [6], harvest: [7, 8, 9, 10] },
  },
  {
    id: 'broccoli', name: 'Broccoli', kind: 'vegetable', waterEveryDays: 4, frostHardyTo: -6,
    months: { sow: [4, 5], harvest: [7, 8, 9] },
    tips: { harvest: 'Cut the main head while tight; side shoots follow.' },
  },
  {
    id: 'kale', name: 'Kale', kind: 'vegetable', waterEveryDays: 5, frostHardyTo: -15,
    months: { sow: [4, 5, 6], harvest: [9, 10, 11, 12] },
    tips: { harvest: 'Kale gets sweeter after a frost.' },
  },
  {
    id: 'lettuce', name: 'Lettuce', kind: 'vegetable', waterEveryDays: 2, frostHardyTo: -3,
    months: { sow: [3, 4, 5, 6, 7, 8], harvest: [5, 6, 7, 8, 9] },
  },
  {
    id: 'spinach', name: 'Spinach', kind: 'vegetable', waterEveryDays: 3, frostHardyTo: -8,
    months: { sow: [4, 5, 8, 9], harvest: [5, 6, 9, 10] },
  },
  {
    id: 'radish', name: 'Radish', kind: 'vegetable', waterEveryDays: 2, frostHardyTo: -3,
    months: { sow: [4, 5, 6, 7, 8], harvest: [5, 6, 7, 8, 9] },
    tips: { sow: 'Sow a short row every two weeks for a steady supply.' },
  },
  {
    id: 'carrot', name: 'Carrot', kind: 'vegetable', waterEveryDays: 5, frostHardyTo: -5,
    months: { sow: [4, 5, 6], harvest: [7, 8, 9, 10] },
  },
  {
    id: 'beetroot', name: 'Beetroot', kind: 'vegetable', waterEveryDays: 5, frostHardyTo: -3,
    months: { sow: [4, 5, 6, 7], harvest: [7, 8, 9, 10] },
  },
  {
    id: 'onion', name: 'Onion', kind: 'vegetable', waterEveryDays: 7, frostHardyTo: -10,
    months: { sow: [4], harvest: [8] },
    tips: { harvest: 'Lift once the tops flop over, and dry them in the sun.' },
  },
  {
    id: 'garlic', name: 'Garlic', kind: 'vegetable', waterEveryDays: 10, frostHardyTo: -15,
    months: { sow: [10, 11], harvest: [7] },
    tips: { sow: 'Plant cloves in autumn; they need the cold to split.' },
  },
  {
    id: 'leek', name: 'Leek', kind: 'vegetable', waterEveryDays: 5, frostHardyTo: -12,
    months: { sow: [3, 4], harvest: [9, 10, 11, 12] },
  },

  // Herbs
  {
    id: 'parsley', name: 'Parsley', kind: 'herb', waterEveryDays: 3, frostHardyTo: -8,
    months: { sow: [4, 5], harvest: [6, 7, 8, 9, 10] },
  },
  {
    id: 'chives', name: 'Chives', kind: 'herb', waterEveryDays: 4, frostHardyTo: -30,
    months: { harvest: [5, 6, 7, 8, 9] },
  },
  {
    id: 'mint', name: 'Mint', kind: 'herb', waterEveryDays: 3, frostHardyTo: -25,
    months: { harvest: [5, 6, 7, 8, 9] },
  },
  {
    id: 'thyme', name: 'Thyme', kind: 'herb', waterEveryDays: 14, frostHardyTo: -15,
    months: { prune: [6], harvest: [5, 6, 7, 8, 9] },
  },
  {
    id: 'rosemary', name: 'Rosemary', kind: 'herb', waterEveryDays: 14, frostHardyTo: -7,
    months: { prune: [6], harvest: [5, 6, 7, 8, 9] },
  },
];

export const BUILT_IN_PROFILES: Record<string, CareProfile> = Object.fromEntries(
  PROFILES.map((p) => [p.id, p]),
);
