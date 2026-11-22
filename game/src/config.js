// Solara Bay — tuning, palette and story data. One job: constants and mission text.
// The city is 3200 x 2400 world units. Roads run on a 400-unit grid; blocks hold buildings,
// a park, a beach strip along the south edge and a port on the east edge.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const GRID = 400;
export const ROAD_W = 96;

export const COLORS = {
  grass: '#4d8a4a',
  grassDry: '#6a9a4e',
  road: '#3a3f46',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a6',
  sand: '#e6cf9a',
  sea: '#1f7fa8',
  seaDeep: '#14607f',
  park: '#3f7d3a',
  building: ['#c96f4a', '#d9a05b', '#7fa3c9', '#b06a8a', '#8a9a5b', '#5b8a8a', '#c9b458', '#9a6a4a'],
  roof: ['#8a4a34', '#a87a3a', '#5a7a9a', '#7a4a64'],
  car: ['#d94f3d', '#3d7ad9', '#e8c832', '#3d3d3d', '#e8e8e8', '#7a3dd9', '#3dd9a0', '#d97a3d'],
  police: '#2a4a8a',
  taxi: '#e8c832',
  player: '#f2e6c9',
};

export const PLACES = {
  // Every place sits on a road (roads run at multiples of 400) so cars can reach it.
  garage: { x: 400, y: 600, name: 'Rico\u2019s Garage' },
  marina: { x: 2900, y: 2000, name: 'Marina' },
  bank: { x: 2000, y: 1200, name: 'Solara National Bank' },
  safehouse: { x: 1200, y: 2000, name: 'Safehouse' },
  hospital: { x: 1600, y: 1200, name: 'St. Marisol Hospital' },
  fixer: { x: 2000, y: 2000, name: 'The Fixer' },
  plaza: { x: 1800, y: 1000, name: 'Plaza del Sol' },
};

// Story: Lucia Vega comes home to Solara Bay and works off a debt to the crew.
export const MISSIONS = [
  {
    id: 'wheels',
    title: '1 — Wheels',
    brief: 'Rico needs a car. Steal any parked car and bring it to the garage.',
    objective: 'Steal a car and drive to Rico\u2019s Garage',
    payout: 400,
  },
  {
    id: 'delivery',
    title: '2 — The Delivery',
    brief: 'A package for the marina. Drive it there before the buyer walks — 90 seconds.',
    objective: 'Deliver the package to the Marina (90s)',
    payout: 600,
    timeLimit: 90,
  },
  {
    id: 'debt',
    title: '3 — Debt Collection',
    brief: 'Three debtors owe the crew. Find each one on foot and press E to collect.',
    objective: 'Collect from 3 debtors (on foot, press E)',
    payout: 800,
  },
  {
    id: 'heat',
    title: '4 — Lose the Heat',
    brief: 'The cops are onto you. Three stars. Break line of sight and get to the safehouse.',
    objective: 'Lose the cops — reach the Safehouse with 0 stars',
    payout: 1000,
  },
  {
    id: 'score',
    title: '5 — The Big Score',
    brief: 'The bank. Grab the cash, hold the lobby for 20 seconds, then lose the cops and reach the safehouse.',
    objective: 'Rob the bank, survive 20s, reach the Safehouse',
    payout: 5000,
  },
];

export const SAVE_KEY = 'solara-bay-save-v1';
