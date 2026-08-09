import { useState, type FormEvent } from 'react'
import { useMutation } from '@apollo/client'
import { LOGIN, REGISTER } from './graphql'

interface LoginProps {
  onLogin: () => void | Promise<void>
}

export function Login({ onLogin }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [login] = useMutation(LOGIN)
  const [register] = useMutation(REGISTER)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const mutation = isRegister ? register : login
      const input = isRegister ? { email, password, name } : { email, password }
      const { data } = await mutation({ variables: { input } })
      const token = isRegister
        ? data?.register?.token
        : data?.login?.token
      if (token) {
        localStorage.setItem('token', token)
        onLogin()
      } else {
        setError('Authentication failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>RSS Security Dashboard</h1>
        <h2>{isRegister ? 'Create account' : 'Sign in'}</h2>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">{isRegister ? 'Register' : 'Login'}</button>
        </form>
        <button
          type="button"
          className="link-button"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister
            ? 'Already have an account? Sign in'
            : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  )
}
