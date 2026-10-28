import { COMMENT_LIMITS as limits, commentError } from './comments.mjs';

// Each write checks limits and inserts the comment in one atomic Redis script.
export const addCommentLua = `
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - tonumber(ARGV[2]))
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - tonumber(ARGV[6]))
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return {'rate', '86400'} end
if redis.call('ZCOUNT', KEYS[1], '(' .. (now - tonumber(ARGV[4])), '+inf') >= tonumber(ARGV[5]) then return {'rate', '600'} end
local last = redis.call('ZREVRANGE', KEYS[1], 0, 0, 'WITHSCORES')
if #last > 0 and now - tonumber(last[2]) < tonumber(ARGV[7]) then return {'rate', tostring(math.ceil((tonumber(ARGV[7]) - now + tonumber(last[2])) / 1000))} end
if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[8]) then return {'rate', '60'} end
if redis.call('EXISTS', KEYS[3]) == 1 then return {'duplicate'} end
redis.call('ZADD', KEYS[1], now, ARGV[9])
redis.call('EXPIRE', KEYS[1], 86400)
redis.call('ZADD', KEYS[2], now, ARGV[9])
redis.call('EXPIRE', KEYS[2], 60)
redis.call('SET', KEYS[3], '1', 'EX', 86400)
redis.call('ZADD', KEYS[4], 0, ARGV[9])
redis.call('HSET', KEYS[5], ARGV[9], ARGV[10])
return {'ok'}
`;
export const listCommentsLua = `
local reads = redis.call('INCR', KEYS[3])
if reads == 1 then redis.call('EXPIRE', KEYS[3], 60) end
if reads > 120 then return {'rate'} end
local upper = '+'
if ARGV[1] ~= '' then upper = '(' .. ARGV[1] end
local rows = redis.call('ZREVRANGEBYLEX', KEYS[1], upper, '-', 'LIMIT', 0, 31)
local more = #rows > 30
if more then table.remove(rows) end
local cursor = ''
if more then cursor = rows[#rows] end
local result = {tostring(redis.call('ZCARD', KEYS[1])), cursor}
for _, id in ipairs(rows) do table.insert(result, redis.call('HGET', KEYS[2], id)) end
return result
`;

export function redisComments({ url, token, namespace = 'jd-blog-comments', fetcher = fetch }) {
  if (!url || !token) return null;
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('Redis REST must use HTTPS.');
  const command = async args => {
    const response = await fetcher(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Redis request failed.');
    const data = await response.json(); if (data.error || !('result' in data)) throw new Error('Redis command failed.'); return data.result;
  };
  const keys = postId => [`${namespace}:post:${postId}:index`, `${namespace}:post:${postId}:data`];
  return {
    async list(postId, cursor, clientKey) {
      const result = await command(['EVAL', listCommentsLua, 3, ...keys(postId), `${namespace}:read:${clientKey}`, cursor]);
      if (result[0] === 'rate') throw commentError(429, 'Too many comment requests. Please wait a minute.', 60);
      return { count: Number(result[0]), cursor: result[1] || null, comments: result.slice(2).map(raw => JSON.parse(raw)) };
    },
    async add(input) {
      const result = await command(['EVAL', addCommentLua, 5, `${namespace}:client:${input.clientKey}`, `${namespace}:post-rate:${input.postId}`, `${namespace}:duplicate:${input.fingerprint}`, ...keys(input.postId), input.now, limits.dayMs, limits.perDay, limits.windowMs, limits.perWindow, limits.postWindowMs, limits.cooldownMs, limits.perPostWindow, input.comment.id, JSON.stringify(input.comment)]);
      if (result[0] === 'rate') throw commentError(429, 'Please wait before posting another comment.', Number(result[1]));
      if (result[0] === 'duplicate') throw commentError(409, 'That comment has already been posted.');
      if (result[0] !== 'ok') throw new Error('Comment write failed.');
    },
    async remove(postId, id) { await command(['EVAL', "redis.call('ZREM', KEYS[1], ARGV[1]); redis.call('HDEL', KEYS[2], ARGV[1]); return 1", 2, ...keys(postId), id]); },
  };
}
