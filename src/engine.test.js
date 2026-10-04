import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { buildSequence, generateRecords, parseCatalogWorkbook, parseInputWorkbook } from './engine.js';

test('new vehicle catalog supplies limits for every vehicle in the existing input', () => {
  const catalog = parseCatalogWorkbook(readFileSync(new URL('../public/vehicle-catalog.xlsx', import.meta.url)));
  const input = parseInputWorkbook(readFileSync(new URL('../input.xls', import.meta.url)), 'input.xls');
  const byPlate = new Map(catalog.map((item) => [item.plate, item]));
  assert.equal(catalog.length, 73);
  assert.equal(catalog.warnings.length, 1);
  assert.deepEqual(byPlate.get('73H-04440'), { plate: '73H-04440', minCarRaw: 7905, maxCarRaw: 8005, minCargoRaw: 6775, maxCargoRaw: 7317 });
  for (const vehicle of input.vehicles) assert.ok(byPlate.has(vehicle.plate), vehicle.plate);
});

test('legacy catalog can still be supplied as a custom data source', () => {
  const catalog = parseCatalogWorkbook(readFileSync(new URL('../genarate-data.xlsm', import.meta.url)));
  assert.ok(catalog.length > 0);
  assert.deepEqual(catalog.find((item) => item.plate === '73H-04446'), { plate: '73H-04446', minCarRaw: 6745, maxCarRaw: 6850, minCargoRaw: 9060, maxCargoRaw: 9780 });
});

test('existing input generates records within the new catalog limits', () => {
  const catalog = parseCatalogWorkbook(readFileSync(new URL('../public/vehicle-catalog.xlsx', import.meta.url)));
  const input = parseInputWorkbook(readFileSync(new URL('../input.xls', import.meta.url)), 'input.xls');
  const result = generateRecords({ ...input, date: '2026-10-04' }, catalog);
  assert.equal(result.records.length, input.totalTrips);
  const byPlate = new Map(catalog.map((item) => [item.plate, item]));
  for (const record of result.records) {
    const limits = byPlate.get(record.plate);
    assert.ok(record.carWeight >= limits.minCarRaw && record.carWeight <= limits.maxCarRaw);
    assert.ok(record.cargoWeight >= limits.minCargoRaw * 0.93 && record.cargoWeight <= limits.maxCargoRaw);
  }
});

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
