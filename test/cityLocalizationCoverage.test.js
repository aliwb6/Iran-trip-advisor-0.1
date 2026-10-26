import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { cityTranslations } from '../src/data/cityTranslations.js';

const source = await readFile(new URL('../src/pages/CityPage.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const cityData = ast.program.body
  .filter(node => node.type === 'VariableDeclaration')
  .flatMap(node => node.declarations)
  .find(node => node.id.name === 'cityData')?.init;

test('every city introduction and attraction has Persian and Arabic copy', () => {
  assert.ok(cityData, 'city catalogue exists');
  const keyOf = property => property.key.name || property.key.value;
  const cities = cityData.properties.map(property => {
    const highlights = property.value.properties.find(item => keyOf(item) === 'highlights');
    return { slug: keyOf(property), attractionCount: highlights.value.elements.length };
  });
  assert.deepEqual(Object.keys(cityTranslations).sort(), cities.map(city => city.slug).sort());
  for (const { slug, attractionCount } of cities) {
    for (const lang of ['fa', 'ar']) {
      const copy = cityTranslations[slug][lang];
      assert.ok(copy.category?.trim(), `${slug}.${lang} category missing`);
      assert.ok(copy.description?.trim(), `${slug}.${lang} description missing`);
      assert.equal(copy.highlights.length, attractionCount, `${slug}.${lang} attraction count differs`);
      assert.ok(copy.highlights.every(value => value.trim()), `${slug}.${lang} attraction missing`);
    }
  }
});
