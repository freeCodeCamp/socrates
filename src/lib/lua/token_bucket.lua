local user_key = KEYS[1]
local global_key = KEYS[2]
local now = tonumber(ARGV[1])
local perUserCap = tonumber(ARGV[2])
local perUserRate = tonumber(ARGV[3])
local globalCap = tonumber(ARGV[4])
local globalRate = tonumber(ARGV[5])
local ttl = tonumber(ARGV[6])

local function get_bucket(key, cap)
  local h = redis.call('hmget', key, 'tokens', 'last')
  local tokens = tonumber(h[1]) or cap
  local last = tonumber(h[2]) or now
  return tokens, last
end

local userTokens, userLast = get_bucket(user_key, perUserCap)
local userRefill = math.min(perUserCap, userTokens + (now - userLast) * perUserRate)
local userAllowed = 0
if userRefill >= 1 then
  userRefill = userRefill - 1
  userAllowed = 1
end
redis.call('hmset', user_key, 'tokens', tostring(userRefill), 'last', tostring(now))
redis.call('expire', user_key, ttl)

local globalTokens, globalLast = get_bucket(global_key, globalCap)
local globalRefill = math.min(globalCap, globalTokens + (now - globalLast) * globalRate)
local globalAllowed = 0
if globalRefill >= 1 then
  globalRefill = globalRefill - 1
  globalAllowed = 1
end
redis.call('hmset', global_key, 'tokens', tostring(globalRefill), 'last', tostring(now))
redis.call('expire', global_key, ttl)

-- Return allowed flag and remaining tokens for both buckets
return {userAllowed, tostring(userRefill), globalAllowed, tostring(globalRefill)}
