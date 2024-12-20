'use client'

import React, { useState, useRef } from 'react'
import { createWorker } from 'tesseract.js'
import { Button } from './button'
import { Loader2, Upload } from 'lucide-react'

export default function ImageToText({ onTextExtracted }) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef(null)
  
  const processImage = async (file) => {
    try {
      setIsProcessing(true)
      setProgress(0)
      
      // Define logger function separately
      const logger = (m) => {
        if (m.status === 'recognizing text') {
          const progressValue = parseInt(m.progress * 100)
          requestAnimationFrame(() => setProgress(progressValue))
        }
      }
      
      // Create worker with logger
      const worker = createWorker()
      await worker
      
      // Initialize worker
      await worker.loadLanguage('eng')
      await worker.initialize('eng')
      
      // Create a URL from the file
      const imageUrl = URL.createObjectURL(file)
      
      // Recognize text
      const { data: { text } } = await worker.recognize(imageUrl)
      
      // Clean up
      URL.revokeObjectURL(imageUrl)
      await worker.terminate()
      
      // Call the callback with extracted text
      if (onTextExtracted && text) {
        onTextExtracted(text.trim())
      }
      
    } catch (error) {
      console.error('Error processing image:', error.message)
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      processImage(file)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        ref={fileInputRef}
        className="hidden"
      />
      <Button
        onClick={handleButtonClick}
        disabled={isProcessing}
        variant="ghost"
        size="sm"
        className="text-xs text-indigo-500 hover:bg-indigo-50"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            {progress}%
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-1" />
            Extract Text from Image
          </>
        )}
      </Button>
    </div>
  )
}