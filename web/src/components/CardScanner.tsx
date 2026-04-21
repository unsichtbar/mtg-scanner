import { useRef, useState, useCallback } from 'react'

interface ScannedCard {
  cardName: string
  card: {
    id: string
    name: string
    imageUri: string | null
    manaCost: string | null
    typeLine: string
    oracleText: string | null
    rarity: string
    setName: string
  }
}

type ScanState = 'idle' | 'streaming' | 'loading' | 'result' | 'error'

export default function CardScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [state, setState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ScannedCard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setState('streaming')
    } catch {
      setError('Could not access camera. Please allow camera permissions.')
      setState('error')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setState('idle')
  }, [])

  const capture = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    stopCamera()
    setState('loading')
    setError(null)

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Failed to capture image.')
        setState('error')
        return
      }

      try {
        const form = new FormData()
        form.append('image', blob, 'scan.jpg')

        const res = await fetch('/api/scan', { method: 'POST', body: form })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message ?? `Server error ${res.status}`)
        }

        const data: ScannedCard = await res.json()
        setResult(data)
        setState('result')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Scan failed.')
        setState('error')
      }
    }, 'image/jpeg', 0.92)
  }, [stopCamera])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setState('idle')
  }, [])

  return (
    <div className="max-w-xl mx-auto px-4 py-10 font-sans">
      <h1 className="text-3xl font-bold text-center mb-6 text-slate-800">Scan a Card</h1>

      {/* Viewfinder */}
      <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${state === 'streaming' ? 'block' : 'hidden'}`}
        />
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover ${state === 'loading' || state === 'result' ? 'block' : 'hidden'}`}
        />
        {state === 'idle' && (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <span className="text-5xl">📷</span>
            <p className="text-sm">Camera off</p>
          </div>
        )}
        {state === 'loading' && (
          <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white text-sm">Scanning…</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3 mt-5">
        {state === 'idle' && (
          <button
            onClick={startCamera}
            className="px-5 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Start Camera
          </button>
        )}
        {state === 'streaming' && (
          <>
            <button
              onClick={capture}
              className="px-5 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Capture
            </button>
            <button
              onClick={stopCamera}
              className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </>
        )}
        {(state === 'result' || state === 'error') && (
          <button
            onClick={reset}
            className="px-5 py-2 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Scan Another
          </button>
        )}
      </div>

      {/* Error */}
      {state === 'error' && error && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {state === 'result' && result && (
        <div className="mt-6 flex gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          {result.card.imageUri && (
            <img
              src={result.card.imageUri}
              alt={result.card.name}
              className="w-36 rounded-lg self-start shrink-0"
            />
          )}
          <div className="flex flex-col gap-1.5 min-w-0">
            <h2 className="text-lg font-semibold text-slate-800">{result.card.name}</h2>
            {result.card.manaCost && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">Mana cost:</span> {result.card.manaCost}
              </p>
            )}
            <p className="text-sm text-slate-600">
              <span className="font-medium">Type:</span> {result.card.typeLine}
            </p>
            {result.card.oracleText && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {result.card.oracleText}
              </p>
            )}
            <p className="text-sm text-slate-500 mt-1">
              {result.card.rarity} · {result.card.setName}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
