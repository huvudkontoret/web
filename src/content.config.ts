import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const nodes = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/nodes' }),
  schema: z.object({
    type: z.string(),
    displayName: z.string(),
    nodeId: z.string(),
    title: z.string(),
    location: z.object({ city: z.string(), country: z.string(), timezone: z.string() }),
    summary: z.string(),
    bio: z.string(),
    currentFocus: z.array(z.string()),
    principles: z.array(z.string()),
    skills: z.array(z.object({ name: z.string(), level: z.number(), category: z.string() })),
    experience: z.array(z.object({ company: z.string(), role: z.string(), period: z.string(), description: z.string() })),
    links: z.object({ linkedin: z.string().optional(), email: z.string().optional() }),
    availability: z.object({ status: z.string(), from: z.string() }),
    standardCv: z.object({
      headline: z.string(),
      yearsExperience: z.string(),
      deliveries: z.string(),
      coreCompetencies: z.array(z.string()),
    }),
  }),
});

export const collections = { nodes };
