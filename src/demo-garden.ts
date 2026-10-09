import type { Garden } from './types';

/** The author's own garden in Forshaga, Värmland, as of October 2026. */
export function demoGarden(): Garden {
  return {
    name: 'Forshaga garden',
    place: { name: 'Forshaga', lat: 59.52541, lon: 13.48127, country: 'Sweden', region: 'Värmland County' },
    pests: ['deer'],
    areas: [
      { id: 'orchard', name: 'Orchard', kind: 'orchard', covered: false },
      { id: 'berries', name: 'Berry bushes', kind: 'bed', covered: false },
      {
        id: 'greenhouse',
        name: 'Greenhouse',
        kind: 'greenhouse',
        covered: true,
        notes: 'Season is over; everything inside has died back.',
      },
      {
        id: 'collar-1',
        name: 'Pallet collar 1',
        kind: 'raised-bed',
        covered: false,
        notes: 'Deer ate everything this year.',
      },
      {
        id: 'collar-2',
        name: 'Pallet collar 2',
        kind: 'raised-bed',
        covered: false,
        notes: 'Deer ate everything this year.',
      },
    ],
    plants: [
      { id: 'apple', name: 'Apple trees', kind: 'tree', profileId: 'apple', areaId: 'orchard', status: 'growing' },
      { id: 'pear', name: 'Pear trees', kind: 'tree', profileId: 'pear', areaId: 'orchard', status: 'growing' },
      { id: 'blueberry', name: 'Highbush blueberries', kind: 'bush', profileId: 'highbush-blueberry', areaId: 'berries', status: 'growing' },
      { id: 'blackcurrant', name: 'Blackcurrant', kind: 'bush', profileId: 'blackcurrant', areaId: 'berries', status: 'growing' },
      { id: 'redcurrant', name: 'Redcurrant', kind: 'bush', profileId: 'redcurrant', areaId: 'berries', status: 'growing' },
      { id: 'tomato', name: 'Tomatoes', kind: 'vegetable', profileId: 'tomato', areaId: 'greenhouse', status: 'finished' },
      { id: 'squash', name: 'Squash', kind: 'vegetable', profileId: 'squash', areaId: 'greenhouse', status: 'finished' },
      { id: 'cucumber', name: 'Cucumber', kind: 'vegetable', profileId: 'cucumber', areaId: 'greenhouse', status: 'finished' },
      { id: 'radish', name: 'Radishes', kind: 'vegetable', profileId: 'radish', areaId: 'greenhouse', status: 'finished' },
      { id: 'chili', name: 'Mild chili', kind: 'vegetable', profileId: 'chili', areaId: 'greenhouse', status: 'finished' },
      { id: 'potato', name: 'Potatoes', kind: 'vegetable', profileId: 'potato', areaId: 'collar-1', status: 'finished' },
      { id: 'peas-1', name: 'Peas', kind: 'vegetable', profileId: 'pea', areaId: 'collar-1', status: 'finished' },
      { id: 'cabbage', name: 'Cabbage', kind: 'vegetable', profileId: 'cabbage', areaId: 'collar-2', status: 'finished' },
      { id: 'peas-2', name: 'Peas', kind: 'vegetable', profileId: 'pea', areaId: 'collar-2', status: 'finished' },
      { id: 'broccoli', name: 'Broccoli', kind: 'vegetable', profileId: 'broccoli', areaId: 'collar-2', status: 'finished' },
    ],
  };
}
