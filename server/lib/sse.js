const channels = new Map() // key: channel string -> Set(res)

export function subscribe(channel, res){
  if (!channels.has(channel)) channels.set(channel, new Set())
  channels.get(channel).add(res)
  res.on('close', ()=> { channels.get(channel)?.delete(res) })
}

export function publish(channel, data){
  const set = channels.get(channel)
  if (!set || set.size === 0) return
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const res of set) { try { res.write(payload) } catch {} }
}
