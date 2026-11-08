import {distance} from './battle-sim.js';

const rufus = 4;
const knights = 1;
const firstPoint = {x: 29, z: 12};
const cavalryPoint = {x: -20, z: 12};
export const HASTINGS_MODELS = [
  ['mailed_knights', 'Normans'], ['mailed_knights', 'Normans'],
  ['armored_sergeants', 'Normans'], ['archer_militia', 'Normans'],
  ['mailed_knights', 'Normans'], ['theigns', 'Saxons'],
  ['english_huscarls', 'Saxons'], ['peasants', 'Saxons'],
  ['theigns', 'Saxons'], ['english_huscarls', 'Saxons']
];

// Adapt the opening scripted milestones to the browser battlefield.
export function prepareHastings(battle) {
  const names = ['Duke William', 'Mailed Knights', 'Armored Sergeants', 'Archer Militia',
    'Rufus', 'Theigns', 'King Harold', 'Peasants', 'Theigns', 'English Huscarls'];
  battle.squads.forEach((squad, index) => {
    squad.name = names[index];
    if (squad.side === 1) squad.type = 'sword';
  });
  battle.squads[0].type = 'horse';
  battle.squads[knights].type = 'horse';
  battle.selected = [];
  battle.training = true;
  return battle;
}

export function hastingsLesson() {
  let step = 0;
  let cameraStart;
  const lessons = [
    {title: 'Select Rufus', text: 'Click Rufus on the battlefield or select his regiment card.'},
    {title: 'Move Rufus', text: 'Order Rufus to the gold circle. Right-click on desktop or tap on touch.', point: firstPoint},
    {title: 'Move the camera', text: 'Pan with WASD or the arrow keys. You can also drag to orbit.'},
    {title: 'Select the Mailed Knights', text: 'Use the Mailed Knights card to select your cavalry.'},
    {title: 'Move at a run', text: 'Turn on Run and send the Mailed Knights to the gold circle.', point: cavalryPoint},
    {title: 'Join the battle', text: 'You’ve completed the opening drills. Join the fight against the Saxon line.'}
  ];
  return {
    get current() { return lessons[step]; },
    get complete() { return step === lessons.length - 1; },
    update(battle, camera) {
      const before = step;
      if (step === 0 && battle.selected.includes(rufus)) step++;
      else if (step === 1 && distance(battle.squads[rufus], firstPoint) < 2.5) {
        cameraStart = camera.clone();
        step++;
      } else if (step === 2 && camera.distanceTo(cameraStart) > 3) step++;
      else if (step === 3 && battle.selected.includes(knights)) step++;
      else if (step === 4 && battle.squads[knights].running && distance(battle.squads[knights], cavalryPoint) < 2.5) step++;
      return before !== step;
    }
  };
}
