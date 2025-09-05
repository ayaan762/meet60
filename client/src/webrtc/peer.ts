function rtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = []
  const stun = import.meta.env.VITE_STUN_URL
  const turn = import.meta.env.VITE_TURN_URL
  const user = import.meta.env.VITE_TURN_USERNAME
  const cred = import.meta.env.VITE_TURN_CREDENTIAL

  if (stun) iceServers.push({ urls: [stun] })
  if (turn && user && cred) iceServers.push({ urls: [turn], username: user, credential: cred })

  return {
    iceServers,
    // Enforce relay only for testing TURN: uncomment below
    // iceTransportPolicy: 'relay'
  }
}

export function createPeerFor(targetId: string, signaling: any, onTrack: (e: RTCTrackEvent)=>void) {
  const pc = new RTCPeerConnection(rtcConfig())
  pc.onicecandidate = (e) => {
    if (e.candidate) signaling.send({ type: 'ice', target: targetId, payload: e.candidate })
  }
  pc.ontrack = onTrack
  return pc
}
