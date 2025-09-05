type Handlers = {
  onWelcome: (id:string) => void
  onOpen: () => void
  onceOpen?: (cb:()=>void) => void
  onClose: () => void
  onPeersInRoom: (peers: any[]) => void
  onPeerJoin: (peer: any) => void
  onPeerLeave: (peer: any) => void
  onOffer: (msg: any) => void
  onAnswer: (msg: any) => void
  onIce: (msg: any) => void
}

type Signal = { type: string, [k:string]: any }

export function setupSignaling(handlers: Handlers) {
  const url = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:3001'
  let ws: WebSocket | null = null
  let openCbs: (()=>void)[] = []

  function connect() {
    ws = new WebSocket(url)
    ws.onopen = () => {
      handlers.onOpen()
      openCbs.forEach(cb => cb()); openCbs = []
    }
    ws.onclose = () => handlers.onClose()
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      switch (msg.type) {
        case 'welcome': handlers.onWelcome(msg.id); break
        case 'peers-in-room': handlers.onPeersInRoom(msg.peers || []); break
        case 'peer-join': handlers.onPeerJoin(msg); break
        case 'peer-leave': handlers.onPeerLeave(msg); break
        case 'offer': handlers.onOffer(msg); break
        case 'answer': handlers.onAnswer(msg); break
        case 'ice': handlers.onIce(msg); break
      }
    }
  }

  function send(signal: Signal) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(signal))
  }

  function onceOpen(cb: ()=>void) {
    if (ws && ws.readyState === WebSocket.OPEN) cb()
    else openCbs.push(cb)
  }

  return { connect, send, onceOpen }
}
