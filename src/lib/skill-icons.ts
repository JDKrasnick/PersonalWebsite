const icon = (file: string) => ({ file });

// Download origins and normalization details: public/icons/skills/official/sources.json.
export const skillIcons = {
  python: icon('python.svg'),
  typescript: icon('typescript.svg'),
  java: icon('java.svg'),
  sql: icon('sql.svg'),
  cpp: icon('cpp.svg'),
  pytorch: icon('pytorch.svg'),
  jax: icon('jax.svg'),
  'scikit-learn': icon('scikit-learn.svg'),
  'agents-evals': icon('agents-evals.svg'),
  rl: icon('rl.svg'),
  cuda: icon('cuda.svg'),
  fastapi: icon('fastapi.svg'),
  fastify: icon('fastify.svg'),
  mongodb: icon('mongodb.svg'),
  postgresql: icon('postgresql.svg'),
  redis: icon('redis.svg'),
  cloudflare: icon('cloudflare.svg'),
  aws: icon('aws.svg'),
  docker: icon('docker.svg'),
  airflow: icon('airflow.svg'),
  snowflake: icon('snowflake.svg'),
};

export type SkillIconName = keyof typeof skillIcons;
