import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string(),
  price: z.number().int().positive(),
  discount: z.number().int().positive(),
  description: z.string(),
  image: z.string(),
});
