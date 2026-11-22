// Solara Bay — tuning and world constants. One job: numbers and names, no logic.
// The city is a road grid: avenues run north-south, streets run east-west, and the
// beach and marina sit along the western edge. Everything is in world pixels.
export const WORLD = {
  width: 3200,
  height: 2400,
  roadWidth: 96,
  laneWidth: 48,
};

export const VIEW = { width: 1280, height: 720 };

// Avenues (vertical roads) and streets (horizontal roads), centre lines in pixels.
export const AVENUES = [240, 720, 1200, 1680, 2160, 2640];
export const STREETS = [240, 640, 1040, 1440, 1840, 2160];

export const STEP = 1 / 60;
export const BEST_KEY = 'solara-bay-best-cash';
export const SAVE_KEY = 'solara-bay-save-v1';

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  enterCarRange: 70,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 160,
  steerRate: 2.6,
  grip: 0.92,
  policeMaxSpeed: 440,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 5,
  decayRate: 1 / 14,
  policeCarCap: [0, 1, 2, 3, 4, 5],
  sightRadius: 560,
  bustRadius: 46,
};

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Mara Voss',
    briefing: 'You are new in Solara Bay and broke. Take any car on Harbor Avenue and bring it to the Chop Garage on Dock Street. Nobody will miss it.',
    reward: 400,
    steps: [
      { kind: 'enter-car', text: 'Get in any car (walk up and press E)' },
      { kind: 'reach', x: 2640, y: 2160, radius: 90, text: 'Drive to the Chop Garage' },
    ],
  },
  {
    id: 'courier-run',
    title: 'Courier Run',
    giver: 'Mara Voss',
    briefing: 'Three parcels, three drops, one clock. The clients pay in cash and ask no questions. Do not keep the police waiting.',
    reward: 900,
    timeLimit: 150,
    steps: [
      { kind: 'reach', x: 1200, y: 640, radius: 70, text: 'Drop 1: Cafe Lumen, Palm Street' },
      { kind: 'reach', x: 720, y: 1440, radius: 70, text: 'Drop 2: The Arcade, Coral Street' },
      { kind: 'reach', x: 2160, y: 1040, radius: 70, text: 'Drop 3: Marina Gate' },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: 'Mara Voss',
    briefing: 'A job went loud. You are at three stars and the whole Solara Bay force is rolling. Survive the chase for 45 seconds and the heat will burn itself out.',
    reward: 1200,
    steps: [
      { kind: 'survive', duration: 45, text: 'Survive the chase (45s) — do not get busted' },
    ],
  },
  {
    id: 'tool-run',
    title: 'Tool Run',
    giver: 'Mara Voss',
    briefing: 'The Marina Job needs tools: a cutter, a drill, a jammer and a bag. Four crates are stashed around the city. Collect them all.',
    reward: 1500,
    steps: [
      { kind: 'collect', count: 4, text: 'Collect the tool crates (0/4)' },
    ],
  },
  {
    id: 'marina-job',
    title: 'The Marina Job',
    giver: 'Mara Voss',
    briefing: 'The big one. A yacht at the marina holds a safe of casino cash. Grab it, then get back to the hideout on Harbor Avenue before the city wakes up.',
    reward: 5000,
    steps: [
      { kind: 'reach', x: 240, y: 2160, radius: 80, text: 'Reach the yacht at the marina' },
      { kind: 'reach', x: 2640, y: 240, radius: 90, text: 'Escape to the hideout' },
    ],
  },
];

// Named places the minimap and the mission text point at.
export const PLACES = [
  { name: 'Marina', x: 240, y: 2160 },
  { name: 'Chop Garage', x: 2640, y: 2160 },
  { name: 'Hideout', x: 2640, y: 240 },
  { name: 'Cafe Lumen', x: 1200, y: 640 },
  { name: 'The Arcade', x: 720, y: 1440 },
  { name: 'Marina Gate', x: 2160, y: 1040 },
  { name: 'City Hall', x: 1200, y: 1040 },
  { name: 'Solara Plaza', x: 1680, y: 1440 },
  { name: 'Beachfront', x: 120, y: 1040 },
];

export const CAR_MODELS = [
  { name: 'Pico', color: '#e8b64c', speed: 0.85 },
  { name: 'Comet', color: '#c94f43', speed: 1.0 },
  { name: 'Vagabond', color: '#4c7fb8', speed: 0.95 },
  { name: 'Sunray', color: '#e8e4d8', speed: 1.05 },
  { name: 'Dune', color: '#7a9e5a', speed: 0.9 },
  { name: 'Falcon', color: '#2e2e38', speed: 1.15 },
];

export const PED_NAMES = [
  'Tourist', 'Jogger', 'Vendor', 'Commuter', 'Skater', 'Dog Walker', 'Student', 'Fisherman',
];
