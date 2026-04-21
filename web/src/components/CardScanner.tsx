import { useRef, useState, useCallback, useEffect } from 'react'

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
    prices: Record<string, string | null> | null
  }
  inventoryEntry: {
    id: string
    quantity: number
  }
}

type ScanState = 'idle' | 'scanning' | 'result'

const SCAN_INTERVAL_MS = 2500  // how often to attempt a scan
const RESULT_DISPLAY_MS = 4000 // how long to show the result before resuming

export default function CardScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingRef = useRef(false)

  const [state, setState] = useState<ScanState>('idle')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<ScannedCard | null>(null)
  const [sessionCards, setSessionCards] = useState<ScannedCard[]>([])

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    processingRef.current = false
    setState('idle')
    setProcessing(false)
    setSessionCards([])
  }, [])

  const attemptScan = useCallback(async () => {
    if (processingRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    processingRef.current = true
    setProcessing(true)

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )

    if (!blob) {
      processingRef.current = false
      setProcessing(false)
      return
    }

    try {
      const form = new FormData()
      form.append('image', blob, 'scan.jpg')
      const res = await fetch('/api/scan', { method: 'POST', body: form })

      if (!res.ok) {
        // Silently ignore scan failures (card not in frame yet) and keep trying
        processingRef.current = false
        setProcessing(false)
        return
      }

      const data: ScannedCard = await res.json()

      // Pause scanning, show result, then resume
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      setResult(data)
      setSessionCards((prev) => [data, ...prev])
      setState('result')
      setProcessing(false)
      processingRef.current = false

      setTimeout(() => {
        setResult(null)
        setState('scanning')
        resumeScanning()
      }, RESULT_DISPLAY_MS)
    } catch {
      processingRef.current = false
      setProcessing(false)
    }
  }, []) // resumeScanning defined below, captured via ref

  const resumeScanning = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(attemptScan, SCAN_INTERVAL_MS)
  }, [attemptScan])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setState('scanning')
      // Give the video a moment to start before first scan attempt
      setTimeout(resumeScanning, 800)
    } catch {
      alert('Could not access camera. Please allow camera permissions.')
    }
  }, [resumeScanning])

  // Clean up on unmount
  useEffect(() => () => stopCamera(), [stopCamera])

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
          className={`w-full h-full object-cover ${state !== 'idle' ? 'block' : 'hidden'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {state === 'idle' && (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <span className="text-5xl">📷</span>
            <p className="text-sm">Camera off</p>
          </div>
        )}

        {/* Scanning pulse indicator */}
        {state === 'scanning' && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
            <span className={`w-2 h-2 rounded-full ${processing ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-white text-xs">{processing ? 'Reading…' : 'Scanning'}</span>
          </div>
        )}

        {/* Result overlay */}
        {state === 'result' && result && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 px-6 text-center">
            {result.card.imageUri && (
              <img src={result.card.imageUri} alt={result.card.name} className="w-28 rounded-lg shadow-lg" />
            )}
            <div>
              <p className="text-white font-semibold text-lg">{result.card.name}</p>
              <p className="text-slate-300 text-sm">{result.card.setName} · {result.card.rarity}</p>
              {result.card.prices?.usd && (
                <p className="text-emerald-400 text-sm mt-0.5">${result.card.prices.usd}</p>
              )}
              <p className="text-slate-400 text-xs mt-2">
                Added · {result.inventoryEntry.quantity} in collection
              </p>
            </div>
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
            Start Scanning
          </button>
        )}
        {state !== 'idle' && (
          <button
            onClick={stopCamera}
            className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Stop
          </button>
        )}
      </div>

      {/* Session list */}
      {sessionCards.length > 0 && (
        <div className="mt-6">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">
            This session · {sessionCards.length} card{sessionCards.length !== 1 ? 's' : ''}
          </p>
          <ul className="flex flex-col gap-2">
            {sessionCards.map((scanned, i) => (
              <li key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {scanned.card.imageUri && (
                  <img src={scanned.card.imageUri} alt={scanned.card.name} className="w-10 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-medium text-sm truncate">{scanned.card.name}</p>
                  <p className="text-slate-500 text-xs">{scanned.card.setName} · {scanned.card.rarity}</p>
                </div>
                {scanned.card.prices?.usd && (
                  <p className="text-slate-600 text-sm shrink-0">${scanned.card.prices.usd}</p>
                )}
                <p className="text-emerald-600 text-sm font-medium shrink-0">×{scanned.inventoryEntry.quantity}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
