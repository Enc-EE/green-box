import { useEffect, useState } from "react"

export function useOcvLoader() {
    const [cvReady, setCvReady] = useState(false)

    useEffect(() => {
        // Check if cv is already loaded
        if (window.cv && window.cv.Mat) {
            setCvReady(true)
            console.log('OpenCV.js is ready')
            return
        }

        // Set up callback for when OpenCV loads
        const checkOpenCV = () => {
            if (window.cv && window.cv.Mat) {
                setCvReady(true)
                console.log('OpenCV.js is ready')
            }
        }

        // Poll for OpenCV availability
        const interval = setInterval(() => {
            if (window.cv && window.cv.Mat) {
                setCvReady(true)
                console.log('OpenCV.js is ready')
                clearInterval(interval)
            }
        }, 100)

        // Also set up the callback in case it loads via onRuntimeInitialized
        if (window.cv) {
            window.cv.onRuntimeInitialized = checkOpenCV
        } else {
            window.cv = { onRuntimeInitialized: checkOpenCV } as any
        }

        return () => clearInterval(interval)
    }, [])

    return cvReady
}
