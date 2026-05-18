import { useState } from 'react'

interface CounterProps {
  initialCount?: number
  label?: string
}

export default function Counter({ initialCount = 0, label = 'Counter' }: CounterProps) {
  const [count, setCount] = useState(initialCount)

  return (
    <div className="counter">
      <p className="label">{label}</p>
      <div className="controls">
        <button className="btn" onClick={() => setCount((c: number) => c - 1)}>−</button>
        <span className="value">{count}</span>
        <button className="btn" onClick={() => setCount((c: number) => c + 1)}>+</button>
      </div>
    </div>
  )
}
