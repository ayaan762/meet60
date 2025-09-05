import React, { useEffect, useState } from 'react'

type Dev = { deviceId: string, label: string }

export function DevicePicker({
  onChange
}: {
  onChange: (sel: { audioIn?: string, videoIn?: string }) => void
}) {
  const [audioIns, setAudioIns] = useState<Dev[]>([])
  const [videoIns, setVideoIns] = useState<Dev[]>([])
  const [selAudio, setSelAudio] = useState<string>('')
  const [selVideo, setSelVideo] = useState<string>('')

  useEffect(() => {
    (async () => {
      try {
        // Need permission at least once to get labels
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(()=>{})
        const devs = await navigator.mediaDevices.enumerateDevices()
        setAudioIns(devs.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone' })))
        setVideoIns(devs.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Camera' })))
      } catch (e) { console.error(e) }
    })()
  }, [])

  useEffect(() => {
    onChange({ audioIn: selAudio || undefined, videoIn: selVideo || undefined })
  }, [selAudio, selVideo])

  return (
    <div style={{display:'grid', gap:8}}>
      <label className="small">Microphone</label>
      <select value={selAudio} onChange={e => setSelAudio(e.target.value)}>
        <option value="">Default</option>
        {audioIns.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
      </select>
      <label className="small">Camera</label>
      <select value={selVideo} onChange={e => setSelVideo(e.target.value)}>
        <option value="">Default</option>
        {videoIns.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
      </select>
    </div>
  )
}
