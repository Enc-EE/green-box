import { useState, useEffect, useRef } from 'react'
import { useOcvLoader } from './useOcvLoader'

function App() {
  const [pastedImage, setPastedImage] = useState<string | null>(null)
  const [blurKernelSize, setBlurKernelSize] = useState<number>(7)
  const [cannyThreshold1, setCannyThreshold1] = useState<number>(50)
  const [cannyThreshold2, setCannyThreshold2] = useState<number>(100)
  const [scaleFactor, setScaleFactor] = useState<number>(1.0)
  const [copyStatus, setCopyStatus] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cvReady = useOcvLoader()

  // Handle file input change for mobile
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        setPastedImage(imageUrl)
        processImageWithOpenCV(imageUrl)
      }
      reader.readAsDataURL(file)
    }
  }

  useEffect(() => {
    // Listen for paste events
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      const items = e.clipboardData?.items

      if (items) {
        // First, check for image files
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile()
            if (blob) {
              const reader = new FileReader()
              reader.onload = (event) => {
                const imageUrl = event.target?.result as string
                setPastedImage(imageUrl)
                processImageWithOpenCV(imageUrl)
              }
              reader.readAsDataURL(blob)
              return
            }
          }
        }

        // If no image file found, check for text (URL)
        for (let i = 0; i < items.length; i++) {
          if (items[i].type === 'text/plain') {
            items[i].getAsString((text) => {
              const trimmedText = text.trim()
              // Check if the text looks like an image URL
              if (trimmedText.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ||
                trimmedText.startsWith('http://') ||
                trimmedText.startsWith('https://') ||
                trimmedText.startsWith('data:image/')) {
                setPastedImage(trimmedText)
                processImageWithOpenCV(trimmedText)
              } else {
                console.log('Pasted text is not an image URL:', trimmedText)
              }
            })
            return
          }
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [cvReady])

  useEffect(() => {
    // Reprocess image when slider values change
    if (pastedImage && cvReady) {
      processImageWithOpenCV(pastedImage)
    }
  }, [blurKernelSize, cannyThreshold1, cannyThreshold2, scaleFactor, cvReady, pastedImage])

  const processImageWithOpenCV = (imageUrl: string) => {
    if (!cvReady || !window.cv || !canvasRef.current) {
      console.warn('OpenCV not ready or canvas not available yet.')
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current!
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      // Use requestAnimationFrame to ensure canvas is rendered
      requestAnimationFrame(() => {
        // OpenCV processing starts here
        try {
          const src = window.cv.imread(canvas)

          // Scale down the image
          const scaledWidth = Math.round(src.cols * scaleFactor)
          const scaledHeight = Math.round(src.rows * scaleFactor)
          const scaled = new window.cv.Mat()
          window.cv.resize(src, scaled, new window.cv.Size(scaledWidth, scaledHeight), 0, 0, window.cv.INTER_LINEAR)

          window.cv.cvtColor(scaled, scaled, window.cv.COLOR_RGBA2GRAY, 0)

          // Apply Gaussian blur with dynamic kernel size (must be odd)
          const kernelSize = blurKernelSize % 2 === 0 ? blurKernelSize + 1 : blurKernelSize
          window.cv.GaussianBlur(scaled, scaled, new window.cv.Size(kernelSize, kernelSize), 0)

          window.cv.Canny(scaled, scaled, cannyThreshold1, cannyThreshold2, 3, false);

          // invert image
          window.cv.bitwise_not(scaled, scaled);

          // Scale back up to original size
          const result = new window.cv.Mat()
          window.cv.resize(scaled, result, new window.cv.Size(src.cols, src.rows), 0, 0, window.cv.INTER_LINEAR)

          // Display the result
          window.cv.imshow(canvas, result)

          // Clean up
          src.delete()
          scaled.delete()
          result.delete()
        } catch (err) {
          console.error('OpenCV processing error:', err)
        }
      })
    }
    img.onerror = (err) => {
      console.error('Image loading error:', err)
    }
    img.src = imageUrl
  }

  const handleCopyImage = async () => {
    if (!canvasRef.current) return

    try {
      const canvas = canvasRef.current
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          setCopyStatus('✅ Copied!')
          setTimeout(() => setCopyStatus(''), 2000)
        }
      })
    } catch (err) {
      console.error('Failed to copy image:', err)
      setCopyStatus('❌ Failed to copy')
      setTimeout(() => setCopyStatus(''), 2000)
    }
  }

  return (
    <>
      <div className="card">
        <p>OpenCV Status: {cvReady ? '✅ Ready' : '⏳ Loading...'}</p>

        <div
          ref={inputRef}
          style={{
            margin: '20px 0',
            padding: '20px',
            border: '2px dashed #646cff',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'center',
            minHeight: '80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
        >
          <p style={{ margin: 0 }}>📋 Click to select an image</p>
          <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.7 }}>
            or paste (Ctrl+V / Cmd+V) on desktop
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ margin: '20px 0' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <strong>Scale Factor:</strong> {scaleFactor.toFixed(2)}x
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={scaleFactor}
              onChange={(e) => setScaleFactor(Number(e.target.value))}
              disabled={!pastedImage || !cvReady}
              style={{ width: '100%', height: '40px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <strong>Gaussian Blur Kernel Size:</strong> {blurKernelSize}
            </label>
            <input
              type="range"
              min="1"
              max="21"
              step="2"
              value={blurKernelSize}
              onChange={(e) => setBlurKernelSize(Number(e.target.value))}
              disabled={!pastedImage || !cvReady}
              style={{ width: '100%', height: '40px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <strong>Canny Threshold 1:</strong> {cannyThreshold1}
            </label>
            <input
              type="range"
              min="0"
              max="200"
              value={cannyThreshold1}
              onChange={(e) => setCannyThreshold1(Number(e.target.value))}
              disabled={!pastedImage || !cvReady}
              style={{ width: '100%', height: '40px', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <strong>Canny Threshold 2:</strong> {cannyThreshold2}
            </label>
            <input
              type="range"
              min="0"
              max="300"
              value={cannyThreshold2}
              onChange={(e) => setCannyThreshold2(Number(e.target.value))}
              disabled={!pastedImage || !cvReady}
              style={{ width: '100%', height: '40px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <button
          onClick={() => pastedImage && processImageWithOpenCV(pastedImage)}
          disabled={!pastedImage || !cvReady}
          style={{ marginBottom: '10px', padding: '12px 24px', fontSize: '16px', minHeight: '44px' }}
        >
          🔄 Reprocess Image
        </button>

        <h3>Processed Image:</h3>
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            border: '1px solid #ccc',
            borderRadius: '4px',
            touchAction: 'pan-y pinch-zoom',
          }}
        />
      </div>

      <button
        onClick={handleCopyImage}
        disabled={!pastedImage || !cvReady}
        style={{ marginBottom: '10px', padding: '12px 24px', fontSize: '16px', minHeight: '44px', marginLeft: '10px' }}
      >
        📋 Copy Image {copyStatus}
      </button>
    </>
  )
}

export default App
