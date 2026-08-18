import { z } from "zod";

export function defineCollection<T>(config: T): T {
  return config;
}

export function reference(_collection: string) {
  return z.string().min(1);
}
