import React, { useEffect, useMemo, useRef, useState } from 'react'
import { setupSignaling } from './webrtc/signaling'
import { createPeerFor } from './webrtc/peer'
import { VideoTile } from './components/VideoTile'
import { DevicePicker } from './components/DevicePicker'

type RemoteTrack = {
  id: string
  stream: MediaStream
  kind: 'video' | 'audio'
  from: string
  label: string
}

export default function App() {
  const [roomId, setRoomId] = useState(() => new URL(location.href).searchParams.get('room') || 'demo')
  const [name, setName] = useState('Ayaan')
  const [connected, setConnected] = useState(false)
  const [wsStatus, setWsStatus] = useState('idle')
  const [meId, setMeId] = useState<string>('')
  const [peers, setPeers] = useState<{peerId: string, displayName: string}[]>([])
  const [remoteTracks, setRemoteTracks] = useState<RemoteTrack[]>([])
  const [localCam, setLocalCam] = useState<MediaStream | null>(null)
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [sharing, setSharing] = useState(false)

  const pcs = useRef(new Map<string, RTCPeerConnection>())
  const [selDevs, setSelDevs] = useState<{audioIn?: string, videoIn?: string}>({})

  useEffect(() => {
    // prepare devices and local cam/mic on load (optional: lazy)
    (async () => {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selDevs.videoIn ? { exact: selDevs.videoIn } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
        audio: { deviceId: selDevs.audioIn ? { exact: selDevs.audioIn } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      setLocalCam(cam)
    })().catch(console.error)
  }, [selDevs.audioIn, selDevs.videoIn])

  const signaling = useMemo(() => setupSignaling({
    onWelcome: (id) => setMeId(id),
    onOpen: () => setWsStatus('connected'),
    onClose: () => setWsStatus('closed'),
    onPeersInRoom: (peers) => setPeers(peers),
    onPeerJoin: (peer) => {
      setPeers(p => [...p.filter(x=>x.peerId!==peer.peerId), peer])
      createOrGetPeer(peer.peerId, true)
        .then(pc => negotiate(pc, peer.peerId))
        .catch(console.error)
    },
    onPeerLeave: ({ peerId }) => {
      const pc = pcs.current.get(peerId)
      if (pc) { pc.close(); pcs.current.delete(peerId) }
      setPeers(p => p.filter(x => x.peerId !== peerId))
      setRemoteTracks(t => t.filter(tr => tr.from !== peerId))
    },
    onOffer: async ({ from, payload }) => {
      const pc = await createOrGetPeer(from, false)
      await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
      await ensureLocalTracks(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      signaling.send({ type: 'answer', target: from, payload: { sdp: answer.sdp } })
    },
    onAnswer: async ({ from, payload }) => {
      const pc = pcs.current.get(from)
      if (!pc) return
      await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
    },
    onIce: async ({ from, payload }) => {
      const pc = pcs.current.get(from)
      if (!pc) return
      try { await pc.addIceCandidate(payload) } catch {}
    }
  }), [])

  function trackAdded(from: string, ev: RTCTrackEvent) {
    const stream = ev.streams[0]
    if (!stream) return
    setRemoteTracks(prev => {
      const exists = prev.find(t => t.stream.id === stream.id && t.kind === ev.track.kind as any)
      if (exists) return prev
      return [...prev, { id: `${stream.id}:${ev.track.id}`, stream, kind: ev.track.kind as any, from, label: ev.track.label || (ev.track.kind === 'video' ? 'video' : 'audio') }]
    })
  }

  async function ensureLocalTracks(pc: RTCPeerConnection) {
    if (localCam) {
      for (const track of localCam.getTracks()) {
        const sender = pc.addTrack(track, localCam)
        tuneSender(sender)
      }
    }
    if (localScreen) {
      for (const track of localScreen.getTracks()) {
        const sender = pc.addTrack(track, localScreen)
        ;(track as any).contentHint = 'detail'
        tuneSender(sender, true)
      }
    }
  }

  function tuneSender(sender: RTCRtpSender, isScreen = false) {
    if (sender.track?.kind !== 'video') return
    const p = sender.getParameters()
    p.degradationPreference = 'maintain-framerate'
    p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]
    p.encodings[0].maxFramerate = 60
    p.encodings[0].maxBitrate = isScreen ? 6_000_000 : 3_000_000
    sender.setParameters(p).catch(()=>{})
  }

  async function createOrGetPeer(peerId: string, willOffer: boolean) {
    let pc = pcs.current.get(peerId)
    if (pc) return pc
    pc = createPeerFor(peerId, signaling, (ev) => trackAdded(peerId, ev))
    pcs.current.set(peerId, pc)
    await ensureLocalTracks(pc)
    if (willOffer) await new Promise(r => setTimeout(r, 0))
    return pc
  }

  async function negotiate(pc: RTCPeerConnection, target: string) {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signaling.send({ type: 'offer', target, payload: { sdp: offer.sdp } })
  }

  async function join() {
    setConnected(true)
    signaling.connect()
    signaling.onceOpen(() => {
      signaling.send({ type: 'join', roomId, displayName: name })
    })
  }

  async function leave() {
    signaling.send({ type: 'leave' })
    for (const [,pc] of pcs.current) pc.close()
    pcs.current.clear()
    setRemoteTracks([])
    setConnected(false)
  }

  async function toggleMute() {
    setMuted(m => !m)
    localCam?.getAudioTracks().forEach(t => t.enabled = !t.enabled)
  }

  async function toggleCam() {
    setCamOff(c => !c)
    localCam?.getVideoTracks().forEach(t => t.enabled = !t.enabled)
  }

  async function startShare() {
    const scr = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
      audio: true
    })
    ;(scr.getVideoTracks()[0] as any).contentHint = 'detail'
    setLocalScreen(scr)
    setSharing(true)
    for (const [, pc] of pcs.current) {
      for (const track of scr.getTracks()) {
        const sender = pc.addTrack(track, scr)
        tuneSender(sender, true)
      }
    }
    scr.getVideoTracks()[0].onended = () => stopShare()
  }

  function stopShare() {
    localScreen?.getTracks().forEach(t => t.stop())
    setLocalScreen(null)
    setSharing(false)
    for (const [, pc] of pcs.current) {
      pc.getSenders().forEach(s => {
        if (s.track && s.track.kind === 'video' && s.track.label.toLowerCase().includes('display')) {
          pc.removeTrack(s)
        }
      })
    }
  }

  async function restartLocal(av: { audioIn?: string, videoIn?: string }) {
    const cam = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: av.videoIn ? { exact: av.videoIn } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } },
      audio: { deviceId: av.audioIn ? { exact: av.audioIn } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    // Replace outgoing tracks on all peers
    for (const [, pc] of pcs.current) {
      const vSender = pc.getSenders().find(s => s.track?.kind === 'video' && !s.track.label.toLowerCase().includes('display'))
      const aSender = pc.getSenders().find(s => s.track?.kind === 'audio')
      const vTrack = cam.getVideoTracks()[0]
      const aTrack = cam.getAudioTracks()[0]
      if (vSender && vTrack) { await vSender.replaceTrack(vTrack); tuneSender(vSender) }
      if (aSender && aTrack) { await aSender.replaceTrack(aTrack) }
    }
    localCam?.getTracks().forEach(t => t.stop())
    setLocalCam(cam)
  }

  return (
    <div className="container">
      <aside className="sidebar">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="brand">Meet60</div>
          <div className="small">WS: {wsStatus}</div>
        </div>
        <hr/>
        <div className="field">
          <label>Room ID</label>
          <input disabled={connected} value={roomId} onChange={e=>setRoomId(e.target.value)} />
        </div>
        <div className="field">
          <label>Display name</label>
          <input disabled={connected} value={name} onChange={e=>setName(e.target.value)} />
        </div>
        {!connected ? (
          <button onClick={join}>Join Room</button>
        ) : (
          <button className="ghost" onClick={leave}>Leave</button>
        )}
        <hr/>
        <DevicePicker onChange={(sel)=>{ setSelDevs(sel); if (connected) restartLocal(sel).catch(console.error) }} />
        <hr/>
        <div className="row">
          <button onClick={toggleMute} disabled={!connected}>{muted ? 'Unmute' : 'Mute'}</button>
          <button onClick={toggleCam} disabled={!connected}>{camOff ? 'Cam On' : 'Cam Off'}</button>
        </div>
        <div className="row" style={{marginTop:8}}>
          {!sharing ? (
            <button onClick={startShare} disabled={!connected}>Start Screen</button>
          ) : (
            <button onClick={stopShare} className="warn">Stop Screen</button>
          )}
        </div>
        <hr/>
        <div className="small">
          Peers in room: {peers.length} {peers.length===0 ? '(waiting...)' : ''}
        </div>
        <div className="small">
          {peers.map(p => <div key={p.peerId}>• {p.displayName || p.peerId.slice(0,6)}</div>)}
        </div>
        <hr/>
        <div className="small">
          Tip: For max smoothness, share a <b>tab</b>. Active speaker is highlighted in green.
        </div>
      </aside>

      <main>
        <div className="grid">
          {localCam && (
            <VideoTile stream={localCam} label="You (cam)" self />
          )}
          {localScreen && (
            <VideoTile stream={localScreen} label="You (screen)" self />
          )}
          {remoteTracks.filter(t=>t.kind==='video').map(t => (
            <VideoTile key={t.id} stream={t.stream} label={`Peer ${t.from.slice(0,6)} (${t.label.toLowerCase().includes('display')?'screen':'cam'})`} />
          ))}
        </div>
      </main>
    </div>
  )
}
