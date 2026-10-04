import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSequence } from './engine.js';

test('only shuffles the first round and reuses that order for later rounds', () => {
  const vehicles = [
    { plate: 'A', tripCount: 4 },
    { plate: 'B', tripCount: 4 },
    { plate: 'C', tripCount: 4 },
    { plate: 'D', tripCount: 4 },
  ];

  const sequence = buildSequence(vehicles, 'fixed-order-test');
  const firstRound = sequence.slice(0, vehicles.length);

  for (let round = 1; round < 4; round += 1) {
    assert.deepEqual(
      sequence.slice(round * vehicles.length, (round + 1) * vehicles.length),
      firstRound,
    );
  }
});

test('keeps every vehicle in round 1 while randomizing omissions in later rounds', () => {
  const vehicles = [
    { plate: 'A', tripCount: 5 },
    { plate: 'B', tripCount: 3 },
    { plate: 'C', tripCount: 2 },
    { plate: 'D', tripCount: 1 },
  ];

  const sequence = buildSequence(vehicles, 'random-omission-test');
  const firstRound = sequence.slice(0, vehicles.length);
  assert.deepEqual(new Set(firstRound), new Set(vehicles.map((vehicle) => vehicle.plate)));

  for (const vehicle of vehicles) {
    assert.equal(sequence.filter((plate) => plate === vehicle.plate).length, vehicle.tripCount);
  }

  const orderIndex = new Map(firstRound.map((plate, index) => [plate, index]));
  let previousIndex = -1;
  for (const plate of sequence.slice(vehicles.length)) {
    const currentIndex = orderIndex.get(plate);
    if (currentIndex <= previousIndex) previousIndex = -1;
    assert.ok(currentIndex > previousIndex);
    previousIndex = currentIndex;
  }
});
