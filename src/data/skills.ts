export interface SkillCategory {
  title: string;
  skills: string[];
}

const languages: SkillCategory = {
  title: "Languages",
  skills: ["Python", "TypeScript", "Java", "SQL", "C++"],
};

export const skillCategories: SkillCategory[] = [
  languages,
  {
    title: "AI / Machine Learning",
    skills: ["PyTorch", "JAX", "scikit-learn", "LLM Agents & Evals", "Deep Reinforcement Learning"],
  },
  {
    title: "Backend & Data",
    skills: ["FastAPI", "Fastify", "MongoDB", "PostgreSQL", "Redis / BullMQ"],
  },
  {
    title: "Cloud & Infrastructure",
    skills: ["Cloudflare Workers", "AWS", "Docker", "Airflow", "Snowflake"],
  },
];

/** Tags that name a language rather than a library, tool, or technique. */
export const programmingLanguages = languages.skills;
