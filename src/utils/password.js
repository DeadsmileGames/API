import argon2 from "argon2";

export function hashPassword(plainPassword) {
  return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export function verifyPassword(hash, plainPassword) {
  return argon2.verify(hash, plainPassword);
}
