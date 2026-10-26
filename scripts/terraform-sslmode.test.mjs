// RocketEase's app connects with sslmode=verify-full; its psql-run admin URL keeps require (SI-6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tf = fs.readFileSync(new URL('../terraform/envs/azure/rocketease.tf', import.meta.url), 'utf8');
const urlFor = (role) => new RegExp(`postgresql://${role}:[^"]*sslmode=([\\w-]+)"`).exec(tf)?.[1];

test('the RocketEase app URL verifies the server certificate and host', () => {
  assert.equal(urlFor('rocketease_app'), 'verify-full');
});

test('the RocketEase admin URL stays require, because psql has no CA file in the role Job', () => {
  assert.equal(urlFor('rocketease_owner'), 'require');
});
