import React, { useEffect, useRef, useState } from 'react'

export function VideoTile({ stream, label, self=false }:{ stream: MediaStream, label: string, self?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [speaking, setSpeaking] = useState(false)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    ref.current.srcObject = stream
    ref.current.muted = self
    ref.current.play().catch(()=>{})
  }, [stream])

  // Active speaker detection (very light)
  useEffect(() => {
    const audio = stream.getAudioTracks()[0]
    if (!audio) return
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(new MediaStream([audio]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0
    const loop = () => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a,b)=>a+b,0) / data.length
      setSpeaking(avg > 20)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => { cancelAnimationFrame(raf); ctx.close() }
  }, [stream])

  // FPS via requestVideoFrameCallback if supported
  useEffect(() => {
    const v = ref.current as any
    if (!v || !('requestVideoFrameCallback' in v)) { setFps(60); return }
    let last = performance.now(), frames = 0, stop = false
    const cb = (_:any, meta:any) => {
      frames++
      const now = performance.now()
      if (now - last >= 1000) {
        setFps(frames)
        frames = 0
        last = now
      }
      if (!stop) v.requestVideoFrameCallback(cb)
    }
    v.requestVideoFrameCallback(cb)
    return () => { stop = true }
  }, [])

  return (
    <div className="tile" style={{ outline: speaking ? '2px solid #34d399' : '1px solid #1f2937' }}>
      <video ref={ref} playsInline autoPlay />
      <div className="badge">{label}</div>
      <div className="stats">fps: {fps}</div>
    </div>
  )
}
