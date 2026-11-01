# Skill icon sources

All 21 display assets in `native/` retain their complete published SVG geometry. The custom hollow outlines, contour tracing, Boolean unions, and simplified shapes have been removed. The portfolio uses one purple CSS tint and consistent 20px slots, preserving each logo's original proportions. NVIDIA has a -1px CSS vertical adjustment to align its optical center with the text.

`source/` retains downloaded artwork. `sources.json` records exact URLs, original/display hashes, and presentation changes. JAX and Airflow preserve their original face/blade contrast through alpha values in the purple tint; all paths, polygons, and circles remain unchanged.

| Entries | Artwork publisher |
| --- | --- |
| Python, TypeScript, C++, PyTorch, CUDA/NVIDIA, scikit-learn, FastAPI, Fastify, MongoDB, PostgreSQL, Cloudflare, Docker, Snowflake | [Simple Icons](https://github.com/simple-icons/simple-icons/tree/develop/icons), standard monochrome logos |
| Java, AWS, Airflow, Redis | [Devicon](https://github.com/devicons/devicon/tree/master/icons), native cup, AWS wordmark, filled pinwheel, and classic Redis stack |
| JAX | [JAX's official repository](https://github.com/jax-ml/jax/blob/main/images/jax_logo.svg) |
| SQL, LLM Agents & Evals, Reinforcement Learning | [Lucide](https://github.com/lucide-icons/lucide/tree/main/icons): database, bot, repeat-2 |

The icon-set publishers are identified above; they are not the technology trademark owners. SQL, agents/evals, and reinforcement learning use published concept symbols, rather than brand logos. No AI image was used and no logo geometry was drawn or generated.

Licenses are retained in `SIMPLE-ICONS-LICENSE`, `DEVICON-LICENSE`, and `LUCIDE-LICENSE`. The technology names and trademarks remain with their owners.
