import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

const source = await readFile(new URL('../src/lib/i18n.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const declaration = ast.program.body
  .filter(node => node.type === 'VariableDeclaration')
  .flatMap(node => node.declarations)
  .find(node => node.id.name === 'translations');
assert.ok(declaration, 'translation catalogue exists');

const keyOf = property => property.key.name || property.key.value;
const catalogue = Object.fromEntries(declaration.init.properties.map(language => [
  keyOf(language),
  language.value.properties,
]));

test('Persian and Arabic contain every English translation key exactly once', () => {
  const englishKeys = catalogue.en.map(keyOf);
  for (const lang of ['fa', 'ar']) {
    const keys = catalogue[lang].map(keyOf);
    assert.equal(new Set(keys).size, keys.length, `${lang} contains duplicate keys`);
    assert.deepEqual([...keys].sort(), [...englishKeys].sort(), `${lang} keys differ from English`);
  }
});

test('translated strings keep the same interpolation fields as English', () => {
  const fields = value => [...String(value).matchAll(/\{([a-zA-Z_][a-zA-Z_0-9]*)\}/g)]
    .map(match => match[1]).sort();
  const english = Object.fromEntries(catalogue.en.map(property => [keyOf(property), property.value.value]));
  for (const lang of ['fa', 'ar']) {
    for (const property of catalogue[lang]) {
      const key = keyOf(property);
      assert.equal(typeof property.value.value, 'string', `${lang}.${key} must be a string`);
      assert.ok(property.value.value.trim(), `${lang}.${key} must not be empty`);
      assert.deepEqual(fields(property.value.value), fields(english[key]), `${lang}.${key} changes interpolation fields`);
    }
  }
});
