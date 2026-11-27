import { expect, test } from 'vitest'
import { parseMenuPrice } from '../admin/src/lib/menu-price.js'

test.each([
  ['120', 12000], ['120.5', 12050], ['0.07', 7], ['19.99', 1999],
  ['1.234', null], ['-5', null], ['abc', null], ['', null], ['12345678', null],
] as const)('parses THB input %j as %j satang', (input, expected) => {
  expect(parseMenuPrice(input)).toBe(expected)
})
